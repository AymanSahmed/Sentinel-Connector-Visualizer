 'use strict';

    // ---------- helpers ----------
    const qs = (s)=>document.querySelector(s);
    function setStatus(msg, isError=false){ const el=qs('#status'); if(!el) return; el.textContent=msg; el.style.color=isError?'#b91c1c':'#6b7280'; }
    function ghHeaders(){ const t=(qs('#tokenInput').value||'').trim(); return t?{Authorization:`token ${t}`}:{ }; }

    // ---------- 1) Load Solutions list into dropdown ----------
    // uses Contents API to list /Solutions (just one call)
    async function loadSolutions(){
      try{
        const repoStr=(qs('#repoInput').value||'').trim(); if(!repoStr.includes('/')){ alert('Repo must be like Azure/Azure-Sentinel'); return; }
        const [owner,repo]=repoStr.split('/');
        const url=`https://api.github.com/repos/${owner}/${repo}/contents/Solutions`;
        setStatus('Loading Solutions ...');
        const res=await fetch(url,{headers:ghHeaders()});
        if(!res.ok){ let detail=''; try{detail=await res.text();}catch{} throw new Error(`GitHub API error ${res.status}: ${detail||res.statusText}`); }
        const list=await res.json();
        const dirs=(list||[]).filter(x=>x.type==='dir').map(x=>x.name).sort((a,b)=>a.localeCompare(b));
        const sel=qs('#solutionSelect');
        sel.innerHTML='';
        if(dirs.length===0){ sel.innerHTML='<option value=\"\">(no solutions found)</option>'; setStatus('No Solutions found under /Solutions',true); return; }
        for(const name of dirs){ const opt=document.createElement('option'); opt.value=name; opt.textContent=name; sel.appendChild(opt); }
        setStatus(`Loaded ${dirs.length} solutions. Select one and click Visualize.`);
      }catch(err){ console.error(err); setStatus(err.message||'Error loading solutions',true); alert(err.message||err); }
    }

    // ---------- 2) For selected solution, list JSON files recursively ----------
    // Uses Branch API to get tree SHA, then Trees API with ?recursive=1 (few calls, robust).
    async function listJsonPathsForSolution(owner, repo, branch, solutionName){
      setStatus(`Resolving branch ${branch} tree ...`);
      const bres=await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,{headers:ghHeaders()});
      if(!bres.ok){ let detail=''; try{detail=await bres.text();}catch{} throw new Error(`Branch API error ${bres.status}: ${detail||bres.statusText}`); }
      const b = await bres.json();
      const treeSha = b?.commit?.commit?.tree?.sha;
      if(!treeSha) throw new Error('Could not resolve branch tree SHA.');

      setStatus('Listing repository tree (recursive) ...');
      const tres=await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,{headers:ghHeaders()});
      if(!tres.ok){ let detail=''; try{detail=await tres.text();}catch{} throw new Error(`Trees API error ${tres.status}: ${detail||tres.statusText}`); }
      const t = await tres.json();
      const prefix = `Solutions/${solutionName}/`;
      const paths = (t.tree||[])
        .filter(it => it.type==='blob' && it.path.startsWith(prefix) && it.path.toLowerCase().endsWith('.json'))
        .map(it => it.path);

      return paths;
    }

    // ---------- 3) Fetch JSONs by raw URL and filter for connectorUiConfig ----------
    async function fetchConnectorJsons(owner, repo, branch, paths){
      const base = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/`;
      const files = [];
      let count=0;
      for(const p of paths){
        const url = base + p;
        const r = await fetch(url,{headers:ghHeaders()});
        if(!r.ok){ console.warn('skip',p,r.status); continue; }
        try{
          const json = await r.json();
          // Only keep those that look like connector definitions (have connectorUiConfig)
          const ui = json?.properties?.connectorUiConfig || json?.properties?.connectorUIConfig;
          if(ui) { files.push({path:p,json,ui}); count++; }
        }catch(e){ console.warn('bad json',p); }
      }
      setStatus(`Found ${count} connector JSON(s) in this solution.`);
      return files;
    }

    // ---------- 4) Build graph ----------
    function toGraph(files){
      const nodes=[], links=[], map=Object.create(null);
      const addNode=(id,type)=>{ if(!id) return; const k=String(id); if(!map[k]){ map[k]={id:k,type}; nodes.push(map[k]); } return map[k]; };
      const addLink=(s,t,type)=>{ if(!s||!t) return; links.push({source:s,target:t,type}); };

      for(const f of files){
        const ui = f.ui;
        const connectorName = (ui.title || ui.displayName || f.path.split('/').pop()).trim();
        const publisher     = (ui.publisherName || ui.publisher || 'Unknown').trim();

        addNode(publisher,'source');
        addNode(connectorName,'connector');
        addLink(publisher,connectorName,'ingests');

        const text = JSON.stringify(f.json).toLowerCase();
        const deps = new Set();
        if (text.includes('data collection rule') || text.includes('"dcr"')) deps.add('DCR');
        if (text.includes('data collection endpoint') || text.includes('"dce"')) deps.add('DCE');
        if (text.includes('log analytics')) deps.add('Log Analytics');
        if (text.includes('logic app')) deps.add('Logic Apps');
        if (text.includes('azure function')) deps.add('Azure Functions');
        if (text.includes('syslog')) deps.add('Syslog');
        if (text.includes('cef')) deps.add('CEF');
        if (text.includes('event hub')) deps.add('Event Hubs');

        for(const d of deps){ addNode(d,'dependency'); addLink(d,connectorName,'requires'); }
      }
      return {nodes,links};
    }

    // ---------- 5) Draw D3 graph ----------
    function drawGraph(nodes, links){
      if(typeof d3==='undefined'){ setStatus('D3 not loaded',true); alert('D3 not loaded'); return; }

      const svg = d3.select('svg'); svg.selectAll('*').remove();
      const width = svg.node().clientWidth || window.innerWidth;
      const height= svg.node().clientHeight|| Math.floor(window.innerHeight*0.9);

      const color=(t)=> t==='connector'?'#ff7f0e': t==='source'?'#1f77b4': t==='dependency'?'#2ca02c': '#7f7f7f';

      const g = svg.append('g');
      svg.call(d3.zoom().on('zoom',e=>g.attr('transform',e.transform))).on('dblclick.zoom',null);

      const sim = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d=>d.id).distance(120).strength(0.4))
        .force('charge', d3.forceManyBody().strength(-320))
        .force('collide', d3.forceCollide(26))
        .force('center', d3.forceCenter(width/2,height/2));

      const link = g.append('g').attr('stroke','#9ca3af').attr('stroke-opacity',0.7)
        .selectAll('line').data(links).enter().append('line').attr('stroke-width',1.4);

      const node = g.append('g').selectAll('circle').data(nodes).enter().append('circle')
        .attr('r',8).attr('fill',d=>color(d.type)).attr('stroke','#fff').attr('stroke-width',1)
        .call(d3.drag()
          .on('start',(e,d)=>{ if(!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
          .on('drag',(e,d)=>{ d.fx=e.x; d.fy=e.y; })
          .on('end', (e,d)=>{ if(!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; })
        );

      const label = g.append('g').selectAll('text').data(nodes).enter().append('text')
        .text(d=>d.id).attr('font-size',11).attr('fill','#111827').attr('dx',10).attr('dy',4);

      sim.on('tick', ()=>{
        link .attr('x1',d=>d.source.x).attr('y1',d=>d.source.y)
             .attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
        node .attr('cx',d=>d.x).attr('cy',d=>d.y);
        label.attr('x',d=>d.x).attr('y',d=>d.y);
      });

      window.onresize=()=>{ const w=svg.node().clientWidth||window.innerWidth; const h=svg.node().clientHeight||Math.floor(window.innerHeight*0.9);
        sim.force('center', d3.forceCenter(w/2,h/2)); sim.alpha(0.2).restart(); };
    }

    // ---------- Button handlers ----------
    qs('#btnLoad').addEventListener('click', loadSolutions);
    qs('#btnViz').addEventListener('click', async ()=>{
      try{
        const repoStr=(qs('#repoInput').value||'').trim(); const branch=(qs('#branchInput').value||'master').trim();
        const sol=(qs('#solutionSelect').value||'').trim();
        if(!repoStr.includes('/')){ alert('Repo must be like Azure/Azure-Sentinel'); return; }
        if(!sol){ alert('Pick a solution from the list first'); return; }
        const [owner,repo]=repoStr.split('/');

        const paths = await listJsonPathsForSolution(owner,repo,branch,sol);
        if(paths.length===0){ setStatus('No JSON files found in this solution.',true); alert('No JSON files in this solution.'); return; }

        setStatus(`Fetching connector JSONs in "${sol}" ...`);
        const files = await fetchConnectorJsons(owner,repo,branch,paths);
        if(files.length===0){ setStatus('No connector definitions found in this solution.',true); alert('No connectors found here.'); return; }

        const {nodes,links} = toGraph(files);
        setStatus(`Rendering ${nodes.length} nodes / ${links.length} links ...`);
        drawGraph(nodes,links);
        setStatus(`Done. ${nodes.length} nodes / ${links.length} links.`);
      }catch(err){ console.error(err); setStatus(err.message||'Error',true); alert(err.message||err); }
    });

    // small runtime check
    if (typeof d3 !== 'undefined') {
      console.log('D3 version:', d3.version);
    }