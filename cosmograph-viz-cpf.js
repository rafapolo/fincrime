class CPFNetworkVisualization {
  constructor() {
    this.canvas = document.getElementById("network-canvas");
    this.context = this.canvas.getContext("2d");
    this.data = null;
    this.transform = d3.zoomIdentity;
    this.simulation = null;
    this.selectedNode = null;
    this.labelPositions = [];
    this.showLabels = true; // Default to showing labels

    // Qualificacao socio mapping
    this.qualificacaoSocioMap = {
      0: "Não informada",
      5: "Administrador",
      8: "Conselheiro de Administração",
      9: "Curador",
      10: "Diretor",
      11: "Interventor",
      12: "Inventariante",
      13: "Liquidante",
      14: "Mãe",
      15: "Pai",
      16: "Presidente",
      17: "Procurador",
      18: "Secretário",
      19: "Síndico (Condomínio)",
      20: "Sociedade Consorciada",
      21: "Sociedade Filiada",
      22: "Sócio",
      23: "Sócio Capitalista",
      24: "Sócio Comanditado",
      25: "Sócio Comanditário",
      26: "Sócio de Indústria",
      28: "Sócio-Gerente",
      29: "Sócio Incapaz ou Relat.Incapaz (exceto menor)",
      30: "Sócio Menor (Assistido/Representado)",
      31: "Sócio Ostensivo",
      32: "Tabelião",
      33: "Tesoureiro",
      34: "Titular de Empresa Individual Imobiliária",
      35: "Tutor",
      37: "Sócio Pessoa Jurídica Domiciliado no Exterior",
      38: "Sócio Pessoa Física Residente no Exterior",
      39: "Diplomata",
      40: "Cônsul",
      41: "Representante de Organização Internacional",
      42: "Oficial de Registro",
      43: "Responsável",
      46: "Ministro de Estado das Relações Exteriores",
      47: "Sócio Pessoa Física Residente no Brasil",
      48: "Sócio Pessoa Jurídica Domiciliado no Brasil",
      49: "Sócio-Administrador",
      50: "Empresário",
      51: "Candidato a cargo Político Eletivo",
      52: "Sócio com Capital",
      53: "Sócio sem Capital",
      54: "Fundador",
      55: "Sócio Comanditado Residente no Exterior",
      56: "Sócio Comanditário Pessoa Física Residente no Exterior",
      57: "Sócio Comanditário Pessoa Jurídica Domiciliado no Exterior",
      58: "Sócio Comanditário Incapaz",
      59: "Produtor Rural",
      60: "Cônsul Honorário",
      61: "Responsável indígena",
      62: "Representante da Instituição Extraterritorial",
      63: "Cotas em Tesouraria",
      64: "Administrador Judicial",
      65: "Titular Pessoa Física Residente ou Domiciliado no Brasil",
      66: "Titular Pessoa Física Residente ou Domiciliado no Exterior",
      67: "Titular Pessoa Física Incapaz ou Relativamente Incapaz (exceto menor)",
      68: "Titular Pessoa Física Menor (Assistido/Representado)",
      69: "Beneficiário Final",
      70: "Administrador Residente ou Domiciliado no Exterior",
      71: "Conselheiro de Administração Residente ou Domiciliado no Exterior",
      72: "Diretor Residente ou Domiciliado no Exterior",
      73: "Presidente Residente ou Domiciliado no Exterior",
      74: "Sócio-Administrador Residente ou Domiciliado no Exterior",
      75: "Fundador Residente ou Domiciliado no Exterior",
      78: "Titular Pessoa Jurídica Domiciliada no Brasil",
      79: "Titular Pessoa Jurídica Domiciliada no Exterior",
    };

    // Fixed simulation parameters - expanded view
    this.simulationParams = {
      linkDistance: 680,
      chargeStrength: -800,
      linkStrength: 0.015,
      alphaDecay: 0.015,
    };

    // Fixed visual parameters - more visible
    this.visualParams = {
      nodeSizeMultiplier: 4.5,
      linkOpacity: 0.8,
      linkWidth: 1.5,
    };

    // Filter parameters
    this.filterParams = {
      connectionThreshold: 1,
      networkDepth: 3,
    };

    this.setupCanvas();
    this.setupEventListeners();
    this.loadNetwork();
  }

  setupCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Set actual size in memory (scaled up for high DPI)
    const ratio = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = width * ratio;
    this.canvas.height = height * ratio;

    // Scale it back down using CSS
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";

    // Scale the context to ensure correct drawing operations
    this.context.scale(ratio, ratio);

    this.width = width;
    this.height = height;

    console.log(`Canvas setup: ${width}x${height}, ratio: ${ratio}`);
  }

  setupEventListeners() {
    // Search functionality
    document.getElementById("searchInput").addEventListener("input", (e) => {
      this.searchNodes(e.target.value.toLowerCase());
    });

    // Toggle labels
    document
      .getElementById("showLabelsToggle")
      .addEventListener("change", (e) => {
        this.showLabels = e.target.checked;
        this.redraw();
      });

    // Setup slider event listeners
    this.setupSliderListeners();

    // Zoom and pan
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        this.transform = event.transform;
        this.redraw();
      });

    d3.select(this.canvas).call(zoom);

    // Click event for node selection
    this.canvas.addEventListener("click", (event) => {
      if (!this.data) return;

      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Convert to canvas coordinates (accounting for device pixel ratio and zoom)
      const canvasX = (x - this.transform.x) / this.transform.k;
      const canvasY = (y - this.transform.y) / this.transform.k;

      // Debug click position
      console.log(
        "Click at screen:",
        x.toFixed(2),
        y.toFixed(2),
        "canvas:",
        canvasX.toFixed(2),
        canvasY.toFixed(2),
        "zoom:",
        this.transform.k.toFixed(2),
      );

      // Find clicked node - use more generous click detection
      let clickedNode = null;
      let minDistance = Infinity;
      let nodeCount = 0;

      for (const node of this.data.nodes) {
        nodeCount++;
        const distance = Math.sqrt(
          Math.pow(canvasX - node.x, 2) + Math.pow(canvasY - node.y, 2),
        );

        // Use generous click radius
        const clickRadius = 30; // Large fixed radius for testing

        if (distance <= clickRadius) {
          console.log(
            "Node",
            node.label,
            "at distance",
            distance.toFixed(2),
            "within range",
          );
          if (distance < minDistance) {
            clickedNode = node;
            minDistance = distance;
          }
        }
      }

      console.log("Checked", nodeCount, "nodes");

      if (clickedNode) {
        console.log(
          "Selected node:",
          clickedNode.label,
          "at distance:",
          minDistance.toFixed(2),
        );
        this.selectNode(clickedNode);
        this.showNodeInfo(clickedNode);
      } else {
        console.log("No node found near click");
        this.clearSelection();
        this.hideNodeInfo();
      }
    });

    // Initial zoom - more zoomed out for expanded view
    d3.select(this.canvas).call(
      zoom.transform,
      d3.zoomIdentity.translate(this.width / 2, this.height / 2).scale(0.3),
    );

    // Window resize
    window.addEventListener("resize", () => {
      this.setupCanvas();
      if (this.data) this.redraw();
    });

    // Close node info button
    document.getElementById("closeNodeInfo").addEventListener("click", () => {
      this.hideNodeInfo();
      this.clearSelection();
    });
  }

  setupSliderListeners() {
    // No sliders to set up
  }

  getQualificacaoDescription(codigo) {
    return this.qualificacaoSocioMap[codigo] || "Não informada";
  }

  updateSimulation() {
    if (this.simulation) {
      console.log("Updating simulation with params:", this.simulationParams);

      // Get current forces
      const linkForce = this.simulation.force("link");
      const chargeForce = this.simulation.force("charge");

      if (linkForce) {
        linkForce.distance(this.simulationParams.linkDistance);
        linkForce.strength(this.simulationParams.linkStrength);
        console.log(
          "Updated link force - distance:",
          this.simulationParams.linkDistance,
          "strength:",
          this.simulationParams.linkStrength,
        );
      }

      if (chargeForce) {
        chargeForce.strength(this.simulationParams.chargeStrength);
        console.log(
          "Updated charge force:",
          this.simulationParams.chargeStrength,
        );
      }

      // Update alpha decay
      this.simulation.alphaDecay(this.simulationParams.alphaDecay);
      console.log("Updated alpha decay:", this.simulationParams.alphaDecay);

      // Restart simulation with higher energy to see changes immediately
      this.simulation.alpha(0.5).restart();
      console.log("Simulation restarted with alpha 0.5");
    } else {
      console.log("No simulation found to update");
    }
  }

  updateNodeSizes() {
    if (this.data && this.data.nodes) {
      this.data.nodes.forEach((node) => {
        // Apply multiplier to base radius
        const baseRadius = node.originalRadius || node.radius;
        node.radius = baseRadius * this.visualParams.nodeSizeMultiplier;
      });

      // Update collision force
      if (this.simulation) {
        this.simulation.force(
          "collision",
          d3.forceCollide().radius((d) => d.radius + 2),
        );
      }
    }
  }

  applyFilters() {
    if (!this.data) return;

    // Reset original data if first time or need to reapply
    if (!this.originalData) {
      this.originalData = {
        nodes: [...this.data.nodes],
        links: [...this.data.links],
      };
    }

    // Calculate connection counts
    const connectionCounts = new Map();
    this.originalData.links.forEach((link) => {
      connectionCounts.set(
        link.source.id || link.source,
        (connectionCounts.get(link.source.id || link.source) || 0) + 1,
      );
      connectionCounts.set(
        link.target.id || link.target,
        (connectionCounts.get(link.target.id || link.target) || 0) + 1,
      );
    });

    // Filter nodes by connection threshold
    const filteredNodes = this.originalData.nodes.filter((node) => {
      const connections = connectionCounts.get(node.id) || 0;
      return connections >= this.filterParams.connectionThreshold;
    });

    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

    // Filter links to only include those between remaining nodes
    const filteredLinks = this.originalData.links.filter((link) => {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;
      return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
    });

    // Update data
    this.data = {
      nodes: filteredNodes,
      links: filteredLinks,
    };

    // Reinitialize simulation with filtered data
    this.initializeSimulation();
    this.updateStats();
    this.redraw();
  }

  async loadNetwork() {
    console.log("Loading Eduardo Monteiro Wanderley network...");
    this.showLoading(true);

    const possiblePaths = [
      "network_00640854737_cosmograph.json",
      "output/network_00640854737_cosmograph.json",
      "./network_00640854737_cosmograph.json",
      "./output/network_00640854737_cosmograph.json",
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
        console.log(
          "Data loaded:",
          this.data.nodes.length,
          "nodes,",
          this.data.links.length,
          "links",
        );

        // Debug: Check qualificacao_socio in loaded data
        const linksWithQualificacao = this.data.links.filter(
          (link) =>
            link.qualificacao_socio !== undefined &&
            link.qualificacao_socio !== null,
        );
        console.log(
          `Found ${linksWithQualificacao.length} links with qualificacao_socio data`,
        );

        // Sample first few links with qualificacao_socio
        linksWithQualificacao.slice(0, 3).forEach((link, i) => {
          console.log(`Sample link ${i}:`, link);
        });

        this.processData();
        this.initializeSimulation();
        this.updateStats();

        console.log("Network visualization ready!");
        loaded = true;
        break;
      } catch (error) {
        console.log(`Error with ${path}:`, error.message);
      }
    }

    if (!loaded) {
      console.error("Failed to load network data");
      alert(
        "Could not load network data. Please check the console for details.",
      );
    }

    this.showLoading(false);
  }

  processData() {
    // Classify nodes based on color/type for CPF network
    const peopleNodeIds = new Set();
    const companyNodeIds = new Set();

    // Classify nodes based on their color from the JSON
    this.data.nodes.forEach((node) => {
      if (node.color === "#800080") {
        // Purple = People
        peopleNodeIds.add(node.id);
        node.isPerson = true;
      } else if (node.color === "#ffa500") {
        // Orange = Companies
        companyNodeIds.add(node.id);
        node.isCompany = true;
      }
    });

    console.log(
      `Processed: ${peopleNodeIds.size} people, ${companyNodeIds.size} companies`,
    );
  }

  initializeSimulation() {
    this.simulation = d3
      .forceSimulation(this.data.nodes)
      .force(
        "link",
        d3
          .forceLink(this.data.links)
          .id((d) => d.id)
          .distance(this.simulationParams.linkDistance)
          .strength(this.simulationParams.linkStrength),
      )
      .force(
        "charge",
        d3.forceManyBody().strength(this.simulationParams.chargeStrength),
      )
      .force("center", d3.forceCenter(0, 0))
      .force(
        "collision",
        d3.forceCollide().radius((d) => d.radius + 2),
      )
      .alphaDecay(this.simulationParams.alphaDecay)
      .on("tick", () => this.redraw());

    console.log("Force simulation initialized");
  }

  redraw() {
    if (!this.data) return;

    // Clear canvas
    this.context.save();
    this.context.clearRect(0, 0, this.width, this.height);

    // Apply transform
    this.context.translate(this.transform.x, this.transform.y);
    this.context.scale(this.transform.k, this.transform.k);

    // Draw links
    this.drawLinks();

    // Draw nodes
    this.drawNodes();

    // Draw labels if enabled OR if node is selected
    if (this.showLabels || this.selectedNode) {
      this.drawLabels();
    }

    // Draw edge labels (always draw them when data is available)
    this.drawEdgeLabels();

    this.context.restore();
  }

  drawLinks() {
    this.context.globalAlpha = this.visualParams.linkOpacity;
    this.context.lineWidth = this.visualParams.linkWidth;

    this.data.links.forEach((link) => {
      let strokeStyle = "#666";
      let lineWidth = this.visualParams.linkWidth;
      let alpha = this.visualParams.linkOpacity;

      // If a node is selected, highlight connected links only
      if (this.selectedNode) {
        // Check if this link is connected to the selected node
        const isConnectedToSelected =
          link.source.id === this.selectedNode.id ||
          link.target.id === this.selectedNode.id;

        if (isConnectedToSelected) {
          // Highlight connected links - add green overlay
          strokeStyle = "#00ff88"; // Bright green for connected links
          lineWidth = Math.max(1.5, 2 / this.transform.k); // Thinner connected links
          alpha = 1.0; // Full opacity

          // Add glow effect for selected connections
          this.context.shadowColor = "#00ff88";
          this.context.shadowBlur = 10;
        } else {
          // Keep unconnected links at normal appearance
          // No changes to strokeStyle, lineWidth, or alpha - use defaults
          this.context.shadowBlur = 0;
        }
      } else {
        // No selection - normal appearance
        this.context.shadowBlur = 0;
      }

      this.context.globalAlpha = alpha;
      this.context.strokeStyle = strokeStyle;
      this.context.lineWidth = lineWidth;
      this.context.beginPath();
      this.context.moveTo(link.source.x, link.source.y);
      this.context.lineTo(link.target.x, link.target.y);
      this.context.stroke();
    });

    // Reset shadow
    this.context.shadowBlur = 0;
  }

  drawNodes() {
    this.context.globalAlpha = 1;

    this.data.nodes.forEach((node) => {
      let fillStyle = node.color;
      let radius = node.radius || node.size || 5;
      let strokeStyle = null;
      let strokeWidth = 0;
      let globalAlpha = 1.0;

      // Selection highlighting - keep all nodes normal, add highlights to selected network
      if (this.selectedNode) {
        if (node.id === this.selectedNode.id) {
          // Selected node - add yellow highlight
          fillStyle = "#ffff00"; // Bright yellow for selected
          radius = radius * 1.8; // Larger
          strokeStyle = "#ffffff";
          strokeWidth = Math.max(1, 2 / this.transform.k); // Thin outline
          globalAlpha = 1.0; // Full opacity

          // Moderate glow effect for selected node
          this.context.shadowColor = "#ffff00";
          this.context.shadowBlur = 15;
        } else if (this.isConnectedToSelected(node)) {
          // Connected nodes - add green highlight
          fillStyle = "#00ff88"; // Bright green for connected
          radius = radius * 1.4; // Slightly larger
          strokeStyle = "#ffffff";
          strokeWidth = Math.max(1, 2 / this.transform.k);
          globalAlpha = 1.0; // Full opacity

          // Moderate glow for connected nodes
          this.context.shadowColor = "#00ff88";
          this.context.shadowBlur = 10;
        } else {
          // Unconnected nodes - keep normal appearance
          fillStyle = node.color; // Keep original colors
          radius = radius; // Keep original size
          strokeStyle = null;
          strokeWidth = 0;
          globalAlpha = 1.0; // Keep full opacity
          this.context.shadowBlur = 0;
        }
      } else {
        // No selection - normal appearance
        this.context.shadowBlur = 0;
        globalAlpha = 1.0;
      }

      // Apply global alpha for fading effect
      this.context.globalAlpha = globalAlpha;

      // Draw node
      this.context.fillStyle = fillStyle;
      this.context.beginPath();
      this.context.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      this.context.fill();

      // Draw stroke if needed
      if (strokeStyle && strokeWidth > 0) {
        this.context.strokeStyle = strokeStyle;
        this.context.lineWidth = strokeWidth;
        this.context.stroke();
      }
    });

    // Reset shadow
    this.context.shadowBlur = 0;
  }

  drawLabels() {
    this.labelPositions = [];

    // Debug: log current zoom level
    const currentZoom = this.transform.k;
    if (Math.random() < 0.01) {
      // Log occasionally to avoid spam
      console.log(
        "Current zoom level:",
        currentZoom.toFixed(2),
        "Show labels toggle:",
        this.showLabels,
      );
    }

    // First pass: collect label positions for nodes that should show labels
    const labelsToShow = this.data.nodes.filter((node) => {
      // If labels toggle is enabled, show ALL labels regardless of zoom
      if (this.showLabels) {
        return true; // Show ALL labels when toggle is enabled
      }

      // If a node is selected, show selected node and its connections
      if (this.selectedNode) {
        return (
          node.id === this.selectedNode.id || this.isConnectedToSelected(node)
        );
      }

      // Show labels based on zoom level - closer zoom shows more labels
      const zoomFactor = this.transform.k;
      const radius = node.radius || node.size || 5;

      // At high zoom (close up), show labels for all reasonably sized nodes
      if (zoomFactor > 2.0) {
        return radius >= 3; // Show most nodes when zoomed in
      }

      // At medium zoom, show important nodes
      if (zoomFactor > 1.0) {
        return radius >= 5;
      }

      // At low zoom (far out), only show very important nodes
      return radius > 6;
    });

    // Sort by importance (selected, then by size)
    labelsToShow.sort((a, b) => {
      if (this.selectedNode) {
        if (a.id === this.selectedNode.id) return -1;
        if (b.id === this.selectedNode.id) return 1;
      }
      const radiusA = a.radius || a.size || 5;
      const radiusB = b.radius || b.size || 5;
      return radiusB - radiusA;
    });

    // Limit number of labels for performance
    let maxLabels;
    const zoomFactor = this.transform.k;

    if (this.showLabels) {
      // When toggle is enabled, show many more labels - expanded
      maxLabels = Math.max(200, Math.min(1000, zoomFactor * 400));
    } else {
      // Adaptive limits based on zoom level - more generous
      if (zoomFactor > 2.0) {
        maxLabels = Math.max(100, Math.min(400, zoomFactor * 150));
      } else if (zoomFactor > 1.0) {
        maxLabels = Math.max(50, Math.min(200, zoomFactor * 100));
      } else {
        maxLabels = Math.max(30, Math.min(100, zoomFactor * 50));
      }
    }
    const finalLabelsToShow = labelsToShow.slice(0, maxLabels);

    // Draw labels with collision avoidance
    this.context.fillStyle = "#ffffff";
    this.context.strokeStyle = "#000000";
    this.context.lineWidth = 3;
    this.context.font = "14px Barlow";
    this.context.textAlign = "center";

    finalLabelsToShow.forEach((node) => {
      // Dynamic font size and text length based on zoom - more responsive
      let fontSize = Math.max(12, Math.min(20, 12 + this.transform.k * 3));
      let maxLength = Math.max(15, Math.min(60, 15 + this.transform.k * 15));

      // Make selected node and connected node labels more prominent
      if (this.selectedNode) {
        if (node.id === this.selectedNode.id) {
          // Selected node - larger font and longer text
          fontSize = Math.max(12, Math.min(20, fontSize * 1.5));
          maxLength = Math.min(80, maxLength * 1.5);
        } else if (this.isConnectedToSelected(node)) {
          // Connected node - slightly larger font
          fontSize = Math.max(10, Math.min(18, fontSize * 1.2));
          maxLength = Math.min(70, maxLength * 1.2);
        }
      }

      const text =
        node.label.length > maxLength
          ? node.label.substring(0, maxLength) + "..."
          : node.label;

      // Update font size
      this.context.font = `${fontSize}px Barlow`;
      const textWidth = this.context.measureText(text).width;
      const textHeight = fontSize + 2;

      // Find best position for label with better offset
      const radius = node.radius || node.size || 5;
      const offset = radius + Math.max(8, 12 / this.transform.k);
      let labelY = this.findBestLabelPosition(
        node.x,
        node.y - offset,
        textWidth,
        textHeight,
      );

      // Enhanced text rendering with selection-aware styling
      let strokeStyle = "#000000";
      let fillStyle = "#ffffff";
      let lineWidth = Math.max(2, 4 / this.transform.k);

      if (this.selectedNode) {
        if (node.id === this.selectedNode.id) {
          // Selected node label - bright yellow with strong outline
          fillStyle = "#ffff00";
          strokeStyle = "#000000";
          lineWidth = Math.max(3, 5 / this.transform.k);
        } else if (this.isConnectedToSelected(node)) {
          // Connected node label - bright green
          fillStyle = "#00ff88";
          strokeStyle = "#000000";
          lineWidth = Math.max(2, 4 / this.transform.k);
        }
      }

      this.context.lineWidth = lineWidth;
      this.context.strokeStyle = strokeStyle;
      this.context.fillStyle = fillStyle;

      // Draw text with outline
      this.context.strokeText(text, node.x, labelY);
      this.context.fillText(text, node.x, labelY);

      // Store position to avoid future collisions
      this.labelPositions.push({
        x: node.x - textWidth / 2 - 2,
        y: labelY - textHeight - 2,
        width: textWidth + 4,
        height: textHeight + 4,
      });
    });
  }

  findBestLabelPosition(x, preferredY, width, height) {
    // Dynamic spacing based on zoom level
    const baseSpacing = Math.max(15, 25 / this.transform.k);
    const positions = [
      preferredY,
      preferredY - baseSpacing,
      preferredY + baseSpacing,
      preferredY - baseSpacing * 2,
      preferredY + baseSpacing * 2,
      preferredY - baseSpacing * 3,
      preferredY + baseSpacing * 3,
    ];

    for (const y of positions) {
      const rect = {
        x: x - width / 2 - 2, // Add small padding
        y: y - height - 2,
        width: width + 4,
        height: height + 4,
      };

      if (!this.hasLabelCollision(rect)) {
        return y;
      }
    }

    return preferredY; // Fallback to preferred position
  }

  hasLabelCollision(rect) {
    return this.labelPositions.some(
      (pos) =>
        rect.x < pos.x + pos.width &&
        rect.x + rect.width > pos.x &&
        rect.y < pos.y + pos.height &&
        rect.y + rect.height > pos.y,
    );
  }

  drawEdgeLabels() {
    if (!this.data || !this.data.links) {
      console.log("No data or links available for edge labels");
      return;
    }

    // Debug: Log total links
    console.log(`Drawing edge labels for ${this.data.links.length} links`);

    // Configure edge label styling
    this.context.fillStyle = "#ffffff";
    this.context.strokeStyle = "#000000";
    this.context.lineWidth = 3;
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";

    // Use larger font size for visibility
    const baseFontSize = Math.max(12, Math.min(16, 12 + this.transform.k * 2));
    this.context.font = `${baseFontSize}px Arial`;

    let labelsDrawn = 0;
    let linksWithQualificacao = 0;

    this.data.links.forEach((link, index) => {
      // Debug: Check first few links
      if (index < 5) {
        console.log(`Link ${index}:`, link);
      }

      // Check if link has qualificacao_socio data
      if (
        link.qualificacao_socio !== undefined &&
        link.qualificacao_socio !== null
      ) {
        linksWithQualificacao++;

        // Get qualificacao description
        const qualificacaoDesc = this.getQualificacaoDescription(
          link.qualificacao_socio,
        );

        // Debug first few descriptions
        if (linksWithQualificacao <= 5) {
          console.log(
            `Qualificacao ${link.qualificacao_socio}: ${qualificacaoDesc}`,
          );
        }

        // Skip only "Não informada" but show everything else
        if (qualificacaoDesc && qualificacaoDesc !== "Não informada") {
          // Calculate edge midpoint
          const midX = (link.source.x + link.target.x) / 2;
          const midY = (link.source.y + link.target.y) / 2;

          // Simple text without complex positioning
          const text =
            qualificacaoDesc.length > 15
              ? qualificacaoDesc.substring(0, 15) + "..."
              : qualificacaoDesc;

          // Use bright colors for visibility
          this.context.fillStyle = "#ffff00"; // Bright yellow
          this.context.strokeStyle = "#000000"; // Black outline

          // Draw text with outline
          this.context.strokeText(text, midX, midY);
          this.context.fillText(text, midX, midY);

          labelsDrawn++;
        }
      }
    });

    console.log(
      `Edge labels summary: ${linksWithQualificacao} links with qualificacao_socio, ${labelsDrawn} labels drawn`,
    );
  }

  selectNode(node) {
    this.selectedNode = node;
    this.redraw();
  }

  clearSelection() {
    this.selectedNode = null;
    this.redraw();
  }

  showNodeInfo(node) {
    // Get connected nodes
    const connectedNodes = [];
    console.log("showNodeInfo - Current node:", node.id);
    console.log("Sample link structure:", this.data.links[0]);

    this.data.links.forEach((link) => {
      // Handle both ID-based and object-based links
      const sourceId =
        typeof link.source === "object" ? link.source.id : link.source;
      const targetId =
        typeof link.target === "object" ? link.target.id : link.target;

      if (sourceId === node.id) {
        const targetNode =
          typeof link.target === "object"
            ? link.target
            : this.data.nodes.find((n) => n.id === link.target);
        if (targetNode) connectedNodes.push(targetNode);
      } else if (targetId === node.id) {
        const sourceNode =
          typeof link.source === "object"
            ? link.source
            : this.data.nodes.find((n) => n.id === link.source);
        if (sourceNode) connectedNodes.push(sourceNode);
      }
    });

    console.log(
      "Connected nodes found:",
      connectedNodes.length,
      connectedNodes.map((n) => ({
        id: n.id,
        type: typeof n.id,
        label: n.label,
      })),
    );

    // Remove duplicates and sort connections A-Z
    const uniqueConnectedNodes = connectedNodes.filter(
      (node, index, array) =>
        array.findIndex((n) => n.id === node.id) === index,
    );

    // Sort alphabetically by name (A-Z)
    uniqueConnectedNodes.sort((a, b) => a.label.localeCompare(b.label));

    // Determine node type
    let nodeType = "company";
    let nodeTypeText = "Empresa";
    if (node.color === "#800080" || node.isPerson) {
      nodeType = "person";
      nodeTypeText = "Pessoa/Sócio";
    }

    // Build connections HTML
    let connectionsHtml = "";
    if (uniqueConnectedNodes.length > 0) {
      const connectionItems = uniqueConnectedNodes
        .map((connectedNode) => {
          let itemClass = "connection-item";
          if (connectedNode.color === "#800080" || connectedNode.isPerson) {
            itemClass += " person";
          } else {
            itemClass += " company";
          }

          // Count connections for this node
          const nodeConnectionCount = this.data.links.filter((link) => {
            const sourceId =
              typeof link.source === "object" ? link.source.id : link.source;
            const targetId =
              typeof link.target === "object" ? link.target.id : link.target;
            return (
              sourceId === connectedNode.id || targetId === connectedNode.id
            );
          }).length;

          // Find the link between current node and connected node to get qualificacao_socio
          const linkBetweenNodes = this.data.links.find((link) => {
            const sourceId =
              typeof link.source === "object" ? link.source.id : link.source;
            const targetId =
              typeof link.target === "object" ? link.target.id : link.target;
            return (
              (sourceId === node.id && targetId === connectedNode.id) ||
              (sourceId === connectedNode.id && targetId === node.id)
            );
          });

          // Get qualificacao description if available
          let qualificacaoText = "";
          if (
            linkBetweenNodes &&
            linkBetweenNodes.qualificacao_socio !== undefined
          ) {
            const qualificacaoDesc = this.getQualificacaoDescription(
              linkBetweenNodes.qualificacao_socio,
            );
            qualificacaoText = ` - ${qualificacaoDesc}`;
          }

          const nodeId = connectedNode.id;
          console.log("Creating connection item:", {
            nodeId,
            type: typeof nodeId,
            label: connectedNode.label,
          });
          return `<li class="${itemClass}" data-node-id="${nodeId}">${connectedNode.label} (${nodeConnectionCount})${qualificacaoText}</li>`;
        })
        .join("");

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

    document.getElementById("nodeInfo").style.display = "block";
    document.getElementById("nodeInfoContent").innerHTML = content;

    // Add event listeners to connection items (both li and div elements)
    const connectionItems = document.querySelectorAll(
      ".connection-item[data-node-id]",
    );
    connectionItems.forEach((item) => {
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        const nodeId = item.getAttribute("data-node-id");
        console.log(
          "Connection item clicked via event listener:",
          nodeId,
          "type:",
          typeof nodeId,
        );
        console.log("Raw attribute value:", item.getAttribute("data-node-id"));

        // Try to find the node with the exact ID first, then with type conversion
        let targetNode = this.data.nodes.find((n) => n.id === nodeId);
        if (!targetNode) {
          targetNode = this.data.nodes.find((n) => n.id === Number(nodeId));
        }
        if (!targetNode) {
          targetNode = this.data.nodes.find((n) => String(n.id) === nodeId);
        }

        if (targetNode) {
          console.log(
            "Found target node:",
            targetNode.id,
            "type:",
            typeof targetNode.id,
          );
          this.selectNodeById(targetNode.id);
        } else {
          console.log("No matching node found for ID:", nodeId);
          // Fall back to the original method for debugging
          this.selectNodeById(nodeId);
        }
      });
    });
  }

  hideNodeInfo() {
    document.getElementById("nodeInfo").style.display = "none";
  }

  selectNodeById(nodeId) {
    console.log("selectNodeById called with:", nodeId, "type:", typeof nodeId);
    console.log(
      "Available node IDs sample:",
      this.data.nodes.slice(0, 5).map((n) => ({ id: n.id, type: typeof n.id })),
    );

    const node = this.data.nodes.find((n) => n.id === nodeId);
    if (node) {
      console.log("Selecting node from connection:", node.label || node.id);
      console.log("Node position:", { x: node.x, y: node.y });
      console.log(
        "Current selectedNode before:",
        this.selectedNode ? this.selectedNode.id : "none",
      );

      this.selectNode(node);
      this.showNodeInfo(node);

      console.log(
        "Current selectedNode after:",
        this.selectedNode ? this.selectedNode.id : "none",
      );

      // Center on the selected node if it has coordinates
      if (node.x !== undefined && node.y !== undefined) {
        const scale = Math.max(1, this.transform.k);
        const translate = [
          this.width / 2 - node.x * scale,
          this.height / 2 - node.y * scale,
        ];

        console.log("Centering on node:", { scale, translate });

        d3.select(this.canvas)
          .transition()
          .duration(500)
          .call(
            d3.zoom().transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale),
          );
      } else {
        console.log("Node has no position coordinates, skipping centering");
      }
    } else {
      console.log("Node not found with ID:", nodeId);
      console.log("Trying string/number conversion...");

      // Try different type conversions
      const nodeAsString = this.data.nodes.find((n) => n.id === String(nodeId));
      const nodeAsNumber = this.data.nodes.find((n) => n.id === Number(nodeId));

      if (nodeAsString) {
        console.log("Found node with string conversion:", nodeAsString.id);
        this.selectNodeById(String(nodeId));
        return;
      }

      if (nodeAsNumber) {
        console.log("Found node with number conversion:", nodeAsNumber.id);
        this.selectNodeById(Number(nodeId));
        return;
      }

      console.log("Node not found even with type conversion");
    }
  }

  isConnectedToSelected(node) {
    if (!this.selectedNode) return false;

    return this.data.links.some((link) => {
      const sourceId =
        typeof link.source === "object" ? link.source.id : link.source;
      const targetId =
        typeof link.target === "object" ? link.target.id : link.target;

      return (
        (sourceId === this.selectedNode.id && targetId === node.id) ||
        (targetId === this.selectedNode.id && sourceId === node.id)
      );
    });
  }

  searchNodes(searchTerm) {
    if (!this.data || !searchTerm.trim()) {
      // Reset colors
      this.processData();
      this.redraw();
      return;
    }

    // Find matching nodes
    const matches = this.data.nodes.filter((node) =>
      node.label.toLowerCase().includes(searchTerm),
    );

    if (matches.length === 0) {
      this.processData();
      this.redraw();
      return;
    }

    // Highlight matches
    const matchIds = new Set(matches.map((n) => n.id));
    const connectedIds = new Set();

    // Find connected nodes
    this.data.links.forEach((link) => {
      const sourceId =
        typeof link.source === "object" ? link.source.id : link.source;
      const targetId =
        typeof link.target === "object" ? link.target.id : link.target;
      if (matchIds.has(sourceId)) connectedIds.add(targetId);
      if (matchIds.has(targetId)) connectedIds.add(sourceId);
    });

    // Apply highlighting
    this.data.nodes.forEach((node) => {
      const radius = node.radius || node.size || 5;
      if (matchIds.has(node.id)) {
        node.color = "#ffff00"; // Yellow for matches
        node.radius = Math.max(radius, 10);
      } else if (connectedIds.has(node.id)) {
        node.color = "#00ffff"; // Cyan for connected
        node.radius = Math.max(radius, 6);
      } else {
        node.color = "#333333"; // Dim others
        node.radius = Math.max(radius * 0.5, 3);
      }
    });

    this.redraw();

    // Center on first match
    if (matches.length > 0) {
      const node = matches[0];
      const scale = 1.5;
      const translate = [
        this.width / 2 - node.x * scale,
        this.height / 2 - node.y * scale,
      ];

      d3.select(this.canvas)
        .transition()
        .duration(750)
        .call(
          d3.zoom().transform,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale),
        );
    }
  }

  updateStats() {
    const peopleCount = this.data.nodes.filter(
      (node) => node.color === "#800080",
    ).length;
    const companyCount = this.data.nodes.filter(
      (node) => node.color === "#ffa500",
    ).length;

    document.getElementById("stats").innerHTML = `
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
        <span class="stat-label">Pessoas/Sócios</span>
        <span class="stat-number">${peopleCount}</span>
      </div>
      <div class="stat-line">
        <span class="stat-label">Empresas</span>
        <span class="stat-number">${companyCount}</span>
      </div>
    `;
  }

  animateCounters() {
    const statValues = document.querySelectorAll(".stat-value[data-value]");

    statValues.forEach((element) => {
      const finalValue = parseInt(element.getAttribute("data-value"));
      const duration = 1500; // 1.5 seconds
      const steps = 60;
      const increment = finalValue / steps;
      let currentValue = 0;
      let step = 0;

      element.classList.add("updating");

      const timer = setInterval(() => {
        currentValue = Math.min(currentValue + increment, finalValue);
        const displayValue = Math.floor(currentValue);

        // Update the number part only (preserve percentage if exists)
        const percentagePart = element.querySelector(".stat-percentage");
        const percentageHtml = percentagePart ? percentagePart.outerHTML : "";

        if (displayValue >= 1000) {
          element.innerHTML = displayValue.toLocaleString() + percentageHtml;
        } else {
          element.innerHTML = displayValue + percentageHtml;
        }

        step++;
        if (step >= steps || currentValue >= finalValue) {
          clearInterval(timer);
          element.classList.remove("updating");

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
    document.getElementById("loading").style.display = show ? "block" : "none";
  }
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing CPF network visualization...");
  window.networkViz = new CPFNetworkVisualization();
});
