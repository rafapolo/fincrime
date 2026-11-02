#!/usr/bin/env python3

import pandas as pd
from collections import Counter

def create_filtered_network():
    """Create filtered network with only highly connected nodes for better performance"""
    
    # Load the complete network
    df = pd.read_csv('output/network_reag.csv')
    print(f"Original network: {len(df)} relationships")
    
    # Count connections for each node
    all_nodes = list(df['source']) + list(df['target'])
    node_counts = Counter(all_nodes)
    
    # Filter: Keep nodes with >= 3 connections to focus on deeper ties
    # Also always keep REAG nodes regardless of connection count
    min_connections = 3
    important_nodes = set()
    
    for node, count in node_counts.items():
        if count >= min_connections or 'REAG' in node.upper():
            important_nodes.add(node)
    
    print(f"Nodes with >= {min_connections} connections or REAG: {len(important_nodes)}")
    
    # Filter relationships to only include important nodes
    filtered_df = df[
        (df['source'].isin(important_nodes)) & 
        (df['target'].isin(important_nodes))
    ].copy()
    
    print(f"Filtered network: {len(filtered_df)} relationships")
    print(f"Reduction: {(1 - len(filtered_df)/len(df))*100:.1f}%")
    
    # Additional optimization: Remove duplicate relationships (if any)
    filtered_df = filtered_df.drop_duplicates(subset=['source', 'target'])
    
    # Count final stats
    final_nodes = set(list(filtered_df['source']) + list(filtered_df['target']))
    final_counts = Counter(list(filtered_df['source']) + list(filtered_df['target']))
    
    print(f"Final network: {len(final_nodes)} nodes, {len(filtered_df)} edges")
    print(f"Average connections: {len(filtered_df)*2/len(final_nodes):.1f}")
    
    # Show top nodes in filtered network
    print("\nTop 10 nodes in filtered network:")
    for node, count in final_counts.most_common(10):
        print(f"{count}: {node[:60]}...")
    
    # Save filtered network
    output_file = 'output/network_reag_filtered.csv'
    filtered_df.to_csv(output_file, index=False)
    print(f"\nFiltered network saved to: {output_file}")
    
    return len(final_nodes), len(filtered_df)

if __name__ == "__main__":
    create_filtered_network()