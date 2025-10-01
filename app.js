async function loadGraph() {
  const repo = document.getElementById('repoInput').value.trim();
  if (!repo.includes('/')) {
    alert('Enter a valid repo like Azure/Azure-Sentinel');
    return;
  }

  const [owner, name] = repo.split('/');
  const url = `https://api.github.com/repos/${owner}/${name}/contents/DataConnectors`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const files = await res.json();

    if (!Array.isArray(files) || files.length === 0) {
      alert('No DataConnectors folder or JSON files found in this repo.');
      return;
    }

    const nodes = [], links = [];
    const nodeMap = {};

    function addNode(id, type) {
      if (!nodeMap[id]) {
        nodeMap[id] = { id, type };
        nodes.push(nodeMap[id]);
      }
    }

    for (const file of files) {
      if (file.name.endsWith('.json')) {
        const raw = await fetch(file.download_url).then(r => r.json());
        const connectorName = raw.properties?.connectorUiConfig?.title || file.name;
        const publisher = raw.properties?.connectorUiConfig?.publisherName || 'Unknown';

        addNode(connectorName, 'connector');
        addNode(publisher, 'source');
        links.push({ source: publisher, target: connectorName });
      }
    }

    if (nodes.length === 0) {
      alert('No connectors found in JSON files.');
      return;
    }

    drawGraph(nodes, links);
  } catch (err) {
    console.error(err);
    alert('Error fetching data. Check console for details.');
  }
}

function drawGraph(nodes, links) {
  const svg = d3.select('svg');
  svg.selectAll('*').remove();

  const width = window.innerWidth;
  const height = window.innerHeight * 0.9;

  const color = d => d.type === 'connector' ? '#ff7f0e' : '#1f77b4';

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2));

  const link = svg.append('g')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6)
    .selectAll('line')
    .data(links)
    .enter().append('line')
    .attr('stroke-width', 1.5);

  const node = svg.append('g')
    .selectAll('circle')
    .data(nodes)
    .enter().append('circle')
    .attr('r', 8)
    .attr('fill', color)
    .call(drag(simulation));

  const label = svg.append('g')
    .selectAll('text')
    .data(nodes)
    .enter().append('text')
    .text(d => d.id)
    .attr('font-size', 10)
    .attr('dx', 12)
    .attr('dy', '.35em');

  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    label
      .attr('x', d => d.x)
      .attr('y', d => d.y);
  });

  function drag(sim) {
    return d3.drag()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }
}