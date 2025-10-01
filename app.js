async function loadGraph() {
  const repo = document.getElementById('repoInput').value.trim();
  if (!repo) return alert('Enter a repo like Azure/Azure-Sentinel');
  const [owner, name] = repo.split('/');
  const url = `https://api.github.com/repos/${owner}/${name}/contents/DataConnectors`;
  const res = await fetch(url);
  const files = await res.json();
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
      const name = raw.properties?.connectorUiConfig?.title || file.name;
      addNode(name, 'connector');
      const publisher = raw.properties?.connectorUiConfig?.publisherName || 'Unknown';
      addNode(publisher, 'source');
      links.push({ source: publisher, target: name });
    }
  }

  drawGraph(nodes, links);
}

function drawGraph(nodes, links) {
  const svg = d3.select('svg');
  svg.selectAll('*').remove();
  const width = window.innerWidth, height = window.innerHeight * 0.9;
  const color = d => d.type === 'connector' ? '#ff7f0e' : '#1f77b4';

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2));

  const link = svg.append('g').selectAll('line')
    .data(links).enter().append('line')
    .attr('stroke', '#999').attr('stroke-width', 1.5);

  const node = svg.append('g').selectAll('circle')
    .data(nodes).enter().append('circle')
    .attr('r', 8).attr('fill', color)
    .call(drag(simulation));

  const label = svg.append('g').selectAll('text')
    .data(nodes).enter().append('text')
    .text(d => d.id).attr('font-size', 10).attr('dx', 12).attr('dy', '.35em');

  simulation.on('tick', () => {
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('cx', d => d.x).attr('cy', d => d.y);
    label.attr('x', d => d.x).attr('y', d => d.y);
  });

  function drag(sim) {
    return d3.drag()
      .on('start', d => { if (!d3.event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', d => { d.fx = d3.event.x; d.fy = d3.event.y; })
      .on('end', d => { if (!d3.event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
  }
}