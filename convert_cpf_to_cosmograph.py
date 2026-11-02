#!/usr/bin/env python3

import pandas as pd
import json
from collections import defaultdict
import sys

def convert_cpf_network_to_cosmograph(cpf):
    """Convert CPF network CSV to Cosmograph JSON format"""
    
    # Load the network for the specific CPF
    csv_file = f'output/network_{cpf}.csv'
    df = pd.read_csv(csv_file)
    print(f"Converting {len(df)} relationships to Cosmograph format...")
    
    # Create nodes and links
    nodes = []
    links = []
    node_map = {}
    node_id = 0
    
    # Collect all unique entities
    all_entities = set(list(df['source']) + list(df['target']))
    print(f"Found {len(all_entities)} unique entities")
    
    # Categorize entities based on relationship types
    companies = set()
    people = set()
    
    for _, row in df.iterrows():
        if row['relationship_type'] in ['person_to_company', 'socio_to_company']:
            people.add(row['source'])
            companies.add(row['target'])
        elif row['relationship_type'] == 'company_to_socio':
            companies.add(row['source'])
            people.add(row['target'])
    
    # Create node mapping and node list
    for entity in all_entities:
        node_map[entity] = node_id
        
        # Determine node color and size based on type
        if entity in people:
            color = '#800080'  # Purple for people/socios
            size = 6
        elif entity in companies:
            color = '#ffa500'  # Orange for companies
            size = 8
        else:
            color = '#cccccc'  # Gray for unknown
            size = 5
            
        nodes.append({
            'id': node_id,
            'label': entity,
            'color': color,
            'size': size
        })
        node_id += 1
    
    # Create links
    for _, row in df.iterrows():
        source_id = node_map[row['source']]
        target_id = node_map[row['target']]
        
        link = {
            'source': source_id,
            'target': target_id
        }
        
        # Add qualificacao_socio if available
        if 'qualificacao_socio' in df.columns and pd.notna(row['qualificacao_socio']):
            link['qualificacao_socio'] = int(row['qualificacao_socio'])
        
        links.append(link)
    
    # Create the final data structure
    graph_data = {
        'nodes': nodes,
        'links': links
    }
    
    # Save as JSON
    output_file = f'output/network_{cpf}_cosmograph.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(graph_data, f, ensure_ascii=False, separators=(',', ':'))
    
    print(f"Cosmograph data saved to: {output_file}")
    print(f"Nodes: {len(nodes)}, Links: {len(links)}")
    print(f"Companies: {len(companies)}, People: {len(people)}")
    
    return len(nodes), len(links), len(companies), len(people)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python convert_cpf_to_cosmograph.py <cpf>")
        sys.exit(1)
    
    cpf = sys.argv[1]
    convert_cpf_network_to_cosmograph("combustiveis")