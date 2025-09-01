class CosmographNetworkVisualization {
  constructor() {
    this.cosmograph = null;
    this.data = null;
    this.selectedNode = null;
    this.showLabels = false;
    
    // Fixed simulation parameters
    this.simulationParams = {
      linkDistance: 145,
      repulsionStrength: 10, // Fixed at 500/50 = 10
      linkStrength: 0.5,
      velocityDecay: 0.9
    };
    
    // Fixed visual parameters
    this.visualParams = {
      nodeSizeMultiplier: 3.5,
      linkOpacity: 0.6,
      linkWidth: 1.0
    };
    
    // Filter parameters
    this.filterParams = {
      connectionThreshold: 1,
      networkDepth: 3
    };
    
    this.setupEventListeners();
    this.loadNetwork();
  }

  setupEventListeners() {
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchNodes(e.target.value.toLowerCase());
    });

    // Toggle labels
    document.getElementById('showLabelsToggle').addEventListener('change', (e) => {
      this.showLabels = e.target.checked;
      this.updateLabelsVisibility();
    });

    // Setup slider event listeners
    this.setupSliderListeners();

    // Close node info button
    document.getElementById('closeNodeInfo').addEventListener('click', () => {
      this.hideNodeInfo();
      this.clearSelection();
    });

    // Window resize
    window.addEventListener('resize', () => {
      if (this.cosmograph) {
        this.cosmograph.fitView();
      }
    });
  }

  setupSliderListeners() {
    // No sliders to set up
  }
  }

  updateCosmographConfig() {
    if (this.cosmograph) {
      this.cosmograph.setConfig({
        simulationLinkDistance: this.simulationParams.linkDistance,
        simulationRepulsionStrength: this.simulationParams.repulsionStrength,
        simulationLinkStrength: this.simulationParams.linkStrength,
        simulationVelocityDecay: this.simulationParams.velocityDecay,
        linkWidth: this.visualParams.linkWidth,
        linkColor: `rgba(102, 102, 102, ${this.visualParams.linkOpacity})`
      });
    }
  }

  updateNodeSizes() {
    if (this.data && this.data.nodes) {
      // Update node sizes
      this.data.nodes.forEach(node => {
        const baseSize = node.originalSize || node.size;
        node.size = baseSize * this.visualParams.nodeSizeMultiplier;
      });
      
      // Update Cosmograph with new data
      if (this.cosmograph) {
        this.cosmograph.setData(this.data.nodes, this.data.links);
      }
    }
  }

  applyFilters() {
    if (!this.data) return;
    
    // Reset original data if first time
    if (!this.originalData) {
      this.originalData = {
        nodes: [...this.data.nodes],
        links: [...this.data.links]
      };
    }
    
    // Calculate connection counts
    const connectionCounts = new Map();
    this.originalData.links.forEach(link => {
      connectionCounts.set(link.source, (connectionCounts.get(link.source) || 0) + 1);
      connectionCounts.set(link.target, (connectionCounts.get(link.target) || 0) + 1);
    });
    
    // Filter nodes by connection threshold
    const filteredNodes = this.originalData.nodes.filter(node => {
      const connections = connectionCounts.get(node.id) || 0;
      return connections >= this.filterParams.connectionThreshold;
    });
    
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    
    // Filter links to only include those between remaining nodes
    const filteredLinks = this.originalData.links.filter(link => {
      return filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target);
    });
    
    // Update data
    this.data = {
      nodes: filteredNodes,
      links: filteredLinks
    };
    
    // Update Cosmograph with filtered data
    if (this.cosmograph) {
      this.cosmograph.setData(this.data.nodes, this.data.links);
    }
    
    this.updateStats();
  }

  async loadNetwork() {
    console.log("Loading REAG network for Cosmograph...");
    this.showLoading(true);

    const possiblePaths = [
      'network_reag_cosmograph.json',
      'output/network_reag_cosmograph.json',
      './network_reag_cosmograph.json',
      './output/network_reag_cosmograph.json'
    ];
    
    let loaded = false;
    
    for (const path of possiblePaths) {
      try {
        console.log(`Trying to fetch from: ${path}`);
        const response = await fetch(path);
        
        if (!response.ok) {
          console.log(`Failed: ${response.status}`);
          continue;
        }
        
        this.data = await response.json();
        console.log("Data loaded:", this.data.nodes.length, "nodes,", this.data.links.length, "links");
        
        this.processData();
        this.initializeCosmograph();
        this.updateStats();
        
        console.log("Cosmograph network visualization ready!");
        loaded = true;
        break;
      } catch (error) {
        console.log(`Error with ${path}:`, error.message);
      }
    }
    
    if (!loaded) {
      console.error("Failed to load network data");
      alert("Could not load network data. Please check the console for details.");
    }
    
    this.showLoading(false);
  }

  processData() {
    // Add REAG node classification and colors
    const reagNodeIds = new Set();
    const connectedToReag = new Set();
    
    // Find REAG nodes
    this.data.nodes.forEach(node => {
      if (node.label.toUpperCase().includes('REAG')) {
        reagNodeIds.add(node.id);
        node.isReag = true;
      }
    });
    
    // Find nodes connected to REAG
    this.data.links.forEach(link => {
      if (reagNodeIds.has(link.source) || reagNodeIds.has(link.target)) {
        connectedToReag.add(reagNodeIds.has(link.source) ? link.target : link.source);
      }
    });
    
    // Apply colors and sizes for Cosmograph
    this.data.nodes.forEach(node => {
      if (node.isReag) {
        node.color = '#ff0000';  // Red for REAG
        node.size = 18;
        node.originalSize = 18;
      } else if (connectedToReag.has(node.id)) {
        node.color = '#800080';  // Purple for direct connections
        node.size = 12;
        node.originalSize = 12;
      } else {
        node.color = '#ffa500';  // Orange for extended network
        node.size = 8;
        node.originalSize = 8;
      }
      
      // Set node label for display
      node.label = node.label || node.id;
    });
    
    // Prepare links for Cosmograph
    this.data.links.forEach(link => {
      // Ensure source/target are strings (Cosmograph expects this)
      link.source = link.source.toString();
      link.target = link.target.toString();
    });
    
    console.log(`Processed: ${reagNodeIds.size} REAG nodes, ${connectedToReag.size} connected nodes`);
  }

  initializeCosmograph() {
    const container = document.getElementById('cosmograph-container');
    
    // Create Cosmograph instance with correct API
    this.cosmograph = new Cosmograph(container, {
      // Node configuration
      nodeSize: d => d.size * this.visualParams.nodeSizeMultiplier || 5,
      nodeColor: d => d.color || '#ffa500',
      
      // Link configuration
      linkColor: `rgba(102, 102, 102, ${this.visualParams.linkOpacity})`,
      linkWidth: this.visualParams.linkWidth,
      
      // Labels
      showLabels: this.showLabels,
      labelColor: '#ffffff',
      labelSize: 12,
      
      // Simulation parameters (use slider values)
      simulationRepulsionStrength: this.simulationParams.repulsionStrength,
      simulationLinkDistance: this.simulationParams.linkDistance,
      simulationLinkStrength: this.simulationParams.linkStrength,
      simulationAlphaDecay: 0.05,
      simulationVelocityDecay: this.simulationParams.velocityDecay,
      simulationCenter: true,
      
      // Interaction
      disableSimulation: false,
      showFPSMonitor: false
    });

    // Set up event handlers
    this.cosmograph.onClick = (node) => {
      if (node) {
        this.selectNode(node);
        this.showNodeInfo(node);
      } else {
        this.clearSelection();
        this.hideNodeInfo();
      }
    };
    
    this.cosmograph.onNodeMouseOver = (node) => {
      if (node && !this.selectedNode) {
        this.cosmograph.selectNodes([node.id]);
      }
    };
    
    this.cosmograph.onNodeMouseOut = () => {
      if (!this.selectedNode) {
        this.cosmograph.unselectNodes();
      }
    };

    // Set the data
    this.cosmograph.setData(this.data.nodes, this.data.links);
    
    // Fit view after a short delay to ensure rendering is complete
    setTimeout(() => {
      this.cosmograph.fitView(1000);
    }, 500);
    
    console.log("Cosmograph initialized");
  }

  updateLabelsVisibility() {
    if (this.cosmograph) {
      this.cosmograph.setConfig({
        showLabels: this.showLabels
      });
    }
  }

  selectNode(node) {
    this.selectedNode = node;
    
    // Get connected nodes
    const connectedNodeIds = this.getConnectedNodeIds(node.id);
    connectedNodeIds.add(node.id); // Include the selected node itself
    
    // Highlight in Cosmograph
    this.cosmograph.selectNodes(Array.from(connectedNodeIds));
    
    // Focus on the selected node
    this.cosmograph.focusNode(node.id, 1000);
  }

  clearSelection() {
    this.selectedNode = null;
    this.cosmograph.unselectNodes();
  }

  getConnectedNodeIds(nodeId) {
    const connected = new Set();
    this.data.links.forEach(link => {
      if (link.source === nodeId) {
        connected.add(link.target);
      } else if (link.target === nodeId) {
        connected.add(link.source);
      }
    });
    return connected;
  }

  getConnectedNodes(nodeId) {
    const connectedIds = this.getConnectedNodeIds(nodeId);
    return this.data.nodes.filter(node => connectedIds.has(node.id));
  }

  showNodeInfo(node) {
    // Get connected nodes
    const connectedNodes = this.getConnectedNodes(node.id);

    // Remove duplicates and sort connections A-Z
    const uniqueConnectedNodes = connectedNodes.filter((node, index, array) => 
      array.findIndex(n => n.id === node.id) === index
    );
    
    // Sort alphabetically by name (A-Z)
    uniqueConnectedNodes.sort((a, b) => a.label.localeCompare(b.label));

    // Determine node type
    let nodeType = 'normal';
    let nodeTypeText = 'Rede estendida';
    if (node.isReag) {
      nodeType = 'reag';
      nodeTypeText = 'Empresa REAG';
    } else if (node.color === '#800080') {
      nodeType = 'connected';
      nodeTypeText = 'Conexão direta';
    }

    // Build connections HTML
    let connectionsHtml = '';
    if (uniqueConnectedNodes.length > 0) {
      const connectionItems = uniqueConnectedNodes.map(connectedNode => {
        let itemClass = 'connection-item';
        if (connectedNode.isReag) {
          itemClass += ' reag';
        } else if (connectedNode.color === '#800080') {
          itemClass += ' connected';
        } else {
          itemClass += ' estendida';
        }
        
        // Count connections for this node
        const nodeConnectionCount = this.data.links.filter(link => {
          return link.source === connectedNode.id || link.target === connectedNode.id;
        }).length;
        
        return `<li class="${itemClass}" data-node-id="${connectedNode.id}">${connectedNode.label} (${nodeConnectionCount})</li>`;
      }).join('');

      connectionsHtml = `
        <div class="connections-section">
          <div class="connections-header">
            Conexões
            <span class="connection-count">${uniqueConnectedNodes.length}</span>
          </div>
          <ul class="connections-list">
            ${connectionItems}
          </ul>
        </div>
      `;
    }

    const content = `
      <div class="node-details">
        <div class="node-name">${node.label}</div>
        <span class="node-type ${nodeType}">${nodeTypeText}</span>
      </div>
      ${connectionsHtml}
    `;

    document.getElementById('nodeInfo').style.display = 'block';
    document.getElementById('nodeInfoContent').innerHTML = content;
    
    // Add event listeners to connection items
    const connectionItems = document.querySelectorAll('.connection-item[data-node-id]');
    connectionItems.forEach(item => {
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        const nodeId = item.getAttribute('data-node-id');
        console.log('Connection item clicked via event listener:', nodeId);
        this.selectNodeById(nodeId);
      });
    });
  }

  hideNodeInfo() {
    document.getElementById('nodeInfo').style.display = 'none';
  }

  selectNodeById(nodeId) {
    const node = this.data.nodes.find(n => n.id === nodeId);
    if (node) {
      console.log('selectNodeById - Selecting node:', node.id, node.label);
      this.selectNode(node);
      this.showNodeInfo(node);
    } else {
      console.log('selectNodeById - Node not found:', nodeId);
    }
  }

  searchNodes(searchTerm) {
    if (!this.data || !searchTerm.trim()) {
      // Reset selection
      this.cosmograph.unselectNodes();
      return;
    }

    // Find matching nodes
    const matches = this.data.nodes.filter(node => 
      node.label.toLowerCase().includes(searchTerm)
    );

    if (matches.length === 0) {
      this.cosmograph.unselectNodes();
      return;
    }

    // Find connected nodes
    const matchIds = new Set(matches.map(n => n.id));
    const connectedIds = new Set();

    this.data.links.forEach(link => {
      if (matchIds.has(link.source)) connectedIds.add(link.target);
      if (matchIds.has(link.target)) connectedIds.add(link.source);
    });

    // Highlight matches and connections
    const allHighlighted = new Set([...matchIds, ...connectedIds]);
    this.cosmograph.selectNodes(Array.from(allHighlighted));

    // Focus on first match
    if (matches.length > 0) {
      this.cosmograph.focusNode(matches[0].id, 1000);
    }
  }

  updateStats() {
    const reagCount = this.data.nodes.filter(node => node.isReag).length;
    const purpleCount = this.data.nodes.filter(node => node.color === '#800080').length;
    
    document.getElementById('stats').innerHTML = `
      <div class="stats-title">Estatísticas da Rede</div>
      <div class="stat-line">
        <span class="stat-label">Total de Nós</span>
        <span class="stat-number">${this.data.nodes.length.toLocaleString()}</span>
      </div>
      <div class="stat-line">
        <span class="stat-label">Conexões</span>
        <span class="stat-number">${this.data.links.length.toLocaleString()}</span>
      </div>
      <div class="stat-line">
        <span class="stat-label">Empresas REAG</span>
        <span class="stat-number">${reagCount}</span>
      </div>
      <div class="stat-line">
        <span class="stat-label">Conexões Diretas</span>
        <span class="stat-number">${purpleCount}</span>
      </div>
    `;
  }
  
  animateCounters() {
    const statValues = document.querySelectorAll('.stat-value[data-value]');
    
    statValues.forEach(element => {
      const finalValue = parseInt(element.getAttribute('data-value'));
      const duration = 1500; // 1.5 seconds
      const steps = 60;
      const increment = finalValue / steps;
      let currentValue = 0;
      let step = 0;
      
      element.classList.add('updating');
      
      const timer = setInterval(() => {
        currentValue = Math.min(currentValue + increment, finalValue);
        const displayValue = Math.floor(currentValue);
        
        // Update the number part only (preserve percentage if exists)
        const percentagePart = element.querySelector('.stat-percentage');
        const percentageHtml = percentagePart ? percentagePart.outerHTML : '';
        
        if (displayValue >= 1000) {
          element.innerHTML = displayValue.toLocaleString() + percentageHtml;
        } else {
          element.innerHTML = displayValue + percentageHtml;
        }
        
        step++;
        if (step >= steps || currentValue >= finalValue) {
          clearInterval(timer);
          element.classList.remove('updating');
          
          // Ensure final value is exactly correct
          if (finalValue >= 1000) {
            element.innerHTML = finalValue.toLocaleString() + percentageHtml;
          } else {
            element.innerHTML = finalValue + percentageHtml;
          }
        }
      }, duration / steps);
    });
  }

  showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
  }
}

// Initialize when page loads with debugging
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM loaded, checking for Cosmograph...");
  console.log("window.Cosmograph:", typeof window.Cosmograph);
  console.log("window:", Object.keys(window).filter(k => k.toLowerCase().includes('cosmo')));
  
  // Try multiple ways to check for Cosmograph
  const checkCosmograph = () => {
    console.log("Checking Cosmograph availability...");
    console.log("typeof Cosmograph:", typeof Cosmograph);
    console.log("typeof window.Cosmograph:", typeof window.Cosmograph);
    console.log("window object keys containing 'cosmo':", Object.keys(window).filter(k => k.toLowerCase().includes('cosmo')));
    
    // Try different possible exports
    if (typeof Cosmograph !== 'undefined') {
      console.log("Found Cosmograph as global");
      window.networkViz = new CosmographNetworkVisualization();
    } else if (typeof window.Cosmograph !== 'undefined') {
      console.log("Found window.Cosmograph");
      window.Cosmograph = window.Cosmograph;
      window.networkViz = new CosmographNetworkVisualization();
    } else {
      console.error('Cosmograph library not found in any expected location');
      console.log("Available globals:", Object.keys(window).slice(0, 20));
      
      // Try to continue without Cosmograph for now - fall back to our custom implementation
      console.log("Falling back to custom canvas implementation...");
      alert('Cosmograph library failed to load. Using fallback visualization.');
      
      // Load the fallback
      loadFallbackVisualization();
    }
  };
  
  // Wait a bit longer for the library to load
  setTimeout(checkCosmograph, 500);
});

function loadFallbackVisualization() {
  console.log("Setting up fallback visualization...");
  
  // Replace div container with canvas for the fallback
  const container = document.getElementById('cosmograph-container');
  if (container) {
    container.innerHTML = '<canvas id="network-canvas"></canvas>';
    
    // Update CSS for canvas
    const style = document.createElement('style');
    style.textContent = `
      #network-canvas {
        width: 100vw;
        height: 100vh;
        display: block;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Load our custom canvas implementation
  const script = document.createElement('script');
  script.src = 'cosmograph-viz.js';
  script.onload = () => {
    console.log("Fallback canvas visualization loaded successfully");
  };
  script.onerror = () => {
    console.error("Failed to load fallback visualization");
  };
  document.head.appendChild(script);
}