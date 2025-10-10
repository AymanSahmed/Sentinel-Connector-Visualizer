# Sentinel Connector Visualizer

An interactive single‑page tool for exploring Microsoft Sentinel solution repositories.  
It fetches solution artifacts directly from a GitHub repo, classifies them (connectors, DCRs, tables, analytics rules, hunting queries, workbooks, playbooks, infra, deployments, etc.), builds a relationship graph, and analyzes connector architecture (CCF vs Legacy). Includes filtering, search, exports, dark mode, and diagnostics.

Go to  : https://aymansahmed.github.io/Sentinel-Connector-Visualizer/ 

# Sentinel Solution Dependency Visualizer

An interactive single‑page tool (`index.html`) for exploring Microsoft Sentinel “Solution” packages directly from a public (or private with PAT) GitHub repository.  
It inspects a solution’s `/Solutions/<SolutionName>/Package/` folder, classifies artifacts (connectors, DCRs, analytics, workbooks, playbooks, hunting queries, core packaging JSON files, etc.), derives metadata (resource counts, endpoints, tables, metrics), and renders a graph with adaptive labels.

---

 Quick Start

# 1. Launch (local)
Because the page fetches GitHub HTTPS resources it’s best to serve via HTTP (not `file://`):

```powershell
# From repository root
python -m http.server 5500
# or
npx serve .

# Then open:
start http://localhost:5500/index.html
```

(You can double‑click `index.html`, but you’ll see CORS warnings for local Tailwind fallback probes.)

# 2. Load a Solution
1. Enter `Azure/Azure-Sentinel` or another `owner/repo`.
2. Keep / adjust branch (defaults to `master`, will auto‑fallback to `main` if not found if auto-detect is enabled).
3. Click Load Solutions.
4. Select a solution from the dropdown.
5. Click Visualize.

# 3. Interact
- Hover nodes for tooltips.
- Click a node to see details (right panel tabs).
- Use “Filters & Layout” panel to hide types, change layout (Force / Radial / Grid).
- Use Export buttons (JSON / CSV / PNG).
- Search nodes / artifacts with the provided inputs.

---

 Core Concepts

| Concept | Description |
|---------|-------------|
| Core Files | Packaging JSONs: `mainTemplate.json`, `solutionMetadata.json`, `createUiDefinition.json`, `pollerConfig.json`, `dcr.json`, function host files, `azuredeploy.json`. |
| Artifacts | Functional or security content: connectors (codeless/poller/HTTP), DCRs, analytics, workbooks, hunting queries, playbooks, function infra, deployment files, generic JSON. |
| Graph Nodes | One node per artifact or resource set (plus root “solution” node). |
| Graph Links | Root → each artifact; semantic edges (connector→table, connector→stream, connector→DCR, DCR→table, table→analytic/workbook/hunting, etc.). |
| Metadata Chips | Architecture (CCF or HTTP Data Collector API) and Published (Content Hub packaging heuristics). |
| STATE | Global state object (caches, loaded artifacts, graph, UI flags). |

---

 STATE Structure

```js
STATE = {
  cache: Map,                 // memoized fetch results
  includeNonCore: true,
  layoutMode: 'force' | 'radial' | 'grid',
  degreeScaled: false,
  showEdgeLabels: false,
  zoom: { x, y, k },
  simulation: d3 force simulation or null,
  dark: false,
  freezeAfter: false,
  showIsolated: true,
  highlighted: nodeId | null,
  fetching: false,
  artifacts: { ...classified groups... },
  meta: { solutionName, solutionId, publisher, contactEmail, mainTemplateResourceCounts, publishedHeuristic, rawSolutionMeta? },
  fullGraph: { nodes, links },
  graph: { nodes, links }     // filtered working copy
  solutionAnalysis: { type: 'CCF' | 'HTTP Data Collector API' | '' },
  contentHubPublishing: { published: true, contentHubId?, version?, listingId? } | null
}
```

---

 Data Flow (High Level)

1. User clicks Load Solutions → `handleLoadSolutions()`:
   - Parses `owner/repo`.
   - (Optional auto branch detect).
   - Calls `listSolutions()` to fetch directories under `Solutions/`.
   - Populates solution select list.

2. User clicks Visualize → `handleVisualize()`:
   - Lists JSON paths: `listSolutionJsonPaths()`.
   - Fetches JSON files: `fetchSolutionFiles()`.
   - Classifies each: `classifyArtifact()`.
   - Aggregates: `buildArtifacts()`.
   - Extracts meta: `extractSolutionMeta()`.
   - Derives architecture: `analyzeSolutionArchitecture()`.
   - Publishing heuristics inline.
   - Builds graph: `buildGraph()`.
   - UI update: filters, legend, tables, solution meta.

3. Graph render: `renderGraph()` (force, radial, or grid) + adaptive label packing + tooltips.

4. Interaction: selection, highlighting, filtering modifies `STATE.graph` and triggers re-render.

---

 Classification Logic

# `classifyArtifact(json, path)`
Determines a `type` with priority:

1. `mainTemplate.json` → `filecore` (extract all nested resources; counts of connectors, analytic rule deployments, workbooks, playbooks, others).
2. `solutionMetadata.json` → `filecore` (captures version, listingId, contentHubId).
3. `createUiDefinition.json`, `pollerConfig.json`, `dcr.json`, `host.json`, `functionapp.json`, `azuredeploy.json`.
4. DCR‑like detection: presence of `dataCollectionRules` or `dataFlows`.
5. Connector detection via heuristics: 
   - `kind` contains `restapipoller|apipolling|codeless|azurefunction|datacollector`
   - `properties.dcrConfig`
   - `connectorUiConfig` presence
   - JSON text includes `dataconnector`
6. Workbooks / analytics / hunting queries / playbooks via path or property cues.
7. Remaining JSON → `json`.

Adds extracted fields (tables, streams, endpoints, metrics, domain, publisher, schedule, dataFlows, streamCount).

# Table Extraction
`extractTablesFromQuery()` uses regex to capture:
- `<Something>_CL`
- `<Something>Events`
- Known sentinel built-ins (CommonSecurityLog, Syslog, SecurityAlert, SecurityIncident).

# Endpoint Extraction
`extractEndpointsGeneric()` recursively walks object, capturing `http/https` in:
- Keys ending with `(endpoint|url|host|apiRoot|apiEndpoint|tokenUrl|authUrl)`
- Any string with an `http(s)://` substring → host portion deduped.

---

 Architecture Detection

# Current Implemented Heuristic (`analyzeSolutionArchitecture`)
- Collects “CCF signals”:
  - Any DCR file present
  - mainTemplate resources for `dataCollectionRules`, `dataCollectionEndpoints`, `dataCollectionRuleAssociations`, `.../dataConnectors`
  - Connector `properties.dcrConfig`
  - Connector `connectorUiConfig`
  - Connector kind/mechanism keywords: `restapipoller|apipolling|codeless|dcr|ccf|ingestion`
- Collects “HTTP signals” (only if no CCF found):
  - workspaceId + sharedKey
  - opinsights / oms endpoint
  - function infra nodes
  - textual tokens `http data collector`, azure function indicators
  - HTTP ingestion signatures `/api/logs?`, `x-ms-date`, `x-ms-signature`

Decision:
- If ANY CCF signal → `CCF`
- Else if ANY HTTP signal → `HTTP Data Collector API`
- Else blank (no chip)

# Limitations
- “codeless” or “ingestion” in unrelated context can falsely mark CCF.
- A solution with both classic HTTP indicators and a single weak CCF word is forced to CCF (no weighting).
- Doesn’t verify actual DCR dependency cross‑references (e.g., streams used by connector).

# Recommended (Optional) Improved Scoring (not yet integrated if you haven’t patched)
(See previous assistant message for a drop‑in replacement scoring version.)

---

 Publishing (Content Hub) Heuristic

Set in `handleVisualize()`:
- Positive detection if both `solutionMetadata.json` and `createUiDefinition.json` exist AND one of (contentHubId | listingId | version) present.
- Only shows chip “Published: Yes”; no negative state chip to reduce noise.

---

 Metadata Extraction

# `extractSolutionMeta(owner,repo,branch,solution,paths)`
Loads `mainTemplate` and `solutionMetadata` if present.
Heuristics:
- `solutionName` from solutionMetadata `name`, or mainTemplate parameters `SolutionName|solutionName`, or fallback to directory name.
- `solutionId` from `contentHubId`, `solutionId`, `listingId`, `id`, or GUID regex fallback in solutionMetadata JSON.
- `publisher` from `publisherName|publisherId|publisher|author|providers` or `Publisher` parameter.
- `contactEmail` from several fields or first email regex match.
- Resource counts (connectors, analytic rules, workbooks, playbooks, others) from `mainTemplate.resources`.

---

 Graph Construction

# `buildGraph(artifacts, solutionName)`
Nodes:
- Root solution node
- Core files (`filecore`)
- Connectors (`connector`)
- DCRs (as `dependency`)
- Tables (deduplicated; connectors/DCRs/analytics/workbooks/hunting link into tables)
- Streams (`stream`)
- Analytics (`analyticrule`), Workbooks (`workbook`), Hunting queries (`huntingquery`), Playbooks (`playbook`)
- Function infra, Deployment, JSON others (limited to first ~60 to avoid noise)

Links:
- Root → each artifact (typed edges)
- connector → table / stream / DCR
- DCR → table
- table → analytics / workbook / hunting

# Node Label Strategy
Adaptive:
1. Build semantic lines (key fields).
2. Wrap lines to a target character width.
3. Clip to max lines (ellipsis).
4. Compute rectangle width from longest rendered line.
5. Font scaling for overlong lines.

---

 Rendering & Interaction

| Function | Purpose |
|----------|---------|
| `renderGraph(preserve=false)` | Main draw routine; builds SVG groups, sets force / radial / grid layout. |
| `setupZoom()` | Initializes D3 zoom/pan with stored transform in `STATE.zoom`. |
| `fitView()` | Auto fits current filtered nodes in viewport. |
| `highlightNode(id)` | Dims non-neighbor nodes and edges around a highlighted node. |
| `buildTooltip()` | Creates custom tooltip with artifact-specific metadata lines. |
| `applyFilters()` | Filters nodes by active checkboxes + isolated toggle; rebuilds `STATE.graph`; calls `renderGraph()`. |
| `buildTypeFilters()` | Renders the checkbox list for all present node types. |
| `buildLegend()` | Shows legend for types present in current filtered graph. |

---

 Artifact Explorer (Table)

Functions:
- `buildArtifactExplorer()` – Flattens artifacts into rows (with derived detail column).
- `applyArtifactSearch()` – Text filter.
- `buildArtifactTypeQuickFilters()` – Quick type-based filter buttons.
- Sorting via clickable `<th data-sort="...">`.

---

 Details Panels

| Function | Description |
|----------|-------------|
| `showConnectorDetails(id)` | Populates the "Connector Details" panel with domain, metrics, endpoints, tables, streams. |
| `showArtifactDetails(node)` | Populates “Artifact/File” tab with generic & type-specific metadata. |
| `updateSolutionMeta()` | Renders chips and summary counts (architecture, publish, resource ratios). |

---

 Export Functions

| Function | Output |
|----------|--------|
| `exportJson()` | JSON structure: `{ meta, artifacts, graph, solutionAnalysis, contentHubPublishing? }`. |
| `exportCsv()` | Two CSV sections (nodes / links). |
| `exportPng()` | Renders current SVG into PNG (Canvas + base64). |

---

 Network / GitHub API Utilities

| Function | Purpose |
|----------|---------|
| `ghHeaders()` | Adds PAT if provided; sets Accept header. |
| `updateRateLimit(res)` | Reads rate limit headers for display. |
| `fetchJson(url, purpose, tries)` | Resilient fetch with retry/backoff & caching. |
| `detectDefaultBranch(owner,repo)` | GET repo metadata to obtain default branch. |
| `listSolutions(owner,repo,branch)` | Lists directories under `Solutions/`. |
| `listSolutionJsonPaths(owner,repo,branch,solution)` | Uses recursive tree API to list JSON file paths. |

---

 Misc / Utilities

| Function | Description |
|----------|-------------|
| `extractEndpointsGeneric(json)` | Host extraction (unique up to 12). |
| `extractTablesFromQuery(query)` | Regex parse Kusto table usage. |
| `summarizeQueryMetrics(query)` | Lines + length. |
| `normalizeMechanism(kind,json)` | Returns mechanism classification (API Polling, CCF UI, CCF DCR, Logs Ingestion API, etc.). |
| `detectKindCategory(json)` | Higher-level “kind category” visible in tooltips / connector metadata. |
| `debounce(fn, ms)` | Standard debounce wrapper for search inputs. |
| `setDarkMode(on)` | Toggle dark mode + persist preference. |
| `handleLoadSolutions()` | Orchestrates solution enumeration. |
| `handleVisualize()` | Orchestrates full artifact load & graph build. |
| `handleReset()` | Clears state & UI. |

---

 Error Handling & Resilience

- Global `window.error` / `unhandledrejection` listeners log to diagnostics panel.
- Rate limiting: if status 403 and `x-ratelimit-remaining=0`, waits until reset time approximate (simple backoff).
- Retry logic in `fetchJson` with incremental delay.
- Filtering & rendering functions tolerate empty or missing state segments.

---

 Known Limitations

| Area | Limitation | Potential Improvement |
|------|------------|-----------------------|
| Architecture classification | Over-eager CCF when “codeless” or “ingestion” appears without DCR | Adopt weighted scoring (see improved heuristic notes). |
| Endpoint extraction | Host-only, no dedup across all artifacts beyond 12 per JSON | Global endpoint summary panel. |
| Table detection | Regex heuristics may miss variant Kusto naming | Parse official schema / use Kusto parser (heavier). |
| Performance | Force layout may be slow with very large solutions (>500 nodes) | On-demand clustering, virtual collapsing for dense table sets. |
| Security | No secret scrubbing beyond plain fetch; assumes public repo | Add mask for suspicious key patterns. |

---

 Extending

# Add Architecture Strict Mode
Wrap current classification with a toggle:

```js
const STRICT_CCF = true;
if(STRICT_CCF){
  // Only treat as CCF if dcrConfig present OR actual dataCollectionRule resource
}
```

# Add Severity / Tactics Chips
Aggregate from analytic rules and render in `updateSolutionMeta()`.

# Add Endpoint Explorer
Accumulate all `endpoints` into a Set and show a table (domain + count + artifact list).

# Add Graph Search Highlight
Mark all matching nodes instead of first match (alter `nodeSearch` handler).

---

 Export Format (JSON)

Example structure:

```json
{
  "solution": {
    "solutionName": "SampleSolution",
    "solutionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "publisher": "Contoso",
    "contactEmail": "security@contoso.com",
    "mainTemplateResourceCounts": {
      "total": 42,
      "dataConnectors": 1,
      "analyticRules": 5,
      "workbooks": 2,
      "playbooks": 1,
      "others": 33
    }
  },
  "analysis": { "type": "CCF" },
  "publishing": { "published": true, "contentHubId": "..." },
  "graph": {
    "nodes": [ {"id":"__solution__", "type":"solution"}, ... ],
    "links": [ {"source":"__solution__", "target":"ConnectorX","edgeType":"solution-connector"}, ... ]
  }
}
```

---

 Tailwind & D3 Loading

The page attempts:
1. Local Tailwind CSS file(s) via HEAD (for dev) – suppressed when served as `file://`.
2. Falls back to CDN `cdn.tailwindcss.com`.
3. Loads D3 from `cdnjs.cloudflare.com`, fallback to `unpkg`.

If you want deterministic offline builds:
- Replace dynamic Tailwind loader with a static built CSS.
- Vendor D3 locally and reference by relative path.

---

 Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| “Load Solutions” does nothing | Syntax error earlier or `STATE` undefined | Open console, fix first red error, ensure STATE defined & exposed. |
| All solutions show blank architecture | Heuristic found no signals | Confirm presence of dcrConfig or workspaceId/sharedKey; patch heuristic. |
| Graph clipped / labels overflowing | Extreme long identifiers | Increase `lineCharTarget` or widen `maxWidth` in label config. |
| Rate limit messages | GitHub API unauthenticated | Add PAT token (repo scope) in token input. |
| “No JSON files found” | Wrong branch / path | Check branch; some repos use `main`. Use auto-detect or change manually. |

---

 Function Inventory (Alphabetical Quick Reference)

| Function | Category |
|----------|----------|
| analyzeSolutionArchitecture | Classification (architecture) |
| applyArtifactSearch | UI / Table |
| applyFilters | Graph filtering |
| buildArtifactExplorer | UI / Table |
| buildArtifactTypeQuickFilters | UI / Table |
| buildArtifacts | Classification aggregation |
| buildGraph | Graph construction |
| buildLegend | UI |
| buildTooltip | UI / Graph |
| buildTypeFilters | UI |
| classifyArtifact | Artifact classification |
| debounce | Utility |
| detectDefaultBranch | GitHub API |
| detectKindCategory | Connector inference |
| extractEndpointsGeneric | Parsing |
| extractSolutionMeta | Metadata extraction |
| extractTablesFromQuery | Parsing |
| exportCsv | Export |
| exportJson | Export |
| exportPng | Export |
| fetchJson | Networking + caching |
| fetchSolutionFiles | Download artifacts |
| fitView | Graph layout |
| ghHeaders | Networking |
| handleLoadSolutions | User action pipeline |
| handleReset | UI reset |
| handleVisualize | Main load pipeline |
| highlightNode | Graph interaction |
| listSolutionJsonPaths | GitHub API (tree) |
| listSolutions | GitHub API (listing) |
| log | Diagnostics |
| normalizeMechanism | Connector inference |
| renderGraph | Graph rendering pipeline |
| setDarkMode | Theming |
| setupTabs | UI tabs |
| setupZoom | Graph interactions |
| showArtifactDetails | Details panel |
| showConnectorDetails | Details panel |
| summarizeQueryMetrics | Parsing |
| toggleLoader | UI state |
| updateRateLimit | Networking |
| updateSolutionMeta | Meta panel |
| wrapLogical (inner helper) | Label formatting |

---

 Future Enhancements (Suggested Roadmap)

1. Weighted architecture scoring (already drafted).
2. Endpoint explorer + dedup host frequency.
3. Table usage heatmap (node sizing by references).
4. Lazy “expand tables” toggle to declutter.
5. Offline bundle (no external CDN) and integrity checks.
6. Unit tests for classification heuristics (Node script scanning sample JSON fixtures).
7. Accessibility: ARIA roles for panels, keyboard navigation for nodes.

---

 Contributing

1. Fork & clone.
2. Run a local server (see Quick Start).
3. Make changes in `index.html` (single page).
4. If adding logic complexity:
   - Keep heuristics pure (no DOM manipulation inside classification).
   - Add comments summarizing new heuristics.
5. Open PR with:
   - Summary of changes
   - Screenshots of UI
   - Before/after node count and any performance considerations.

---

 License / Use

No explicit license file included in this repository snapshot.  
Add a `LICENSE` file (e.g., MIT) if you plan to distribute externally.

---

 Disclaimer

Heuristics provided are best‑effort inference and not authoritative indicators of ingestion architecture. Always verify connector ingestion design via official Microsoft Sentinel documentation or code artifacts.

---

 Appendix: Optional Improved Architecture Function (Scoring)

If you adopt the enhanced scoring approach (recommended to reduce false CCF):

```js
// Drop-in replacement for analyzeSolutionArchitecture (see earlier explanation)
function analyzeSolutionArchitecture(art){
  /* ... improved scoring version from documentation above ... */
}
```

Integrate and test across a mix of known pure HTTP, hybrid, and confirmed CCF solutions; adjust thresholds if false positives remain.

---

Happy hunting & visualizing!