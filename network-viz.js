class NetworkVisualization {
  constructor() {
    this.svg = d3.select("#network-svg");
    this.tooltip = d3.select("#tooltip");
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.nodes = [];
    this.links = [];
    this.nodeMap = new Map();
    this.selectedNode = null;

    this.setupSVG();
    this.setupZoom();
    this.setupSimulation();
    this.setupEventListeners();

    this.colors = {
      company: "#00d4aa",
      person: "#ff6b6b",
      link: "#555",
    };
  }

  setupSVG() {
    this.svg.attr("width", this.width).attr("height", this.height);

    this.g = this.svg.append("g").attr("class", "main-group");
    this.linkGroup = this.g.append("g").attr("class", "links");
    this.nodeGroup = this.g.append("g").attr("class", "nodes");
    this.labelGroup = this.g.append("g").attr("class", "labels");
  }

  setupZoom() {
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        this.g.attr("transform", event.transform);
      });

    this.svg.call(zoom);

    // Set initial zoom to fit content
    this.svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(this.width / 2, this.height / 2).scale(0.5),
    );
  }

  setupSimulation() {
    this.simulation = d3
      .forceSimulation()
      .force(
        "link",
        d3
          .forceLink()
          .id((d) => d.id)
          .distance(80)
          .strength(0.3),
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(0, 0))
      .force("collision", d3.forceCollide().radius(25))
      .alphaDecay(0.02) // Faster convergence
      .velocityDecay(0.4); // More stability
  }

  setupEventListeners() {
    // Auto-load REAG network - no need for click handlers

    // Search functionality
    d3.select("#searchInput").on("input", (event) => {
      this.searchNodes(event.target.value.toLowerCase());
    });

    // Toggle names functionality
    d3.select("#showNamesToggle").on("change", (event) => {
      this.toggleNodeNames(event.target.checked);
    });


    // Hide low degree nodes toggle
    d3.select("#hideLowDegreeToggle").on("change", (event) => {
      this.toggleLowDegreeNodes(event.target.checked);
    });

    // Window resize
    window.addEventListener("resize", () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.svg.attr("width", this.width).attr("height", this.height);
      this.simulation.force("center", d3.forceCenter(0, 0));
    });

    // Close node info button
    document.getElementById('closeNodeInfo').addEventListener('click', () => {
      this.selectedNode = null;
      this.hideNodeInfo();
      this.resetHighlight();
    });

  }

  async loadNetwork(filePath) {
    console.log("Loading network from:", filePath);
    this.showLoading(true);

    try {
      console.log("Fetching CSV data...");
      const data = await d3.csv(filePath);
      console.log("CSV loaded, rows:", data.length);
      
      console.log("Processing data...");
      this.processData(data);
      
      console.log("Updating visualization...");
      this.updateVisualization();
      
      console.log("Network visualization complete!");
    } catch (error) {
      console.error("Error loading network data:", error);
      alert("Error loading network data. Check console for details.");
    } finally {
      this.showLoading(false);
      console.log("Loading screen hidden");
    }
  }

  processData(data) {
    this.nodeMap.clear();
    this.nodes = [];
    this.links = [];

    // Process links and create nodes
    data.forEach((d) => {
      const source = d.source.trim();
      const target = d.target.trim();

      // Create source node if it doesn't exist
      if (!this.nodeMap.has(source)) {
        const node = {
          id: source,
          name: source,
          connections: 0,
        };
        this.nodeMap.set(source, node);
        this.nodes.push(node);
      }

      // Create target node if it doesn't exist
      if (!this.nodeMap.has(target)) {
        const node = {
          id: target,
          name: target,
          connections: 0,
        };
        this.nodeMap.set(target, node);
        this.nodes.push(node);
      }

      // Increment connection counts
      this.nodeMap.get(source).connections++;
      this.nodeMap.get(target).connections++;

      // Create link
      this.links.push({
        source: source,
        target: target,
      });
    });

    // Calculate node sizes based on connections
    const maxConnections = d3.max(this.nodes, (d) => d.connections) || 1;
    this.nodes.forEach((node) => {
      node.size = Math.max(
        8,
        Math.min(25, 8 + (node.connections / maxConnections) * 17),
      );
    });
  }

  getNodeColor(node) {
    // Check if node name contains REAG (case insensitive)
    if (node.id.toUpperCase().includes("REAG")) {
      console.log("REAG node found:", node.id); // Debug log
      return "#ff0000"; // Red for REAG nodes
    }
    
    // Check if node has direct connections to REAG nodes
    const hasREAGConnection = this.links.some(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      if (sourceId === node.id) {
        return targetId.toUpperCase().includes("REAG");
      }
      if (targetId === node.id) {
        return sourceId.toUpperCase().includes("REAG");
      }
      return false;
    });
    
    if (hasREAGConnection) {
      return "#800080"; // Purple for first-level connections to REAG
    }
    
    return "#ffa500"; // Orange for all other nodes
  }

  updateVisualization() {
    // Update links
    const link = this.linkGroup
      .selectAll(".link")
      .data(
        this.links,
        (d) => `${d.source.id || d.source}-${d.target.id || d.target}`,
      );

    link.exit().remove();

    const linkEnter = link
      .enter()
      .append("line")
      .attr("class", "link")
      .attr("stroke", this.colors.link);

    const linkUpdate = linkEnter.merge(link);

    // Update nodes
    const node = this.nodeGroup
      .selectAll(".node")
      .data(this.nodes, (d) => d.id);

    node.exit().remove();

    const nodeEnter = node
      .enter()
      .append("circle")
      .attr("class", "node")
      .attr("r", (d) => d.size)
      .attr("fill", (d) => this.getNodeColor(d))
      .attr("stroke", (d) => d.id.toUpperCase().includes("REAG") ? "#990000" : "rgba(0,0,0,0.3)")
      .attr("stroke-width", (d) => d.id.toUpperCase().includes("REAG") ? 2 : 1)
      .call(this.drag());

    const nodeUpdate = nodeEnter.merge(node);

    // Add event listeners to nodes
    nodeUpdate.on("click", (event, d) => {
      event.stopPropagation();
      this.highlightConnections(d);
      this.showNodeInfo(d);
    });

    // Update labels
    const label = this.labelGroup
      .selectAll(".label")
      .data(this.nodes, (d) => d.id);

    label.exit().remove();

    const labelEnter = label
      .enter()
      .append("text")
      .attr("class", "label")
      .style("display", "none")
      .style("font-size", "10px")
      .style("fill", (d) => this.getNodeColor(d))
      .style("text-anchor", "middle")
      .style("pointer-events", "none")
      .style("font-weight", "500")
      .text((d) => d.name);

    const labelUpdate = labelEnter
      .merge(label)
      .style("fill", (d) => this.getNodeColor(d));

    // Add click listener to SVG background to reset selection
    this.svg.on("click", () => {
      this.resetHighlight();
      this.hideNodeInfo();
    });

    // Update simulation
    this.simulation.nodes(this.nodes);
    this.simulation.force("link").links(this.links);

    this.simulation.on("tick", () => {
      linkUpdate
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      nodeUpdate.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

      labelUpdate.attr("x", (d) => d.x).attr("y", (d) => d.y + d.size + 12);
    });

    console.log("Restarting simulation with", this.nodes.length, "nodes and", this.links.length, "links");
    this.simulation.alpha(1).restart();
    console.log("Simulation restarted successfully");
  }

  drag() {
    return d3
      .drag()
      .on("start", (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }

  showNodeInfo(selectedNode) {
    // Get connected nodes
    const connectedNodes = [];
    this.links.forEach((link) => {
      if (link.source.id === selectedNode.id) {
        connectedNodes.push(link.target);
      } else if (link.target.id === selectedNode.id) {
        connectedNodes.push(link.source);
      }
    });

    // Build connections list HTML
    let connectionsHtml = "";
    if (connectedNodes.length > 0) {
      const connectionItems = connectedNodes.map((node) => {
        let itemClass = 'connection-item';
        // Add styling classes based on node type if available
        if (node.id && node.id.toUpperCase().includes('REAG')) {
          itemClass += ' reag';
        } else if (node.color === '#800080') {
          itemClass += ' connected';
        } else {
          itemClass += ' estendida';
        }
        return `<li class="${itemClass}" onclick="event.stopPropagation(); window.networkViz.selectNodeById('${node.id}');">${node.name || node.id}</li>`;
      }).join('');

      connectionsHtml = `
        <div class="connections-section">
          <div class="connections-header">
            Conexões
            <span class="connection-count">${connectedNodes.length}</span>
          </div>
          <ul class="connections-list">
            ${connectionItems}
          </ul>
        </div>
      `;
    }

    const content = `
      <div class="node-details">
        <div class="node-name">${selectedNode.name || selectedNode.id}</div>
        <span class="node-type ${selectedNode.id && selectedNode.id.toUpperCase().includes('REAG') ? 'reag' : 'normal'}">${selectedNode.id && selectedNode.id.toUpperCase().includes('REAG') ? 'Empresa REAG' : 'Entidade'}</span>
      </div>
      ${connectionsHtml}
    `;

    d3.select("#nodeInfo").style("display", "block");
    d3.select("#nodeInfoContent").html(content);
  }

  hideNodeInfo() {
    d3.select("#nodeInfo").style("display", "none");
  }

  highlightConnections(selectedNode) {
    // Reset all styles
    this.nodeGroup
      .selectAll(".node")
      .style("opacity", 0.3)
      .classed("highlighted", false);

    this.linkGroup
      .selectAll(".link")
      .style("opacity", 0.1)
      .classed("highlighted", false);

    // Highlight selected node and its connections
    const connectedNodes = new Set([selectedNode.id]);

    this.linkGroup
      .selectAll(".link")
      .style("opacity", (d) => {
        if (
          d.source.id === selectedNode.id ||
          d.target.id === selectedNode.id
        ) {
          connectedNodes.add(d.source.id);
          connectedNodes.add(d.target.id);
          return 1;
        }
        return 0.1;
      })
      .classed(
        "highlighted",
        (d) =>
          d.source.id === selectedNode.id || d.target.id === selectedNode.id,
      );

    this.nodeGroup
      .selectAll(".node")
      .style("opacity", (d) => (connectedNodes.has(d.id) ? 1 : 0.3))
      .classed("highlighted", (d) => connectedNodes.has(d.id));
  }

  resetHighlight() {
    this.nodeGroup
      .selectAll(".node")
      .style("opacity", 1)
      .classed("highlighted", false);

    this.linkGroup
      .selectAll(".link")
      .style("opacity", 0.6)
      .classed("highlighted", false);
  }

  searchNodes(searchTerm) {
    if (!searchTerm) {
      this.resetHighlight();
      return;
    }

    const matchingNodes = this.nodes.filter((node) =>
      node.name.toLowerCase().includes(searchTerm),
    );

    if (matchingNodes.length === 0) {
      this.resetHighlight();
      return;
    }

    // Highlight matching nodes
    this.nodeGroup
      .selectAll(".node")
      .style("opacity", (d) =>
        d.name.toLowerCase().includes(searchTerm) ? 1 : 0.3,
      )
      .classed("highlighted", (d) => d.name.toLowerCase().includes(searchTerm));

    this.linkGroup.selectAll(".link").style("opacity", 0.1);
  }

  toggleNodeNames(show) {
    this.labelGroup
      .selectAll(".label")
      .style("display", show ? "block" : "none");
  }



  toggleLowDegreeNodes(hide) {
    // Filter nodes with degree < 3
    const minDegree = 2;

    if (hide) {
      // Hide nodes and links with low degree
      this.nodeGroup
        .selectAll(".node")
        .style("display", (d) =>
          d.connections < minDegree ? "none" : "block",
        );

      this.labelGroup
        .selectAll(".label")
        .style("display", (d) =>
          d.connections < minDegree
            ? "none"
            : d3.select("#showNamesToggle").property("checked")
              ? "block"
              : "none",
        );

      // Hide links connected to low degree nodes
      this.linkGroup.selectAll(".link").style("display", (d) => {
        const sourceConnections =
          this.nodeMap.get(d.source.id || d.source)?.connections || 0;
        const targetConnections =
          this.nodeMap.get(d.target.id || d.target)?.connections || 0;
        return sourceConnections < minDegree || targetConnections < minDegree
          ? "none"
          : "block";
      });
    } else {
      // Show all nodes and links
      this.nodeGroup.selectAll(".node").style("display", "block");

      this.labelGroup
        .selectAll(".label")
        .style(
          "display",
          d3.select("#showNamesToggle").property("checked") ? "block" : "none",
        );

      this.linkGroup.selectAll(".link").style("display", "block");
    }
  }

  showLoading(show) {
    d3.select("#loading").style("display", show ? "block" : "none");
  }

  selectNodeById(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      console.log('Selecting node from connection:', node.name || node.id);
      this.selectedNode = node;
      this.highlightConnections(node);
      this.showNodeInfo(node);
      
      // Center the view on the selected node
      const transform = d3.zoomTransform(this.svg.node());
      const scale = Math.max(1, transform.k);
      const x = this.width / 2 - node.x * scale;
      const y = this.height / 2 - node.y * scale;
      
      this.svg.transition()
        .duration(500)
        .call(this.zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
    }
  }
}

// Initialize the visualization when the page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("Initializing network visualization...");
  window.networkViz = new NetworkVisualization();

  // Auto-load filtered REAG network
  console.log("Loading REAG network...");
  window.networkViz.loadNetwork("output/network_reag_filtered.csv")
    .then(() => {
      console.log("Network loaded successfully!");
    })
    .catch(error => {
      console.error("Failed to load network:", error);
      // Try alternative path
      console.log("Trying alternative path...");
      window.networkViz.loadNetwork("./output/network_reag_filtered.csv")
        .catch(err => {
          console.error("Alternative path also failed:", err);
          alert("Failed to load network data. Please check that the CSV file exists.");
        });
    });
});
