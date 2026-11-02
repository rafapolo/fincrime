#!/usr/bin/env python3

import pandas as pd
import json
from collections import defaultdict

def convert_to_cosmograph_format():
    """Convert CSV network to Cosmograph JSON format"""
    
    # Load the filtered network
    df = pd.read_csv('output/network_reag_filtered.csv')
    print(f"Converting {len(df)} relationships to Cosmograph format...")
    
    # Create nodes and links
    nodes = []
    links = []
    node_map = {}
    node_id = 0
    
    # Collect all unique entities
    all_entities = set(list(df['source']) + list(df['target']))
    print(f"Found {len(all_entities)} unique entities")
    
    # Create node mapping and node list
    for entity in all_entities:
        node_map[entity] = node_id
        
        # Determine node color based on name
        if 'REAG' in entity.upper():
            color = '#ff0000'  # Red for REAG
            size = 8
        else:
            color = '#ffa500'  # Orange for others (we'll handle purple connections in JS)
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
        
        links.append({
            'source': source_id,
            'target': target_id
        })
    
    # Create the final data structure
    graph_data = {
        'nodes': nodes,
        'links': links
    }
    
    # Save as JSON
    output_file = 'output/network_reag_cosmograph.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(graph_data, f, ensure_ascii=False, separators=(',', ':'))
    
    print(f"Cosmograph data saved to: {output_file}")
    print(f"Nodes: {len(nodes)}, Links: {len(links)}")
    
    # Count REAG nodes
    reag_count = sum(1 for node in nodes if 'REAG' in node['label'].upper())
    print(f"REAG nodes: {reag_count}")
    
    return len(nodes), len(links), reag_count

if __name__ == "__main__":
    convert_to_cosmograph_format()