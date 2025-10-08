# Sentinel Connector Visualizer

An interactive single‑page tool for exploring Microsoft Sentinel solution repositories.  
It fetches solution artifacts directly from a GitHub repo, classifies them (connectors, DCRs, tables, analytics rules, hunting queries, workbooks, playbooks, infra, deployments, etc.), builds a relationship graph, and analyzes connector architecture (CCF vs Legacy). Includes filtering, search, exports, dark mode, and diagnostics.

---

Core Features

- Automatic GitHub repo & branch discovery (with fallback if branch not specified)
- Bulk solution loading & multi-selection
- Artifact auto-classification (file path + content heuristics)
- Connector architecture analyzer:
  - CCF / Legacy / Mixed / Unknown with reasoning list
- Interactive D3 graph:
  - Force / Radial / Grid layouts
  - Zoom, pan, node highlighting, edge labels toggle
- Filters:
  - Artifact types, search (debounced), node degree scaling
- Artifact Explorer table:
  - Sort, quick-type buttons, search-as-you-type
- Detail panels:
  - Connector details vs generic artifact metadata
- Export:
  - JSON (full internal state subset)
  - CSV (artifact inventory)
  - PNG (graph snapshot)
- Dark mode (persisted)
- Rate limit awareness & caching
- Robust script loading with D3 fallback and Tailwind strategies
- Optional GitHub token (improves rate limit & private repos)

---

Connector Architecture Analyzer

The analyzer inspects solution artifacts to infer implementation style:

| Classification | Meaning |
| -------------- | ------- |
| CCF            | Cloud Connector Framework patterns (DCR, data collection rules, function app scaffolding) |
| Legacy         | Classic polling/connectors (e.g., `pollerConfig.json`, legacy ingestion) |
| Mixed          | Both CCF & Legacy signals present |
| Unknown        | Insufficient indicators |

Heuristics include presence of:
- `DCR.json` / `DataCollectionRule` assets
- `host.json`, `function.json`, or function app scaffolding
- `pollerConfig.json`
- `connectorUiConfig` patterns
- `dcrConfig` or ingestion mappings

The result is shown as a badge with expandable reasons.

---

Data Model (Simplified)

```
STATE {
  repo, branch
  solutions[]                // selected solution paths
  rawFiles[]                 // fetched file blobs (path, content)
  artifacts[]                // classified items with type + meta
  graph { nodes[], links[] } // built from artifacts & relationships
  connectorAnalysis { type, reasons }
  options { layout, filters..., darkMode, ... }
  cache { path -> content }
}
```

Graph node categories: `connector`, `dcr`, `table`, `analyticrule`, `huntingquery`, `workbook`, `playbook`, `deployment`, `infra`, `generic`, etc.

---

Quick Start

# 1. Clone / Download

```powershell
git clone https://github.com/AymanSahmed/Sentinel-Connector-Visualizer.git
cd Sentinel-Connector-Visualizer
```

# 2. Serve (Recommended)

Some browsers restrict `file://` fetch + module behaviors. Use a simple local server:

PowerShell (built-in Python if installed):
```powershell
python -m http.server 8080
```

Or Node (if available):
```powershell
npx http-server -p 8080
```

Then open:
```
http://localhost:8080/index.html
```

You can also double-click `index.html`, but API calls may behave differently under `file://`.

---

(Optional) GitHub Token

Unauthenticated GitHub API calls are rate limited (~60/hour).  
Create a fine-scoped Personal Access Token (classic – repo read only or no scopes for public repos) and paste it into the token field (if present) or extend the code to include an `Authorization` header.

---

Tailwind CSS Strategy

You have three options:

1. Static Build (Recommended – no FOUL flash):
   - Install Tailwind toolchain temporarily:
     ```powershell
     npm init -y
     npm install -D tailwindcss@latest postcss autoprefixer
     npx tailwindcss init
     ```
   - Create `tailwind.css`:
     ```css
     @tailwind base;
     @tailwind components;
     @tailwind utilities;
     ```
   - Build:
     ```powershell
     npx tailwindcss -i .\tailwind.css -o .\dist\tailwind.build.css --minify
     ```
   - Reference in `index.html`:
     ```html
     <link rel="stylesheet" href="dist/tailwind.build.css">
     ```

2. CDN (Fast prototyping):
   ```html
   <script src="https://cdn.tailwindcss.com?plugins=forms,typography"></script>
   ```
   (May cause a first-paint unstyled flash.)

3. Minimal Critical CSS + Deferred Tailwind:
   - Keep a small inline CSS block for layout grid + spacing.
   - Load Tailwind asynchronously and replace a `tw-pending` class gate.

Pick one; remove unused loaders for clarity once stable.

---

Exports

| Type | What You Get |
| ---- | ------------- |
| JSON | Artifacts, graph nodes/links, analysis summary |
| CSV  | Flat table of artifacts (id, type, path, name, meta) |
| PNG  | Canvas snapshot of current graph viewport |

---

Usage Flow

1. Enter GitHub repo (e.g., `Azure/Azure-Sentinel`)
2. (Optional) Pick / verify branch (auto-detects `main` / `master`)
3. Click Load Solutions → solution list populates (if applicable)
4. Select one or more solutions
5. Click Visualize
6. Inspect:
   - Graph interactions (hover, drag, zoom)
   - Artifact Explorer search/sort
   - Architecture badge + reasons
7. Use filters / layout switches
8. Export if needed

---

Testing Ideas (Manual)

| Action | Expected |
| ------ | -------- |
| Load invalid repo | Clear error message |
| Load valid repo w/out solutions | Graceful empty state |
| Select multi solutions | Combined artifacts in graph |
| Toggle dark mode | Persisted after refresh |
| Export JSON | Download with `artifacts` + `graph` |
| Architecture analyzer on known CCF connector | Badge = CCF with DCR reason |

---
Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| Layout flashes unstyled | Tailwind runtime delay | Use static build or opacity gate |
| Graph empty | No connectors / classification mismatch | Check console logs (global error handler outputs) |
| Rate limit errors (403) | Unauthenticated burst calls | Add GitHub PAT |
| D3 not defined | CDN blocked / integrity mismatch | Ensure fallback loader present |
| Slow large repo scan | Full tree recursion | Narrow repo path or add caching layer (future enhancement) |



---

Contributions

Feel free to open issues with:
- Repo name + branch
- Reproduction steps
- Console log excerpts (redacted if needed)

Pull Requests:
1. Fork & branch
2. Keep changes modular
3. Run a local visual sanity check
4. Describe classification / analyzer impacts

---

Architecture Overview

```
[GitHub API]
    |
    v
 fetchJson() --> rawFiles[] --> classifyArtifact() --> artifacts[]
                                           |               |
                                           v               v
                                 analyzeSentinelConnector()  buildGraph()
                                           |                     |
                                           v                     v
                                   connectorAnalysis       graph{nodes,links}
                                           |                     |
                                           +---------- update UI / Panels ----+
```

Event flow:
- User click → async fetch → build state → render graph → attach interactions.

---

 🧪 Minimal Dev Touchpoints

Change heuristics:
- Edit `analyzeSentinelConnector()` to refine signals.

Add a new artifact type:
1. Extend `classifyArtifact()`
2. Adjust legend / filters builder
3. Optionally style nodes (node color mapping)

---

 🔐 Security Notes

- Avoid committing any PAT.
- All fetches are client-side; no secret backend.
- Large repositories may expose rate limit—use throttling if expanding.

---

 🧼 Production Hardening (Optional)

- Remove verbose console logging
- Pre-bundle critical JS (esbuild / rollup) → single minimized file
- Static Tailwind build + purge paths
- Subresource Integrity (SRI) only after confirming correct hashes

---

 🗣 Attribution / Credits

- D3.js
- Tailwind CSS
- GitHub REST API
- Microsoft Sentinel (solution schema inspiration)

---

 ✅ Quick One-Liner (Static Tailwind Build Example)

```powershell
npx tailwindcss -i .\tailwind.css -o .\dist\tailwind.build.css --minify; Start-Process http://localhost:8080
```

---

Happy exploring your Sentinel connectors! Open an issue or ask for a “slim prod build” version if you’d like that next.