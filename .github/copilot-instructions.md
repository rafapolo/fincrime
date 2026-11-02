# FinCrime Network Analysis - AI Agent Instructions

## Project Overview
This codebase analyzes Brazilian corporate networks for financial crime investigation, focusing on REAG (criminal organization) connections. It builds multi-level relationship graphs from company registration data and visualizes them interactively.

## Architecture
- **Data Source**: DuckDB database at `/Users/polux/Projetos/empresas/db/empresas.duckdb` containing Brazilian company registry data (CNPJ, partners, etc.)
- **Processing**: Python scripts using pandas to query and transform data into network relationships
- **Visualization**: Static HTML/D3.js web app for interactive network exploration
- **Data Flow**: CSV inputs → Network generation → Cosmograph JSON → Web visualization

## Key Components
- `generate_network*.py`: Query DuckDB to build relationship networks through partner/company expansions
- `convert_to_cosmograph.py`: Transform CSV networks to JSON format for visualization
- `cosmograph-viz.js`: D3.js-based interactive network renderer with search and filtering
- `index.html`: Main visualization interface with controls and statistics

## Data Patterns
- **Node Types**: Companies (red=REAG, orange=extended), Partners (purple)
- **Relationships**: `company_to_socio`, `socio_to_company`, `new_company_to_socio`, `new_socio_to_company`
- **Expansion Logic**: Start from seed companies, find partners, find their other companies, repeat 2 levels
- **CNPJ Cleaning**: Remove non-digits, handle 8-digit basic CNPJ format

## Development Workflow
1. **Data Generation**: Run `python generate_network.py` (expects `input/combustiveis.csv` or similar)
2. **Format Conversion**: Run `python convert_to_cosmograph.py` to create JSON
3. **Visualization**: Open `index.html` in browser (serves static files)
4. **Filtering**: Use `degree.sh` to filter high-degree nodes from networks

## Dependencies
- **Python**: pandas, duckdb
- **JavaScript**: D3.js v7 (loaded from CDN)
- **Database**: External DuckDB file (not included in repo)

## Conventions
- **File Naming**: `network_{source}_cosmograph.json` for visualization data
- **Color Scheme**: Red (#ff0000) for REAG entities, Orange (#ffa500) for others
- **Node Sizing**: REAG=8px, others=5px
- **Partner Roles**: Use `qualificacaoSocioMap` for Brazilian company position codes
- **Output Paths**: All generated files go to `output/` directory

## Common Tasks
- **New Network**: Create CSV with `empresa,cnpj` columns in `input/`, run generation scripts
- **Debug Queries**: Check DuckDB queries in `generate_network.py` for data extraction logic
- **Visualization Tweaks**: Modify `cosmograph-viz.js` for UI changes, colors, or interactions
- **Performance**: Networks can be 10k+ nodes; optimize D3.js rendering for large graphs</content>
<parameter name="filePath">/Users/polux/Projetos/fincrime/.github/copilot-instructions.md