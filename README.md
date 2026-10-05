# Sentinel Connector / Solution Visualizer

An interactive single‑page tool (`index.html`) for exploring Microsoft Sentinel solution repositories and their packaging structure.  
It fetches JSON artifacts from a GitHub repo, classifies them (connectors, DCRs, analytics rules, hunting queries, workbooks, playbooks, tables, streams, infra), derives metadata, analyzes connector architecture (CCF vs HTTP Data Collector API), and renders a relationship graph. Includes filtering, search, exports, dark mode, and diagnostics.

Live page: https://aymansahmed.github.io/Sentinel-Connector-Visualizer/

---

## 0. What you see after clicking **Visualize**

The page is a plain-language **Solution Insights report** first, and an engineering graph second.

| Section | Answers |
|---|---|
| **Hero summary** | What the solution is, one auto-written sentence on *how it collects data*, publisher / version / support tier |
| **Answer cards** | Where do the logs come from? · How are they collected? · Is an Azure Function involved? · Where does the data land? · What do I need to deploy it? · What do I get? |
| **Data ingestion** | One pipeline per connector: **Source → Collection → Ingestion → Log Analytics tables → Used by**, plus auth, schedule, inputs, prerequisites and the *evidence* behind the classification |
| **Detection & response content** | Analytics rules (severity bar, MITRE ATT&CK heat strip, frequency), hunting queries, workbooks, playbooks (trigger + connectors), parsers, watchlists |
| **Data tables** | Which connector writes each table and which rules/queries/workbooks read it; schema column counts |
| **Good to know** | Legacy ingestion warnings, serverless-vs-Function alternatives, previews, billing notes |
| **Technical map & artifact explorer** | The stage map (below) and the original graph layouts |

### Collection methods the detector reports

| Method | How it is recognised |
|---|---|
| **CCF Pull** | `kind: RestApiPoller` / `pollingConfig` with an `apiEndpoint` request; instances are linked to their definition through `connectorDefinitionName` |
| **CCF Push** | `kind: Push` or the `DeployPushConnectorButton` step (Logs Ingestion API + Entra app) |
| **CCF Pull · Cloud** | `AmazonWebServicesS3`, `GCP`, `StorageAccountBlobContainer` kinds |
| **Azure Function** | `Microsoft.Web/sites` resource, `host.json` / `function.json` / `FunctionApp` packaging, or a title stating *using Azure Functions*. The report also says whether the function writes through the Logs Ingestion API (DCR/DCE) or the legacy Data Collector API |
| **Agent-based** | `CommonSecurityLog` / `Syslog` / Windows data types or `InstallAgent` steps (only when no CCF/Function path is confirmed) |
| **Native integration** | Built-in kinds, tenant-level permissions, Microsoft diagnostic-settings providers |
| **HTTP Data Collector (legacy)** | `/api/logs` or workspace shared-key usage, never reported next to a confirmed CCF path |

Every connector card has a collapsible *"Why was it classified as …?"* panel listing strong/medium signals and the file + JSON path that triggered them.

### Content sources

In addition to JSON, the tool now fetches **YAML** analytics rules, hunting queries and parsers (via `js-yaml`), de-duplicates rules that exist as both YAML and ARM templates, and uses `requiredDataConnectors` as a declared rule→connector link. `Package/mainTemplate.json` build artifacts are ignored when deciding what a connector is.

### Stage map

The technical map is a left-to-right flow — **Data sources → Collection method → Ingestion & transform → Log Analytics tables → Detection & response** — with container-to-container arrows labelled with counts (`18 rules`, `1 table`). Click `+N more…` to expand a group. In this layout **Export JSON** produces the presentation model (`title`, `zones`, `connections`, `legend`); **Export insights JSON** and **Copy summary (Markdown)** are available in the report header.

---

## 1. Quick Start

### Local launch (recommended to avoid `file://` CORS noise)
```powershell
# From repository root
python -m http.server 5500
# or
npx serve .

start http://localhost:5500/index.html
```

### Load a Solution
1. Enter repo as `owner/repo` (e.g. `Azure/Azure-Sentinel`).
2. Branch (defaults to `master`; app can auto-fallback to `main` if enabled).
3. Click “Load Solutions”.
4. Pick a solution directory.
5. Click “Visualize”.

### Interact
- Hover nodes for tooltips.
- Click nodes for detail panels (right side).
- Use filters to hide types; switch layout (Force / Radial / Grid).
- Export JSON / CSV / PNG.
- Search artifacts / nodes via inputs.
- Toggle dark mode.

---

## 2. High-Level Data Flow

User action pipeline inside `handleVisualize()`:

1. Discover all solution JSON and content YAML files (`listSolutionJsonPaths`).
2. Fetch the complete inventory in parallel (`fetchSolutionFiles`); visibility filters no longer limit detection.
3. Classify file artifacts and harvest embedded ARM resources (`classifyArtifact`, `harvestEmbeddedArtifacts`).
4. Normalize, deduplicate, and resolve connector/DCR references (`buildArtifacts`).
5. Extract structured KQL, workbook, DCR, ARM, endpoint, and Logic App references.
6. Analyze architecture (`analyzeSolutionArchitecture`).
7. Build the plain-language insights model — collection method, source, auth, tables, content (`buildSolutionInsights`) — and render the report (`renderInsights`).
8. Build the canonical evidence-backed lineage graph (`buildLineageGraph`) and the stage map (`buildVirtualSolutionView`).
9. Render graph + meta panels, enable exports & search.

---

## 3. Global State Structure

```js
STATE = {
  cache: Map,                 // memoized fetch results
  fetching: false,
  artifacts: {                // produced by buildArtifacts()
    connectors: [], dcrs: [], analytics: [], hunting: [],
    workbooks: [], playbooks: [], watchlists: [],
    functions: [], infra: [], notebooks: [], tables: [],
    streams: [], coreFiles: [], json: []
  },
  meta: {
    solutionName, solutionId, publisher, offerId?,
    categories: [], domains: [],
    mainTemplateResourceCounts: { total, dataConnectors, analyticRules, workbooks, playbooks, others },
    rawSolutionMeta: {}
  },
  solutionAnalysis: { type: 'CCF' | 'HTTP Data Collector API' | 'Unknown', ccfSignals?, httpSignals? },
  fullGraph: { nodes: [], links: [] },  // complete graph
  graph: { nodes: [], links: [] },      // filtered current view
  layoutMode: 'force' | 'radial' | 'grid',
  dark: false,
  highlighted: null,
  showIsolated: true,
  zoom: { x, y, k },
  simulation: null
}
```

---

## 4. Artifact Classification Logic (`classifyArtifact(json, path)`)

Determines a `type` and extracts secondary data.

Priority indicators:
1. Core packaging files:
   - `mainTemplate.json`, `solutionMetadata.json`, `createUiDefinition.json`, `pollerConfig.json`, `dcr.json`,
     function host / app files (`host.json`, `functionApp.json`), `azuredeploy.json`.
2. Data Collection Rule(s) and flows: detect presence of `dataCollectionRules`, `dataFlows`, `streams`.
3. Connector detection:
   - Keywords in `kind` or text: `restapipoller`, `apipolling`, `codeless`, `azurefunction`, `datacollector`
   - `properties.dcrConfig`
   - `connectorUiConfig` presence
   - Fallback: JSON text contains `dataconnector` and typical connector structure.
4. Analytics rules / hunting queries / workbooks / playbooks via path or property hints.
5. Remaining JSON becomes generic `json`.

Extracted fields (when possible):
- `references`: structured KQL references to tables, functions, and watchlists.
- `tables`: Kusto tables referenced by source, join, lookup, union, and custom-table expressions.
- `streams`: For DCR mapping connectors.
- `endpoints`: Host/domain extraction via recursive key + URL scanning.
- `armDependencies`: `dependsOn`, `resourceId`, `subscriptionResourceId`, and `reference` expressions.
- `connections`: Logic App API connections, operation IDs, and HTTP endpoints.
- `metrics`: Query stats (line count, length).
- `publisher`, `domain`, `mechanism` (normalized ingestion type).
- `schedule` for analytics rules.
- `dataFlows` (if present).
- `streamCount`, `tableCount`.

Helper functions:
- `extractTablesFromQuery(query)`
- `extractEndpointsGeneric(obj)`
- `normalizeMechanism(kind, json)`
- `detectKindCategory(json)`

---

## 5. Architecture Detection (`analyzeSolutionArchitecture(art)`)

Evidence-weighted model covering file, connector, core-template, and legacy ingestion signals.

Signals gathered per connector:
- CCF signal set:
  - `dcrConfig` (presence of `properties.dcrConfig`)
  - `apiPoller` (text contains `restapipoller` or `apipolling`)
  - `codeless` (text contains `codeless`)
  - `streams` (connector has defined streams array)
- HTTP Data Collector signal set:
  - `workspaceId+sharedKey` (both substrings)
  - `x-ms-signature` (header pattern)
  - `opinsights-endpoint` (classic ingestion endpoint)
  - `data-collector` (text `datacollector` or mechanism contains `http data collector`)

Decision:
1. Only CCF anchors → `CCF`
2. Only HTTP anchors → `HTTP Data Collector API`
3. Both anchor families → `Mixed`
4. Legacy CEF/Syslog/AMA signals without modern anchors → `Legacy (CEF/AMA)`
5. No decisive anchor → `Unknown`

The result includes confidence, line-level findings, reasoning, and signal catalogs.

Return object:
```js
{ type, confidence, connectors, counts, core, findings, reasoningLines, evidenceLines, signalsCatalog }
```

---

## 6. Graph Model (`buildLineageGraph(artifacts, solutionName, analysis)`)

Node types (example labels):
- `solution`, `connector`, `dependency` (DCR), `table`, `stream`, `workbook`, `analyticrule`, `huntingquery`, `playbook`, `watchlist`, `kqlfunction`, `notebook`, `functioninfra`, `deployment`, `filecore`, `json`, `endpoint` (if surfaced as separate nodes in variants).

Every node has a canonical type-qualified key while retaining a human-readable `displayId`.

Every edge carries:
- relationship type
- confidence score
- source file
- JSON/query location
- detector that produced the relationship

Lineage includes:
- endpoint → connector
- connector → DCR / stream / table
- input stream → DCR flow → output stream / table
- table → parser/function → analytics, hunting, and workbooks
- watchlist/function references from KQL
- playbook → API connection / endpoint
- ARM `dependsOn` resource relationships

All layouts render the same canonical graph:
- Solution Blueprint (default): grouped zones for Data Ingestion, Detection & Analytics, and Response & Visualization.
- Force layout (physics simulation).
- Radial layout (concentric rings by type).
- Grid layout (categorical grouping).

Declared relationships use solid lines. Inferred relationships use dashed/dotted lines according to confidence. Hover an edge to see confidence and detection evidence.

### Solution Blueprint (stage map) JSON

When the default Solution Blueprint layout is active, **Export JSON** produces the presentation model directly. Each `zone` is one stage of the flow (sources → collection → ingestion → tables → detection & response):

```js
{
  title,
  zones: [{
    id,
    label,
    color,
    items: [{
      type: "subcontainer",
      id,
      label,
      color,
      items: [{ type: "row", nodes: [{ id, title, sub, accent, tooltip }] }]
    }]
  }],
  connections: [{ from, to, style, color, label, kind }],   // from/to are container or card ids
  legend: [{ color, style, label }]
}
```

Large groups initially show three to five cards and a `+N more` card. Click it to expand the group in place. Edges are aggregated between containers (for example *"18 rules"* from a table container to the analytics container) so the diagram stays readable.
- Label algorithm wraps text, clamps lines, determines rectangle size, and scales font.

---

## 7. UI & Rendering Functions

| Function | Purpose |
|----------|---------|
| `renderGraph(preserve=false)` | Core render pass; sets SVG groups and layout coordinates. |
| `setupZoom()` | Initializes D3 zoom behavior and stores transform. |
| `fitView()` | Auto-fit viewport to current graph extents. |
| `highlightNode(id)` | Emphasizes neighborhood; dims non-neighbors. |
| `buildLegend()` | Displays color legend for visible types. |
| `buildTypeFilters()` | Renders type checkboxes based on presence. |
| `applyFilters()` | Recomputes filtered `STATE.graph` and triggers re-render. |
| `buildArtifactExplorer()` | Tabular view of flattened artifacts. |
| `applyArtifactSearch()` | Filter rows by text query. |
| `exportJson()` / `exportCsv()` / `exportPng()` | Export actions. |
| `updateSolutionMeta()` | Metadata chip line (architecture, categories, publisher, layout). |
| `buildDesignOverview()` | Compact counts + architecture emphasis. |
| `showConnectorDetails(id)` | Rich connector panel (tables, streams, endpoints). |
| `showArtifactDetails(node)` | Generic artifact detail panel. |

---

## 8. Fetching & GitHub Integration

| Function | Role |
|----------|------|
| `ghHeaders()` | Adds PAT token (if provided) to requests. |
| `fetchJson(url, purpose, tries)` | Cached fetch with retry/backoff (rate limit awareness). |
| `updateRateLimit(response)` | Parses rate-limit headers to inform UI. |
| `detectDefaultBranch(owner, repo)` | Fetches repo metadata to get default branch. |
| `listSolutions(owner, repo, branch)` | Lists directories under `Solutions/`. |
| `listSolutionJsonPaths(owner, repo, branch, solution)` | Uses recursive tree API to gather JSON paths. |
| `fetchSolutionFiles(paths)` | Bulk fetches and returns parsed JSON for each path. |

Caching: `STATE.cache` stores responses keyed by URL for reuse within session.

---

## 9. Utility & Parsing Helpers

| Function | Purpose |
|----------|---------|
| `extractTablesFromQuery(query)` | Regex for table names used in KQL queries. |
| `extractEndpointsGeneric(json)` | Recursively finds URL strings; extracts host part. |
| `summarizeQueryMetrics(query)` | Simple metrics (line count, character length). |
| `normalizeMechanism(kind, json)` | Assigns ingestion mechanism label (poller, codeless, DCR). |
| `detectKindCategory(json)` | Higher-level grouping for connector type classification. |
| `debounce(fn, ms)` | Prevents rapid UI event thrashing. |
| `setDarkMode(on)` | Toggles `.dark` class and variable palette. |
| `toggleLoader(show)` | Shows/hides global loading indicator. |

---

## 10. Styling & Dark Mode

Semantic CSS variables:
```css
:root {
  --bg-panel:#ffffff;
  --bg-page:#f8fafc;
  --border-color:#e2e8f0;
  --text-primary:#1e293b;
  --text-secondary:#475569;
  --text-dim:#64748b;
  --heading-color:#0f172a;
}
body.dark {
  --bg-panel:#1e293b;
  --bg-page:#0f172a;
  --border-color:#334155;
  --text-primary:#e2e8f0;
  --text-secondary:#cbd5e1;
  --text-dim:#94a3b8;
  --heading-color:#f8fafc;
}
```
Applied to panels, labels, and dynamic injected HTML for consistent theme switching.

---

## 11. Export Formats

### JSON
```json
{
  "meta": { "solutionName": "...", "solutionId": "...", "publisher": "...", "mainTemplateResourceCounts": { ... } },
  "artifacts": { "connectors": [...], "dcrs": [...], ... },
  "graph": { "nodes": [...], "links": [...] },
  "solutionAnalysis": { "type": "CCF" },
  "timestamp": "2025-10-17T12:00:00Z"
}
```

### CSV
Two sections (nodes / links) appended one after the other for quick spreadsheet import.

### PNG
Canvas snapshot of current SVG via data URL conversion.

---

## 12. Error & Resilience Model

- Global listeners for `error` and `unhandledrejection` push diagnostics.
- `fetchJson` retries on transient network errors (exponential-ish backoff).
- Rate limit detection (HTTP 403 with zero remaining) can inform UI (basic hinting).
- Filtering logic gracefully handles missing or empty arrays.

---

## 13. Extensibility Points

| Area | Idea | Notes |
|------|------|-------|
| Architecture | Add weighting or thresholds (e.g., treat `dcrConfig` + `apiPoller` > all HTTP signals) | Reintroduce confidence only if needed. |
| Endpoints | Host frequency table | Build global Set `endpoint→count`. |
| Performance | Node clustering for large solutions | Pre-group analytic/hunting into “bundle” nodes. |
| Security | Secret pattern masking | Regex for `key=`, `token=`, etc. |
| Accessibility | Keyboard node traversal | Maintain index, arrow-key navigation. |
| Testing | Fixture-based heuristics tests | Node script scanning sample JSON directories. |

---

## 14. Contributing Guidelines

1. Keep classification logic pure (no DOM operations inside classifiers).
2. Comment new heuristics with concise rationale (avoid guesswork).
3. Prefer small incremental patches over large rewrites.
4. Include before/after artifact counts or architecture outputs in PR summary.
5. Avoid introducing runtime dependencies without documenting CDN vs local usage.

---

## 15. Minimal Architecture Function Reference

Current implementation (simplified signal count):
```js
function analyzeSolutionArchitecture(art) {
  const strongCcf = new Set();
  const strongHttp = new Set();
  (art.connectors || []).forEach(c => {
    const raw = c.raw || {};
    const txt = JSON.stringify(raw).toLowerCase();
    const hasDcrConfig = !!raw?.properties?.dcrConfig;
    const hasStreams = Array.isArray(c.streams) && c.streams.length > 0;
    const mechanism = (c.mechanism || '').toLowerCase();
    if (hasDcrConfig) strongCcf.add('dcrConfig');
    if (/restapipoller|apipolling/.test(txt)) strongCcf.add('apiPoller');
    if (/codeless/.test(txt)) strongCcf.add('codeless');
    if (hasStreams) strongCcf.add('streams');
    if (/workspaceid/.test(txt) && /sharedkey/.test(txt)) strongHttp.add('workspaceId+sharedKey');
    if (/x-ms-signature/.test(txt)) strongHttp.add('x-ms-signature');
    if (/opinsights\.azure\.com/.test(txt)) strongHttp.add('opinsights-endpoint');
    if (/datacollector/.test(txt) || mechanism.includes('http data collector')) strongHttp.add('data-collector');
  });
  let type = 'Unknown';
  if (strongCcf.size && !strongHttp.size) type = 'CCF';
  else if (strongHttp.size && !strongCcf.size) type = 'HTTP Data Collector API';
  else if (strongCcf.size && strongHttp.size) {
    if (strongCcf.size > strongHttp.size) type = 'CCF';
    else if (strongHttp.size > strongCcf.size) type = 'HTTP Data Collector API';
    else type = 'CCF';
  }
  return { type, ccfSignals: [...strongCcf].sort(), httpSignals: [...strongHttp].sort() };
}
```

---

## 16. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| “No JSON files found” | Wrong branch name | Change branch or enable branch auto-detect. |
| Architecture always Unknown | Connectors lack signals | Verify presence of `dcrConfig` or HTTP ingestion markers. |
| Graph labels overlapping | Long names or too many nodes | Switch to grid layout or increase wrap width. |
| CORS errors locally | Opening via `file://` | Use local HTTP server. |
| Rate limit errors | Many unauthenticated GitHub calls | Provide a PAT token (repo scope). |

---

## 17. License

(Consider adding `LICENSE` file; recommend MIT for broad reuse.)

---

## 18. Disclaimer

> ⚠ **DISCLAIMER**  
> This visualizer uses heuristic pattern matching for architecture inference (CCF vs HTTP Data Collector API), metadata derivation, and relationship building. It can produce false positives/negatives or miss emerging patterns.  
> Do not rely on its output alone for compliance, security, or architectural decisions. Validate against:
> 1. Official Microsoft Sentinel / Azure documentation  
> 2. Actual deployed resources  
> 3. Source JSON and revision history  
> 4. Internal review/approval workflows  
> No warranty; maintainers accept no liability for actions taken based on this tool.

---

## 19. Appendix (Optional Future Improvements)

Weighted architecture example (if reintroduced):
- Score each signal (e.g., `dcrConfig=3`, `apiPoller=2`, `streams=1`, HTTP `workspaceId+sharedKey=2`, `opinsights-endpoint=2`).
- Compare aggregate scores; classify when difference exceeds threshold (e.g., ≥2 point margin).
- Provide debug array `archDetails` listing matched signals + weights.

Not currently implemented to keep UI simple; add only if necessary.
