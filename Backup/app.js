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

/* ===========================
   1) Load Solutions into dropdown
   =========================== */
async function loadSolutions() {
  try {
    const repoStr = (qs('#repoInput').value || '').trim();
    if (!repoStr.includes('/')) {
      // Using custom messaging instead of alert()
      setStatus('Repo must be like Azure/Azure-Sentinel', true);
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
    // Removed alert() as per instructions
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

function mapStreamToTable(streamName) {
  if (!streamName) return null;
  const key = String(streamName).toLowerCase().trim();
  if (STREAM_TO_TABLE[key]) return STREAM_TO_TABLE[key];
  if (key.startsWith('custom-')) {
    const suffix = key.replace(/^custom-/, '').replace(/[^a-z0-9]/gi, '');
    if (suffix) return `${suffix}_CL`;
  }
  return null;
}

/* ===========================
   3) Classification & Enrichment
   =========================== */

// Determine ingestion mechanism and connection type
function classifyMechanismAndType(jsonObj) {
  const text = JSON.stringify(jsonObj).toLowerCase();
  const ui = jsonObj?.properties?.connectorUiConfig || jsonObj?.properties?.connectorUIConfig;
  const kind = (jsonObj?.kind || jsonObj?.properties?.kind || '').toLowerCase();

  if (ui || kind === 'customizable') {
    return { connectionType: 'pull', mechanism: 'CCF', isCCF: true };
  }

  const isDCR = text.includes('microsoft.insights/datacollectionrules') ||
                jsonObj?.properties?.dataSources || jsonObj?.dataSources || jsonObj?.dataFlows;
  if (isDCR) {
    const ds = jsonObj?.properties?.dataSources || jsonObj?.dataSources || {};
    const hasSyslog = !!ds.syslog || text.includes('syslog');
    const hasWindows = !!ds.windowsEvent || text.includes('windowsevent');
    const mechanism = (hasSyslog || hasWindows) ? 'AMA' : 'Logs Ingestion API';
    return { connectionType: 'push', mechanism, isCCF: false, isDCR: true };
  }

  if (text.includes('eventhub')) return { connectionType: 'push', mechanism: 'Event Hub', isCCF: false };
  if (text.includes('logic app') || text.includes('workflows')) return { connectionType: 'pull', mechanism: 'Logic Apps', isCCF: false };
  if (text.includes('azure function') || text.includes('functionapp')) return { connectionType: 'pull', mechanism: 'Azure Functions', isCCF: false };
  if (text.includes('data collector api')) return { connectionType: 'push', mechanism: 'HTTP Data Collector API', isCCF: false };

  return { connectionType: 'pull', mechanism: 'Service-to-Service', isCCF: false };
}

// Extract connector name and data source
function extractConnectorName(jsonObj, fallbackName) {
  const ui = jsonObj?.properties?.connectorUiConfig || jsonObj?.properties?.connectorUIConfig;
  const title = ui?.title || ui?.displayName || jsonObj?.name;
  return (title || fallbackName || 'Unnamed Connector').trim();
}

function extractDataSource(jsonObj, filePath, solutionName) {
  const ui = jsonObj?.properties?.connectorUiConfig || jsonObj?.properties?.connectorUIConfig;
  const publisher = ui?.publisherName || ui?.publisher;
  if (publisher) return publisher.trim();
  if (solutionName) return solutionName.trim();
  const last = filePath?.split('/')?.pop()?.replace(/\.json$/i, '') || 'Unknown';
  return last;
}

// Pick tables and streams from DCR
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

//Maintemplate metadata extraction
async function extractMaintemplateMetadata(owner, repo, branch, solutionName, paths) {
  const maintemplatePath = paths.find(p => /Maintemplate\.json$/i.test(p));
  if (!maintemplatePath) return null;

  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${maintemplatePath}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) return null;
  let json;
  try { json = await res.json(); } catch { return null; }

  // General Metadata
  const metadata = {
    solutionName: json?.parameters?.solutionName?.defaultValue || '',
    contactEmail: json?.parameters?.contactEmail?.defaultValue || '',
    publisher: json?.parameters?.publisher?.defaultValue || '',
    connectors: [],
    workbooks: [],
    analyticsRules: []
  };

  // Connector Details
  if (json?.resources) {
    for (const r of json.resources) {
      if (r.type?.toLowerCase().includes('microsoft.securityinsights/dataconnector')) {
        metadata.connectors.push({
          name: r.name,
          dataType: r.properties?.dataTypes || '',
          mechanism: r.properties?.connectorType || ''
        });
      }
      if (r.type?.toLowerCase().includes('microsoft.insights/workbooks')) {
        metadata.workbooks.push({
          name: r.name,
          displayName: r.properties?.displayName || ''
        });
      }
      if (r.type?.toLowerCase().includes('microsoft.securityinsights/alertrules')) {
        metadata.analyticsRules.push({
          name: r.name,
          displayName: r.properties?.displayName || '',
          severity: r.properties?.severity || ''
        });
      }
    }
  }

  return metadata;
}

// Fetch and classify connectors and DCRs
async function fetchAndClassify(owner, repo, branch, paths, solutionName) {
  const baseRaw = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/`;
  const connectors = [];
  const dcrs = [];
  let filesProcessed = 0;

  for (const p of paths) {
    const url = baseRaw + p;
    const r = await fetch(url, { headers: ghHeaders() });
    if (!r.ok) continue;
    let json;
    try { json = await r.json(); } catch { continue; }
    filesProcessed++;

    const text = JSON.stringify(json).toLowerCase();
    const looksLikeDcr = text.includes('microsoft.insights/datacollectionrules') ||
                         json?.properties?.dataSources || json?.dataSources || json?.dataFlows;
    if (looksLikeDcr) {
      const destinations = Object.keys(json?.properties?.destinations || {});
      dcrs.push({
        name: json?.name || p.split('/').pop(),
        streams: pickStreamsFromDcr(json),
        tables: pickTablesFromDcr(json),
        destinations,
        roles: ['Monitoring Metrics Publisher'],
        raw: json,
        path: p,
      });
      continue;
    }

    const ui = json?.properties?.connectorUiConfig || json?.properties?.connectorUIConfig;
    const hasConnectorSignals = ui || text.includes('dataconnector');
    if (hasConnectorSignals) {
      const mechanismInfo = classifyMechanismAndType(json);
      const name = extractConnectorName(json, p.split('/').pop());
      const dataSource = extractDataSource(json, p, solutionName);
      connectors.push({
        name,
        dataSource,
        connectionType: mechanismInfo.connectionType,
        mechanism: mechanismInfo.mechanism,
        isCCF: mechanismInfo.isCCF,
        path: p,
        raw: json,
        dcrs: [],
      });
    }
  }

  for (const c of connectors) {
    c.dcrs = dcrs.map((d) => ({
      name: d.name,
      streams: d.streams,
      tables: d.tables,
      destinations: d.destinations,
      roles: d.roles,
      path: d.path,
    }));
  }

  return { connectors, dcrs, filesProcessed };
}

/* ===========================
   4) Hunting & Normalization
   =========================== */

// Collect hunting queries from solution paths
async function collectHuntingArtifacts(owner, repo, branch, paths) {
  const baseRaw = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/`;
  const hunting = [];
  const looksLikeHuntingPath = (p) =>
    /\/hunting( queries)?\//i.test(p) || /hunting/i.test(p.split('/').slice(-2).join('/'));

  for (const p of paths) {
    if (!looksLikeHuntingPath(p)) continue;
    const r = await fetch(baseRaw + p, { headers: ghHeaders() });
    if (!r.ok) continue;
    let json;
    try { json = await r.json(); } catch { continue; }
    const name = json?.properties?.displayName || json?.properties?.title || json?.name || p.split('/').pop();
    const query = json?.properties?.query || json?.query || json?.properties?.kql || '';
    if (typeof query === 'string' && query.trim()) hunting.push({ name, query, path: p });
  }
  return hunting;
}

// Extract ASIM/im tokens from query
function extractNormalizationTokens(query) {
  const tokens = new Set();
  (query.match(/\bASIM[_A-Za-z0-9]+/g) || []).forEach(t => tokens.add(t));
  (query.match(/\bim[A-Z][A-Za-z0-9_]*/g) || []).forEach(t => tokens.add(t));
  return Array.from(tokens);
}

// Enrich connectors with hunting and normalization metadata
function enrichWithHuntingAndNormalization(connectors, huntingQueries) {
  const wordBoundary = (s) => new RegExp(`\\b${s}\\b`, 'i');
  for (const c of connectors) {
    const tables = new Set();
    // Collect all tables associated with this connector (via DCRs)
    (c.dcrs || []).forEach(d => (d.tables || []).forEach(t => tables.add(t)));

    const hits = [];
    const norms = new Set();
    for (const h of huntingQueries) {
      // Check if the hunting query uses any of the tables this connector feeds
      const matches = Array.from(tables).some(t => wordBoundary(t).test(h.query));
      if (!matches) continue;
      
      hits.push({ name: h.name, path: h.path });
      // Collect normalization tokens used in matching queries
      extractNormalizationTokens(h.query).forEach(tok => norms.add(tok));
    }
    c.hunting = hits;
    c.huntingCount = hits.length;
    c.normalization = Array.from(norms);
  }
}

/* ===========================
   5) Build graph from connectors (UPDATED for Cascading)
   =========================== */
function toGraphFromConnectors(connectors, solutionMeta) {
  const nodes = [];
  const links = [];
  const map = Object.create(null);

  const addNode = (id, type, meta) => {
    if (!id) return null;
    const k = String(id);
    if (!map[k]) {
      map[k] = { id: k, type, meta: { ...meta } };
      nodes.push(map[k]);
    } else {
      // Merge metadata if node already exists (e.g., two DCRs writing to same table)
      map[k].meta = { ...(map[k].meta || {}), ...(meta || {}) }; 
    }
    return map[k];
  };

  const addLink = (s, t, type) => {
    if (!s || !t) return;
    // Check for duplicates before pushing
    const isDuplicate = links.some(l => 
        (l.source === s && l.target === t) || (l.source.id === s && l.target.id === t));
    if (!isDuplicate) {
        links.push({ source: s, target: t, type });
    }
  };

  // Add solution node (Layer 1)
  const solutionId = solutionMeta?.solutionName || 'Solution';
  addNode(solutionId, 'solution', {
    contactEmail: solutionMeta?.contactEmail,
    publisher: solutionMeta?.publisher
  });

  for (const c of connectors) {
    // Connector node (Layer 3)
    addNode(c.name, 'connector', {
      dataSource: c.dataSource,
      connectionType: c.connectionType,
      mechanism: c.mechanism,
      isCCF: c.isCCF,
      huntingCount: c.huntingCount || 0,
      hunting: c.hunting || [],
      normalization: c.normalization || [],
    });

    // Source node (Layer 2)
    addNode(c.dataSource, 'source', {});
    
    // Links for the first layers
    addLink(solutionId, c.name, 'solution-to-connector'); // Solution -> Connector
    addLink(c.dataSource, c.name, 'ingests'); // Source -> Connector

    // Iterate through DCRs (Layer 4)
    for (const d of c.dcrs || []) {
      const depId = `DCR: ${d.name}`;
      addNode(depId, 'dependency', {
        streams: d.streams,
        tables: d.tables,
        destinations: d.destinations || [],
        roles: d.roles || [],
      });
      addLink(c.name, depId, 'connector-to-dcr'); // Connector -> DCR

      // === New: Link DCR/Connector to Target Tables (Layer 5 Endpoints) ===
      for (const table of d.tables || []) {
        addNode(table, 'table', {}); // New node type for Tables
        addLink(depId, table, 'writes-to'); // DCR -> Table
      }
    }
    
    // === New: Link Connector to Normalization Schemas (Layer 5 Endpoints) ===
    if (c.normalization && c.normalization.length) {
        // Use a unique ID based on connector name
        const normId = `Norm: ${c.name}`; 
        addNode(normId, 'normalization', { tokens: c.normalization });
        addLink(c.name, normId, 'uses-norm'); // Connector -> Normalization Schema
    }
  }

  return { nodes, links };
}
/* ===========================
   Render the graph (UPDATED for Cascading Layout)
   =========================== */
function renderGraph(svg, data) {
  const { nodes, links } = data;
  svg.selectAll('*').remove();

  // Define SVG size and viewBox
  svg
    .attr('width', 1400)
    .attr('height', 900)
    .attr('viewBox', '0 0 1400 900');

  const width = 1400;
  const height = 900;

  // Color mapping by connector type/mechanism (Updated with new node types)
  const typeColor = {
    'solution': '#ffd700', // Gold (Solution)
    'Service-to-Service': '#b3e5fc', // Light Blue
    'CCF': '#ffe082', // Light Orange
    'Logic Apps': '#c5e1a5', // Light Green
    'Event Hub': '#f8bbd0', // Pink
    'Azure Functions': '#d1c4e9', // Lavender
    'AMA': '#ffccbc', // Peach
    'HTTP Data Collector API': '#b2dfdb', // Teal
    'DCR': '#c8e6c9', // Mint
    'source': '#bbdefb', // Lighter Blue (Source)
    'dependency': '#c8e6c9', // Mint (DCR)
    'connector': '#ffe0b2', // Light Peach (Connector)
    // New Cascaded Endpoints
    'table': '#80cbc4', // Dark Teal (Target Tables)
    'normalization': '#ffab91' // Coral (Normalization Schemas)
  };

  function getNodeColor(d) {
    if (d.type === 'connector') {
      const mech = d.meta?.mechanism || '';
      return typeColor[mech] || typeColor[d.type] || '#eeeeee';
    }
    return typeColor[d.type] || '#eeeeee';
  }

  function wrapText(text, maxChars) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    words.forEach(word => {
      if ((line + word).length > maxChars) {
        lines.push(line.trim());
        line = word + ' ';
      } else {
        line += word + ' ';
      }
    });
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  // Sort nodes to ensure proper rendering order and layer calculation
  nodes.sort((a, b) => {
    // New sort order for cascaded view: solution > source > connector > dependency > table > normalization
    const order = { solution: 0, source: 1, connector: 2, dependency: 3, table: 4, normalization: 5 };
    return (order[a.type] ?? 99) - (order[b.type] ?? 99);
  });

  const g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.5, 2]).on('zoom', (e) => g.attr('transform', e.transform)))
    .on('dblclick.zoom', null);

  svg.append('defs').append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#666');

  // --- UPDATED D3 FORCES FOR CASCADED LAYOUT ---
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(180).strength(0.6)) // Adjusted distance/strength
    .force('charge', d3.forceManyBody().strength(-200)) // Reduced charge for better layering
    .force('collide', d3.forceCollide(80))

    // Enforce X-positions for each layer in the cascade
    .force('layerX', d3.forceX().x(d => {
        switch (d.type) {
            case 'solution': return width * 0.1;       // Layer 1
            case 'source': return width * 0.25;        // Layer 2
            case 'connector': return width * 0.45;     // Layer 3
            case 'dependency': return width * 0.60;    // Layer 4 (DCR)
            case 'table': return width * 0.85;         // Layer 5 (Endpoint 1)
            case 'normalization': return width * 0.85; // Layer 5 (Endpoint 2)
            default: return width / 2;
        }
    }).strength(1.2)) // High strength to enforce the layering

    .force('center', d3.forceCenter(width / 2, height / 2)); // General center force

  const link = g.append('g')
    .attr('stroke', '#9ca3af')
    .attr('stroke-opacity', 0.7)
    .selectAll('line')
    .data(links)
    .enter().append('line')
    .attr('stroke-width', 2)
    .attr('marker-end', 'url(#arrow)');

  const rectWidth = 260;
  const rectHeight = 120;
  const rectRx = 16;
  const maxCharsPerLine = 28;
  const maxLines = 5;

  const nodeGroup = g.append('g')
    .selectAll('g')
    .data(nodes)
    .enter().append('g')
    .attr('class', 'node-group')
    .call(
      d3.drag()
        .on('start', (e, d) => {
          if (!e.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (e, d) => {
          d.fx = e.x;
          d.fy = e.y;
        })
        .on('end', (e, d) => {
          if (!e.active) sim.alphaTarget(0);
        })
    );

  nodeGroup.append('rect')
    .attr('width', rectWidth)
    .attr('height', rectHeight)
    .attr('x', -rectWidth / 2)
    .attr('y', -rectHeight / 2)
    .attr('rx', rectRx)
    .attr('fill', d => getNodeColor(d))
    .attr('stroke', '#333')
    .attr('stroke-width', 2);

  nodeGroup.append('title').text(d => d.id);

  nodeGroup.each(function (d) {
    const g = d3.select(this);
    let lines = [];
    if (d.type === 'solution') {
      lines.push(`Solution: ${d.id}`);
      if (d.meta?.contactEmail) lines.push(`Contact: ${d.meta.contactEmail}`);
      if (d.meta?.publisher) lines.push(`Publisher: ${d.meta.publisher}`);
    } else if (d.type === 'connector') {
      const m = d.meta || {};
      lines.push(`Connector: ${d.id}`);
      lines.push(`Source: ${m.dataSource || ''}`);
      lines.push(`Type: ${m.connectionType || ''} (${m.mechanism || ''})`);
      if (m.huntingCount) lines.push(`Hunting: ${m.huntingCount}`);
      if (m.normalization && m.normalization.length)
        lines.push(`Norm: ${m.normalization.slice(0, 3).join(',')}${m.normalization.length > 3 ? '…' : ''}`);
    } else if (d.type === 'dependency') {
      const m = d.meta || {};
      lines.push(`DCR/Dependency: ${d.name}`);
      lines.push(`Streams: ${(m.streams || []).length}`);
      lines.push(`Tables: ${(m.tables || []).length}`);
      if (m.destinations && m.destinations.length)
        lines.push(`Dest: ${m.destinations.join(',')}`);
      if (m.roles && m.roles.length)
        lines.push(`Roles: ${m.roles.join(',')}`);
    } else if (d.type === 'source') {
      lines.push(`Source: ${d.id}`);
    } else if (d.type === 'table') { // NEW TABLE ENDPOINT
      lines.push(`Target Table (Endpoint)`);
      lines.push(`Name: ${d.id}`);
    } else if (d.type === 'normalization') { // NEW NORMALIZATION ENDPOINT
        const m = d.meta || {};
        lines.push(`ASIM / IM Schema (Endpoint)`);
        lines.push(`Tokens: ${m.tokens.slice(0, 3).join(', ')}${m.tokens.length > 3 ? '...' : ''}`);
    } else {
      lines.push(d.id);
    }

    let wrappedLines = lines.flatMap(line => wrapText(line, maxCharsPerLine));
    if (wrappedLines.length > maxLines) {
      wrappedLines = wrappedLines.slice(0, maxLines);
      wrappedLines[maxLines - 1] += ' ...';
    }

    const text = g.append('text')
      .attr('font-size', 15)
      .attr('font-family', 'Segoe UI, Arial, sans-serif')
      .attr('fill', '#222')
      .attr('text-anchor', 'start')
      .attr('x', -rectWidth / 2 + 12)
      .attr('y', -rectHeight / 2 + 24);

    wrappedLines.forEach((line, i) => {
      text.append('tspan')
        .attr('x', -rectWidth / 2 + 12)
        .attr('dy', i === 0 ? 0 : 20)
        .text(line);
    });
  });

  sim.on('tick', () => {
    link
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    nodeGroup
      .attr('transform', d => `translate(${d.x},${d.y})`);
  });

  window.onresize = () => {
    svg
      .attr('width', 1400)
      .attr('height', 900)
      .attr('viewBox', '0 0 1400 900');
    sim.force('center', d3.forceCenter(700, 450));
    sim.alpha(0.2).restart();
  };
}

/* ===========================
   7) Visualization flow
   =========================== */
async function visualizeSolution() {
  try {
    const repoStr = qs('#repoInput').value.trim();
    const branch = qs('#branchInput').value.trim();
    const sol = qs('#solutionSelect').value.trim();

    if (!repoStr.includes('/') || !sol) {
      setStatus('Please enter a valid GitHub repo and select a Solution.', true);
      return;
    }

    const [owner, repo] = repoStr.split('/');
    const paths = await listJsonPathsForSolution(owner, repo, branch, sol);
    if (paths.length === 0) {
      setStatus('No JSON files found in this solution.', true);
      return;
    }

    setStatus(`Fetching & classifying artifacts in "${sol}" ...`);
    const { connectors, dcrs, filesProcessed } = await fetchAndClassify(owner, repo, branch, paths, sol);

    const hunting = await collectHuntingArtifacts(owner, repo, branch, paths);
    enrichWithHuntingAndNormalization(connectors, hunting);

    const maintemplateMeta = await extractMaintemplateMetadata(owner, repo, branch, sol, paths);
    if (!maintemplateMeta) {
      console.warn('Maintemplate.json not found or could not be parsed.');
    }

    // Display metadata in the UI
    const metaDiv = qs('#solutionMeta');
    if (metaDiv) {
      if (maintemplateMeta) {
        metaDiv.innerHTML = `
          <h3 class="text-lg font-semibold border-b pb-1 mb-2">General Solution Metadata</h3>
          <ul class="text-sm space-y-0.5">
            <li><b>Solution Name:</b> ${maintemplateMeta.solutionName}</li>
            <li><b>Contact E-mail:</b> ${maintemplateMeta.contactEmail}</li>
            <li><b>Publisher:</b> ${maintemplateMeta.publisher}</li>
          </ul>
          <h3 class="text-lg font-semibold border-b pb-1 mb-2 mt-4">Connector Details (from Maintemplate)</h3>
          <ul class="list-disc pl-5 text-sm space-y-0.5 max-h-40 overflow-y-auto">
            ${maintemplateMeta.connectors.map(c => `<li><b>${c.name}</b> - Data Type: ${c.dataType}, Mechanism: ${c.mechanism}</li>`).join('')}
          </ul>
          <!-- Other artifacts removed for brevity, but could be added back -->
        `;
      } else {
        metaDiv.innerHTML = `<span class="text-red-700">Maintemplate.json not found or missing required fields.</span>`;
      }
    }

    // Deduplicate connectors by name
    const uniqueConnectors = [];
    const seenNames = new Set();
    for (const c of connectors) {
      if (!seenNames.has(c.name)) {
        uniqueConnectors.push(c);
        seenNames.add(c.name);
      }
    }

    // Build graph with metadata (even if null, to avoid errors)
    const { nodes, links } = toGraphFromConnectors(uniqueConnectors, maintemplateMeta || {});
    const svg = d3.select('svg');
    renderGraph(svg, { nodes, links });
    setStatus(`Done. Files processed: ${filesProcessed}. Rendered ${nodes.length} nodes / ${links.length} links.`, false);
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Error', true);
    // Removed alert() as per instructions
  }
}

/* ===========================
   8) Button bindings
   ===========================*/
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

  // Load D3 check remains for debugging
  if (typeof d3 !== 'undefined') {
    console.log('D3 version:', d3.version);
  } else {
    setStatus('D3 not detected. Ensure d3.min.js is loaded.', true);
  }

  // Set default repo for quick testing
  qs('#repoInput').value = 'Azure/Azure-Sentinel'; 
});
