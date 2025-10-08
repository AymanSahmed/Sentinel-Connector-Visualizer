'use strict';

/* ===========================
   Helpers & shared utilities
   =========================== */

const qs = (s) => document.querySelector(s);

function setStatus(msg, isError = false) {
  const el = qs('#status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#b91c1c' : '#6b7280';
}

function ghHeaders() {
  const t = (qs('#tokenInput').value || '').trim();
  return t ? { Authorization: `token ${t}` } : {};
}

/* Stream → likely table mapping (common Sentinel/AMA conventions) */
const STREAM_TO_TABLE = {
  'microsoft-syslog': 'Syslog',
  'microsoft-windowsevent': 'WindowsEvents',
  'microsoft-commonsecuritylog': 'CommonSecurityLog',
  'microsoft-azurefirewall': 'AzureDiagnostics',
  'microsoft-perf': 'Perf',
};

function mapStreamToTable(streamName) {
  if (!streamName) return null;
  const key = String(streamName).toLowerCase().trim();

  if (STREAM_TO_TABLE[key]) return STREAM_TO_TABLE[key];

  // Custom streams sometimes end up as custom tables (_CL). Try to infer:
  if (key.startsWith('custom-')) {
    const suffix = key.replace(/^custom-/, '').replace(/[^a-z0-9]/gi, '');
    if (suffix) return `${suffix}_CL`;
  }
  // Fallback unknown
  return null;
}

/* ===========================
   1) Load Solutions into dropdown
   =========================== */
async function loadSolutions() {
  try {
    const repoStr = (qs('#repoInput').value || '').trim();
    if (!repoStr.includes('/')) {
      alert('Repo must be like Azure/Azure-Sentinel');
      return;
    }
    const [owner, repo] = repoStr.split('/');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/Solutions`;
    setStatus('Loading Solutions ...');

    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch {}
      throw new Error(`GitHub API error ${res.status}: ${detail || res.statusText}`);
    }

    const list = await res.json();
    const dirs = (list || [])
      .filter((x) => x.type === 'dir')
      .map((x) => x.name)
      .sort((a, b) => a.localeCompare(b));

    const sel = qs('#solutionSelect');
    sel.innerHTML = '';
    if (dirs.length === 0) {
      sel.innerHTML = '<option value="">(no solutions found)</option>';
      setStatus('No Solutions found under /Solutions', true);
      return;
    }

    for (const name of dirs) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    }
    setStatus(`Loaded ${dirs.length} solutions. Select one and click Visualize.`);
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Error loading solutions', true);
    alert(err.message || err);
  }
}

/* ===========================
   2) Enumerate JSON files recursively in a solution
   =========================== */
async function listJsonPathsForSolution(owner, repo, branch, solutionName) {
  setStatus(`Resolving branch ${branch} tree ...`);
  const bres = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
    { headers: ghHeaders() }
  );
  if (!bres.ok) {
    let detail = '';
    try { detail = await bres.text(); } catch {}
    throw new Error(`Branch API error ${bres.status}: ${detail || bres.statusText}`);
  }
  const b = await bres.json();
  const treeSha = b?.commit?.commit?.tree?.sha;
  if (!treeSha) throw new Error('Could not resolve branch tree SHA.');

  setStatus('Listing repository tree (recursive) ...');
  const tres = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
    { headers: ghHeaders() }
  );
  if (!tres.ok) {
    let detail = '';
    try { detail = await tres.text(); } catch {}
    throw new Error(`Trees API error ${tres.status}: ${detail || tres.statusText}`);
  }

  const t = await tres.json();
  const prefix = `Solutions/${solutionName}/`;
  const paths = (t.tree || [])
    .filter((it) => it.type === 'blob' && it.path.startsWith(prefix) && it.path.toLowerCase().endsWith('.json'))
    .map((it) => it.path);

  return paths;
}

/* ===========================
   3) Fetch & classify artifacts (connectors + DCRs)
   =========================== */
function classifyMechanismAndType(jsonObj, filePath) {
  const text = JSON.stringify(jsonObj).toLowerCase();
  const ui = jsonObj?.properties?.connectorUiConfig || jsonObj?.properties?.connectorUIConfig;
  const kind = (jsonObj?.kind || jsonObj?.properties?.kind || '').toLowerCase();

  // CCF (API polling) → pull
  if (ui || kind === 'customizable') {
    return { connectionType: 'pull', mechanism: 'CCF', isCCF: true };
  }

  // DCR / AMA / Log Ingestion
  const isDCR = text.includes('"type":"microsoft.insights/datacollectionrules"') ||
                jsonObj?.properties?.dataSources || jsonObj?.dataSources || jsonObj?.dataFlows;
  if (isDCR) {
    const ds = jsonObj?.properties?.dataSources || jsonObj?.dataSources || {};
    const hasSyslog = !!ds.syslog || text.includes('"syslog"');
    const hasWindows = !!ds.windowsEvent || text.includes('windowsevent');
    const mechanism = (hasSyslog || hasWindows) ? 'AMA' : 'Data Collector API';
    return { connectionType: 'push', mechanism, isCCF: false, isDCR: true };
  }

  if (text.includes('eventhub')) return { connectionType: 'push', mechanism: 'Event Hub', isCCF: false };
  if (text.includes('logic app') || text.includes('"workflows"')) return { connectionType: 'pull', mechanism: 'Logic Apps', isCCF: false };
  if (text.includes('azure function') || text.includes('functionapp')) return { connectionType: 'pull', mechanism: 'Azure Function', isCCF: false };

  return { connectionType: 'pull', mechanism: 'Service-to-Service', isCCF: false };
}

function extractConnectorName(jsonObj, fallbackName) {
  const ui = jsonObj?.properties?.connectorUiConfig || jsonObj?.properties?.connectorUIConfig;
  const title = ui?.title || ui?.displayName || jsonObj?.name;
  return (title || fallbackName || 'Unnamed Connector').trim();
}

function extractDataSource(jsonObj, filePath, solutionName) {
  const ui = jsonObj?.properties?.connectorUiConfig || jsonObj?.properties?.connectorUIConfig;
  const publisher = ui?.publisherName || ui?.publisher;
  if (publisher) return publisher.trim();
  if (solutionName) return solutionName.trim(); // fallback to solution name
  const last = filePath?.split('/')?.pop()?.replace(/\.json$/i, '') || 'Unknown';
  return last;
}

function pickTablesFromDcr(dcrObj) {
  const out = new Set();
  const props = dcrObj?.properties || dcrObj;
  const dataFlows = props?.dataFlows || [];
  const transform = (df) => (df?.transformKql ? String(df.transformKql) : '');

  for (const df of dataFlows) {
    const streams = Array.isArray(df.streams) ? df.streams : [];
    for (const s of streams) {
      const tableGuess = mapStreamToTable(s);
      if (tableGuess) out.add(tableGuess);
    }
    // Parse transform KQL for explicit "into table"
    const kql = transform(df).toLowerCase();
    const m = kql.match(/into\s+table\s+([a-z0-9_]+)/i);
    if (m && m[1]) out.add(m[1]);
  }
  return Array.from(out);
}

function pickStreamsFromDcr(dcrObj) {
  const out = new Set();
  const props = dcrObj?.properties || dcrObj;
  const dataFlows = props?.dataFlows || [];
  for (const df of dataFlows) {
    const streams = Array.isArray(df.streams) ? df.streams : [];
    streams.forEach((s) => out.add(s));
  }
  return Array.from(out);
}

async function fetchAndClassify(owner, repo, branch, paths, solutionName) {
  const baseRaw = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/`;
  const connectors = [];    // enriched connector records
  const dcrs = [];          // { name, streams[], tables[], raw, path }
  let filesProcessed = 0;

  for (const p of paths) {
    const url = baseRaw + p;
    const r = await fetch(url, { headers: ghHeaders() });
    if (!r.ok) { console.warn('skip', p, r.status); continue; }
    let json;
    try { json = await r.json(); }
    catch { console.warn('bad json', p); continue; }
    filesProcessed++;

    // Detect DCRs
    const text = JSON.stringify(json).toLowerCase();
    const looksLikeDcr = text.includes('"type":"microsoft.insights/datacollectionrules"') ||
                         json?.properties?.dataSources || json?.dataSources || json?.dataFlows;
    if (looksLikeDcr) {
      dcrs.push({
        name: json?.name || p.split('/').pop(),
        streams: pickStreamsFromDcr(json),
        tables: pickTablesFromDcr(json),
        raw: json,
        path: p,
      });
      continue;
    }

    // Detect connectors (CCF or others)
    const ui = json?.properties?.connectorUiConfig || json?.properties?.connectorUIConfig;
    const hasConnectorSignals = ui ||
      text.includes('microsoft.securityinsights/dataconnector') ||
      text.includes('microsoft.securityinsights/dataconnectordefinitions') ||
      text.includes('"connector"'); // broad

    if (hasConnectorSignals) {
      const mechanismInfo = classifyMechanismAndType(json, p);
      const name = extractConnectorName(json, p.split('/').pop());
      const dataSource = extractDataSource(json, p, solutionName);

      connectors.push({
        name,
        dataSource,
        connectionType: mechanismInfo.connectionType,  // 'pull' | 'push'
        mechanism: mechanismInfo.mechanism,            // 'CCF', 'AMA', 'Data Collector API', etc.
        isCCF: !!mechanismInfo.isCCF,
        path: p,
        raw: json,
        dcrs: [],     // will link later
      });
    }
  }

  // Link DCRs to connectors (same solution scope → associate all DCRs to all connectors in the solution)
  for (const c of connectors) {
    c.dcrs = dcrs.map((d) => ({
      name: d.name,
      streams: d.streams,
      tables: d.tables,
      path: d.path,
    }));
  }

  return { connectors, dcrs, filesProcessed };
}

/* ===========================
   4) Build visualization graph (connectors + dependencies + DCRs)
   =========================== */
function toGraphFromConnectors(connectors) {
  const nodes = [];
  const links = [];
  const map = Object.create(null);

  const addNode = (id, type, meta) => {
    if (!id) return null;
    const k = String(id);
    if (!map[k]) {
      map[k] = { id: k, type, meta };
      nodes.push(map[k]);
    } else {
      map[k].meta = { ...(map[k].meta || {}), ...(meta || {}) };
    }
    return map[k];
  };

  const addLink = (s, t, type) => { if (!s || !t) return; links.push({ source: s, target: t, type }); };

  for (const c of connectors) {
    // Connector node
    addNode(c.name, 'connector', {
      dataSource: c.dataSource,
      connectionType: c.connectionType,
      mechanism: c.mechanism,
      isCCF: c.isCCF,
      dcrCount: (c.dcrs || []).length,
    });

    // Source node
    addNode(c.dataSource, 'source', {});

    // Source → Connector
    addLink(c.dataSource, c.name, 'ingests');

    // Dependencies (DCRs → Connector)
    for (const d of c.dcrs || []) {
      const depId = `DCR: ${d.name}`;
      addNode(depId, 'dependency', {
        streams: d.streams,
        tables: d.tables,
      });
      addLink(depId, c.name, 'requires');
    }
  }

  return { nodes, links };
}

/* ===========================
   5) Draw D3 graph with tooltips of metadata
   =========================== */
function drawGraph(nodes, links) {
  if (typeof d3 === 'undefined') { setStatus('D3 not loaded', true); alert('D3 not loaded'); return; }

  const svg = d3.select('svg'); svg.selectAll('*').remove();
  const width = svg.node().clientWidth || window.innerWidth;
  const height = svg.node().clientHeight || Math.floor(window.innerHeight * 0.9);

  const color = (t) => t === 'connector' ? '#ff7f0e'
                : t === 'source' ? '#1f77b4'
                : t === 'dependency' ? '#2ca02c'
                : '#7f7f7f';

  const g = svg.append('g');
  svg.call(d3.zoom().on('zoom', (e) => g.attr('transform', e.transform))).on('dblclick.zoom', null);

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(120).strength(0.4))
    .force('charge', d3.forceManyBody().strength(-320))
    .force('collide', d3.forceCollide(26))
    .force('center', d3.forceCenter(width / 2, height / 2));

  const link = g.append('g').attr('stroke', '#9ca3af').attr('stroke-opacity', 0.7)
    .selectAll('line').data(links).enter().append('line').attr('stroke-width', 1.4);

  const node = g.append('g').selectAll('circle').data(nodes).enter().append('circle')
    .attr('r', 8)
    .attr('fill', (d) => color(d.type))
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .call(
      d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',  (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  // Tooltips with metadata
  node.append('title').text((d) => {
    const m = d.meta || {};
    if (d.type === 'connector') {
      const dcrLines = (m.dcrCount ? `DCRs: ${m.dcrCount}` : 'DCRs: 0');
      return [
        `Connector: ${d.id}`,
        m.dataSource ? `Data source: ${m.dataSource}` : null,
        m.mechanism ? `Mechanism: ${m.mechanism}` : null,
        m.connectionType ? `Connection type: ${m.connectionType}` : null,
        dcrLines,
      ].filter(Boolean).join('\n');
    }
    if (d.type === 'dependency') {
      const tables = (m.tables || []).join(', ') || '-';
      const streams = (m.streams || []).join(', ') || '-';
      return [`${d.id}`, `Streams: ${streams}`, `Tables: ${tables}`].join('\n');
    }
    return `${d.id}`;
  });

  const label = g.append('g').selectAll('text').data(nodes).enter().append('text')
    .text((d) => d.id)
    .attr('font-size', 11)
    .attr('fill', '#111827')
    .attr('dx', 10)
    .attr('dy', 4);

  sim.on('tick', () => {
    link
      .attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
    node
      .attr('cx', (d) => d.x).attr('cy', (d) => d.y);
    label
      .attr('x', (d) => d.x).attr('y', (d) => d.y);
  });

  window.onresize = () => {
    const w = svg.node().clientWidth || window.innerWidth;
    const h = svg.node().clientHeight || Math.floor(window.innerHeight * 0.9);
    sim.force('center', d3.forceCenter(w / 2, h / 2));
    sim.alpha(0.2).restart();
  };
}

/* ===========================
   6) Visualization logic (named function)
   =========================== */
async function visualizeSolution() {
  try {
    const repoStr = qs('#repoInput').value.trim();
    const branch  = qs('#branchInput').value.trim();
    const sol     = qs('#solutionSelect').value.trim();

    if (!repoStr.includes('/') || !sol) { alert('Select repo and solution'); return; }
    const [owner, repo] = repoStr.split('/');

    const paths = await listJsonPathsForSolution(owner, repo, branch, sol);
    if (paths.length === 0) { setStatus('No JSON files found in this solution.', true); alert('No JSON files in this solution.'); return; }

    setStatus(`Fetching & classifying artifacts in "${sol}" ...`);
    const { connectors, dcrs, filesProcessed } = await fetchAndClassify(owner, repo, branch, paths, sol);

    if (connectors.length === 0 && dcrs.length > 0) {
      // Render DCRs as dependencies via pseudo connectors
      const pseudoConnectors = dcrs.map((d, i) => ({
        name: `Collector ${i + 1}`,
        dataSource: sol,
        connectionType: 'push',
        mechanism: 'DCR',
        isCCF: false,
        dcrs: [{ name: d.name, streams: d.streams, tables: d.tables }],
      }));
      const { nodes, links } = toGraphFromConnectors(pseudoConnectors);
      drawGraph(nodes, links);
      setStatus(`No connectors detected; rendered ${dcrs.length} DCR(s) as dependencies. Files processed: ${filesProcessed}.`);
      return;
    }

    if (connectors.length === 0) {
      setStatus('No connectors or DCRs detected. Try another solution or add a token to avoid rate limits.', true);
      alert('No connectors found here.');
      return;
    }

    const { nodes, links } = toGraphFromConnectors(connectors);
    drawGraph(nodes, links);
    setStatus(`Done. Files processed: ${filesProcessed}. Rendered ${nodes.length} nodes / ${links.length} links.`);
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Error', true);
    alert(err.message || err);
  }
}

/* ===========================
   7) Button handlers (bind after DOM is ready)
   =========================== */
/* ===========================
   7) Button handlers (bind after DOM is ready)
   =========================== */
document.addEventListener('DOMContentLoaded', () => {
  const btnLoad = qs('#btnLoad');
  const btnViz = qs('#btnViz');

  if (btnLoad) {
    btnLoad.addEventListener('click', loadSolutions);
    console.log('✅ Load Solutions button bound');
  } else {
    console.error('❌ Button #btnLoad not found');
  }

  if (btnViz) {
    btnViz.addEventListener('click', visualizeSolution);
    console.log('✅ Visualize button bound');
  } else {
    console.error('❌ Button #btnViz not found');
  }

  if (typeof d3 !== 'undefined') {
    console.log('D3 version:', d3.version);
  } else {
    setStatus('D3 not detected. Ensure d3.min.js is loaded before app.js', true);
  }
});