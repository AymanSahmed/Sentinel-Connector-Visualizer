# Sentinel Solution Dependency Visualizer
https://aymansahmed.github.io/Sentinel-Connector-Visualizer/

 Overview

The Sentinel Solution Dependency Visualizer is a web-based tool designed to help users explore, analyze, and understand the dependencies and metadata of Microsoft Sentinel solutions and connectors directly from the [Azure/Azure-Sentinel](https://github.com/Azure/Azure-Sentinel) GitHub repository. It provides an interactive graph visualization of connectors, Data Collection Rules (DCRs), tables, workbooks, and analytic rules, making it easier to audit and comprehend solution architectures.

 Features

- GitHub Integration: Load solutions from any branch of the Azure Sentinel repo using a GitHub Personal Access Token (PAT) if needed.
- Metadata Extraction: Automatically extracts and displays solution metadata (name, publisher, contact email) and connector details.
- Connector & DCR Visualization: Visualizes connectors, DCRs, tables, and their relationships in a force-directed graph.
- Dynamic Node Sizing: Node height adapts to content, ensuring readability; width remains fixed for layout consistency.
- Detailed Tooltips: Hovering over any node displays a tooltip with relevant details (e.g., connector mechanism, tables, streams, workbooks).
- Connector Details Panel: Select a connector to view its technical classification, data flow, source, streams, tables, and linked artifacts.
- Workbooks & Analytics Rules: Displays linked workbooks and analytic rules, including queries and normalization tokens.
- No Backend Required: All logic runs client-side in the browser; no server setup needed.

 How to Use

1. Open `index.html` in your browser.
2. Enter GitHub Details:
   - Specify the repo (default: `Azure/Azure-Sentinel`).
   - Choose a branch (default: `master`).
   - Optionally, provide a GitHub PAT for private or rate-limited access.
3. Load Solutions: Click "Load Solutions" to fetch available solutions.
4. Visualize: Select a solution and click "Visualize" to render the dependency graph.
5. Explore:
   - Select connectors to view details.
   - Hover over nodes for tooltips.
   - Drag nodes to rearrange the graph.

 File Structure

- `index.html` – Main application file containing all HTML, CSS, and JavaScript logic.
- No external JS or CSS files required; all dependencies are loaded via CDN.

 Technologies Used

- D3.js – For interactive graph visualization.
- Tailwind CSS – For modern, responsive UI styling.
- HTML5/JavaScript (ES6+) – Core application logic.

 Customization

- You can modify the UI, graph layout, or metadata extraction logic directly in `index.html`.
- To use with other Sentinel solution repositories, change the repo and branch fields.

 License

This project is provided for educational and research purposes. Please review the Azure Sentinel repository's license for usage of solution data.

 Credits

Developed by [Ayman Sahmed](https://github.com/AymanSahmed) and contributors. Powered by open-source libraries.
