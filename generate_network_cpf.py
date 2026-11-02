#!/usr/bin/env python3

import pandas as pd
import duckdb
import sys
from pathlib import Path

def generate_network_for_cpf(cpf_cnpj_socio):
    """Generate network.csv starting from a specific CPF/CNPJ socio"""
    
    # Configuration
    output_file = f"output/network_{cpf_cnpj_socio}.csv"
    db_path = "/Users/polux/Projetos/empresas/db/empresas.duckdb"
    
    # Validate database
    if not Path(db_path).exists():
        print(f"Error: Database {db_path} not found")
        sys.exit(1)
    
    # Clean the input CPF
    cpf_clean = str(cpf_cnpj_socio).replace(r'[^0-9]', '')
    if len(cpf_clean) == 0:
        print("Error: Invalid CPF/CNPJ provided")
        sys.exit(1)
    
    print(f"Processing CPF/CNPJ: {cpf_clean}")
    
    try:
        # Connect to database
        conn = duckdb.connect(db_path, read_only=True)
        
        # Query 1: Get companies where this person is a socio
        query1 = f"SELECT cnpj_basico, cpf_cnpj_socio, nome_socio_razao_social, qualificacao_socio FROM companies.socios WHERE cpf_cnpj_socio = '{cpf_clean}' AND nome_socio_razao_social IS NOT NULL AND nome_socio_razao_social != ''"
        initial_companies_df = conn.execute(query1).df()
        print(f"Found {len(initial_companies_df)} companies where {cpf_clean} is a socio")
        
        if len(initial_companies_df) == 0:
            print("No companies found for this CPF/CNPJ")
            conn.close()
            return
        
        # Query 2: Get all other socios of those companies
        company_cnpjs = initial_companies_df['cnpj_basico'].dropna().unique().tolist()
        if company_cnpjs:
            cnpj_clause = "','".join(company_cnpjs)
            query2 = f"SELECT cnpj_basico, cpf_cnpj_socio, nome_socio_razao_social, qualificacao_socio FROM companies.socios WHERE cnpj_basico IN ('{cnpj_clause}') AND nome_socio_razao_social IS NOT NULL AND nome_socio_razao_social != ''"
            all_socios_df = conn.execute(query2).df()
            print(f"Found {len(all_socios_df)} total socios from those companies")
        else:
            all_socios_df = pd.DataFrame()
        
        # Query 3: Get companies where all these socios are partners
        socio_companies_df = pd.DataFrame()
        if len(all_socios_df) > 0:
            socio_ids = [str(sid).replace(r'[^0-9]', '') for sid in all_socios_df['cpf_cnpj_socio'].dropna().unique() if str(sid).strip()]
            socio_ids = [sid for sid in socio_ids if len(sid) > 0]
            if socio_ids:
                socio_clause = "','".join(socio_ids)
                query3 = f"SELECT cnpj_basico, cpf_cnpj_socio, nome_socio_razao_social, qualificacao_socio FROM companies.socios WHERE cpf_cnpj_socio IN ('{socio_clause}') AND nome_socio_razao_social IS NOT NULL AND nome_socio_razao_social != ''"
                socio_companies_df = conn.execute(query3).df()
                print(f"Found {len(socio_companies_df)} companies where socios are partners")
        
        # Get all company names
        all_cnpjs = set()
        for df in [initial_companies_df, all_socios_df, socio_companies_df]:
            if len(df) > 0:
                all_cnpjs.update(df['cnpj_basico'].dropna().unique())
        
        company_lookup = {}
        if all_cnpjs:
            all_cnpj_clause = "','".join(all_cnpjs)
            query_names = f"SELECT cnpj_basico, razao_social FROM companies.empresas WHERE cnpj_basico IN ('{all_cnpj_clause}') AND razao_social IS NOT NULL AND razao_social != ''"
            company_names_df = conn.execute(query_names).df()
            for _, row in company_names_df.iterrows():
                company_lookup[row['cnpj_basico']] = row['razao_social'].strip().strip('"')
        
        conn.close()
        
        # Create relationships
        relationships = []
        
        # Get the original person's name
        original_person_name = None
        if len(initial_companies_df) > 0:
            original_person_name = initial_companies_df.iloc[0]['nome_socio_razao_social'].strip().strip('"')
        
        # 1. Original person -> their companies
        for _, row in initial_companies_df.iterrows():
            if row['cnpj_basico'] in company_lookup:
                relationships.append({
                    'source': original_person_name,
                    'target': company_lookup[row['cnpj_basico']].strip().strip('"'),
                    'relationship_type': 'person_to_company',
                    'qualificacao_socio': row['qualificacao_socio'] if pd.notna(row['qualificacao_socio']) else None
                })
        
        # 2. Companies -> all their socios
        for _, row in all_socios_df.iterrows():
            if row['cnpj_basico'] in company_lookup:
                relationships.append({
                    'source': company_lookup[row['cnpj_basico']].strip().strip('"'),
                    'target': row['nome_socio_razao_social'].strip().strip('"'),
                    'relationship_type': 'company_to_socio',
                    'qualificacao_socio': row['qualificacao_socio'] if pd.notna(row['qualificacao_socio']) else None
                })
        
        # 3. Socios -> their other companies
        if len(socio_companies_df) > 0:
            socio_name_lookup = {str(row['cpf_cnpj_socio']).replace(r'[^0-9]', ''): row['nome_socio_razao_social'].strip().strip('"') 
                               for _, row in all_socios_df.iterrows() if pd.notna(row['cpf_cnpj_socio'])}
            
            for _, row in socio_companies_df.iterrows():
                cpf_cnpj_clean = str(row['cpf_cnpj_socio']).replace(r'[^0-9]', '') if pd.notna(row['cpf_cnpj_socio']) else ''
                if row['cnpj_basico'] in company_lookup and cpf_cnpj_clean in socio_name_lookup:
                    relationships.append({
                        'source': socio_name_lookup[cpf_cnpj_clean],
                        'target': company_lookup[row['cnpj_basico']].strip().strip('"'),
                        'relationship_type': 'socio_to_company',
                        'qualificacao_socio': row['qualificacao_socio'] if pd.notna(row['qualificacao_socio']) else None
                    })
        
        # Save results
        if relationships:
            network_df = pd.DataFrame(relationships)
            network_df.to_csv(output_file, index=False)
            print(f"\nNetwork generation complete!")
            print(f"Generated {len(network_df)} relationships")
            print(network_df['relationship_type'].value_counts().to_string())
            print(f"Output saved to: {output_file}")
            return output_file
        else:
            print("Warning: No relationships found")
            return None
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python generate_network_cpf.py <cpf_cnpj_socio>")
        sys.exit(1)
    
    cpf_cnpj_socio = sys.argv[1]
    generate_network_for_cpf(cpf_cnpj_socio)