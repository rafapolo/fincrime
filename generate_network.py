#!/usr/bin/env python3

import pandas as pd
import duckdb
import sys
import re
import os
from pathlib import Path

def generate_network():
    """Generate network.csv with expanded relationships"""

    # Configuration
    input_file = "input/combustiveis.csv"
    output_file = f"output/network_{Path(input_file).stem}x.csv"
    db_path = "/Users/polux/Projetos/empresas/db/empresas.duckdb"

    # Helper to clean digits
    def clean_digits(val):
        if pd.isna(val):
            return ""
        return re.sub(r"[^0-9]", "", str(val))

    conn = None
    try:
        # Connect to database
        conn = duckdb.connect(db_path, read_only=True)

        # 1) Load initial companies (from establishments) and normalize CNPJ
        q_est = "SELECT cnpj_basico FROM companies.estabelecimentos WHERE cnpj_basico ='33923798'"
        companies_df = conn.execute(q_est).df()
        if companies_df.empty:
            print("No input companies found from establishments query")
            return

        companies_df['cnpj_clean'] = companies_df['cnpj_basico'].astype(str).apply(clean_digits)
        companies_df = companies_df[companies_df['cnpj_clean'].str.len() > 0].drop_duplicates(subset=['cnpj_clean'])

        print(f"Processing {len(companies_df)} input companies...")

        # Register a small temp table with cleaned CNPJs for safe joins
        input_companies = companies_df[['cnpj_clean']].rename(columns={'cnpj_clean': 'cnpj_clean'})
        conn.register('input_companies', input_companies)

        # 2) Query socios for input companies (join using cleaned values)
        q_socios = """
        SELECT s.cnpj_basico, s.cpf_cnpj_socio, s.nome_socio_razao_social
        FROM companies.socios s
        JOIN input_companies ic ON regexp_replace(s.cnpj_basico, '[^0-9]', '') = ic.cnpj_clean
        WHERE s.nome_socio_razao_social IS NOT NULL AND s.nome_socio_razao_social != ''
        """
        socios_df = conn.execute(q_socios).df()
        socios_df['cnpj_clean'] = socios_df['cnpj_basico'].astype(str).apply(clean_digits)
        socios_df['socio_id_clean'] = socios_df['cpf_cnpj_socio'].astype(str).apply(clean_digits)
        socios_df = socios_df[socios_df['socio_id_clean'].str.len() > 0].drop_duplicates()
        print(f"Found {len(socios_df)} socios from input companies")

        # 3) Find companies where those socios are partners
        socio_companies_df = pd.DataFrame()
        socio_ids = socios_df['socio_id_clean'].dropna().unique().tolist()
        if socio_ids:
            socio_ids_df = pd.DataFrame({'cpf_cnpj_socio': socio_ids})
            conn.register('socio_ids', socio_ids_df)
            q_socio_companies = """
            SELECT cs.cnpj_basico, cs.cpf_cnpj_socio, cs.nome_socio_razao_social
            FROM companies.socios cs
            JOIN socio_ids si ON regexp_replace(cs.cpf_cnpj_socio, '[^0-9]', '') = si.cpf_cnpj_socio
            WHERE cs.nome_socio_razao_social IS NOT NULL AND cs.nome_socio_razao_social != ''
            """
            socio_companies_df = conn.execute(q_socio_companies).df()
            socio_companies_df['cnpj_clean'] = socio_companies_df['cnpj_basico'].astype(str).apply(clean_digits)
            socio_companies_df['socio_id_clean'] = socio_companies_df['cpf_cnpj_socio'].astype(str).apply(clean_digits)
            socio_companies_df = socio_companies_df.drop_duplicates()
            print(f"Found {len(socio_companies_df)} companies where socios are partners")

        # 4) Get socios of newly discovered companies (excluding already seen companies)
        new_company_socios_df = pd.DataFrame()
        new_cnpjs = []
        if not socio_companies_df.empty:
            discovered = pd.Series(socio_companies_df['cnpj_clean'].unique())
            # exclude those already in input
            known = set(input_companies['cnpj_clean'].tolist())
            new_cnpjs = [c for c in discovered.tolist() if c not in known and c]
        if new_cnpjs:
            new_cnpjs_df = pd.DataFrame({'cnpj_clean': new_cnpjs})
            conn.register('new_companies', new_cnpjs_df)
            q_new_company_socios = """
            SELECT s.cnpj_basico, s.cpf_cnpj_socio, s.nome_socio_razao_social
            FROM companies.socios s
            JOIN new_companies nc ON regexp_replace(s.cnpj_basico, '[^0-9]', '') = nc.cnpj_clean
            WHERE s.nome_socio_razao_social IS NOT NULL AND s.nome_socio_razao_social != ''
            """
            new_company_socios_df = conn.execute(q_new_company_socios).df()
            new_company_socios_df['cnpj_clean'] = new_company_socios_df['cnpj_basico'].astype(str).apply(clean_digits)
            new_company_socios_df['socio_id_clean'] = new_company_socios_df['cpf_cnpj_socio'].astype(str).apply(clean_digits)
            new_company_socios_df = new_company_socios_df.drop_duplicates()
            print(f"Found {len(new_company_socios_df)} socios from newly discovered companies")

        # 5) For completeness, find companies for those new socios (second expansion)
        new_socio_companies_df = pd.DataFrame()
        new_socio_ids = new_company_socios_df['socio_id_clean'].dropna().unique().tolist() if not new_company_socios_df.empty else []
        if new_socio_ids:
            new_socio_ids_df = pd.DataFrame({'cpf_cnpj_socio': new_socio_ids})
            conn.register('new_socio_ids', new_socio_ids_df)
            q_new_socio_companies = """
            SELECT cs.cnpj_basico, cs.cpf_cnpj_socio, cs.nome_socio_razao_social
            FROM companies.socios cs
            JOIN new_socio_ids ns ON regexp_replace(cs.cpf_cnpj_socio, '[^0-9]', '') = ns.cpf_cnpj_socio
            WHERE cs.nome_socio_razao_social IS NOT NULL AND cs.nome_socio_razao_social != ''
            """
            new_socio_companies_df = conn.execute(q_new_socio_companies).df()
            new_socio_companies_df['cnpj_clean'] = new_socio_companies_df['cnpj_basico'].astype(str).apply(clean_digits)
            new_socio_companies_df['socio_id_clean'] = new_socio_companies_df['cpf_cnpj_socio'].astype(str).apply(clean_digits)
            new_socio_companies_df = new_socio_companies_df.drop_duplicates()
            print(f"Found {len(new_socio_companies_df)} additional companies where new socios are partners")

        # 6) Build a unified set of company CNPJs to fetch names
        all_cnpjs = set()
        for df in [socios_df, socio_companies_df, new_company_socios_df, new_socio_companies_df]:
            if not df.empty:
                all_cnpjs.update(df['cnpj_clean'].dropna().unique())
        # include original input companies
        all_cnpjs.update(companies_df['cnpj_clean'].dropna().unique())

        company_lookup = {}
        if all_cnpjs:
            all_cnpjs_df = pd.DataFrame({'cnpj_clean': list(all_cnpjs)})
            conn.register('all_cnpjs', all_cnpjs_df)
            q_names = """
            SELECT e.cnpj_basico, e.razao_social
            FROM companies.empresas e
            JOIN all_cnpjs a ON regexp_replace(e.cnpj_basico, '[^0-9]', '') = a.cnpj_clean
            WHERE e.razao_social IS NOT NULL AND e.razao_social != ''
            """
            company_names_df = conn.execute(q_names).df()
            for _, row in company_names_df.iterrows():
                key = clean_digits(row['cnpj_basico'])
                company_lookup[key] = str(row['razao_social']).strip().strip('"')

        # Fallback: use establishments' razao_social if present for inputs
        for _, row in companies_df.iterrows():
            k = row['cnpj_clean']
            if k and k not in company_lookup:
                company_lookup[k] = str(row.get('razao_social', '') or '').strip()

        # 7) Create relationships
        relationships = []

        def safe_name(name):
            return '' if pd.isna(name) else str(name).strip().strip('"')

        # company -> its socios (from initial empresas)
        for _, row in socios_df.iterrows():
            src_key = row['cnpj_clean']
            src_name = company_lookup.get(src_key, src_key)
            tgt = safe_name(row['nome_socio_razao_social'])
            if src_name and tgt:
                relationships.append({'source': src_name, 'target': tgt, 'relationship_type': 'company_to_socio'})

        # socio -> other companies
        if not socio_companies_df.empty:
            # build socio name lookup from socios_df
            socio_name_lookup = {}
            for _, r in socios_df.iterrows():
                sid = r['socio_id_clean']
                if sid:
                    socio_name_lookup[sid] = safe_name(r['nome_socio_razao_social'])

            for _, row in socio_companies_df.iterrows():
                sid = row['socio_id_clean']
                tgt_key = row['cnpj_clean']
                tgt_name = company_lookup.get(tgt_key, tgt_key)
                src_name = socio_name_lookup.get(sid, '')
                if src_name and tgt_name:
                    relationships.append({'source': src_name, 'target': tgt_name, 'relationship_type': 'socio_to_company'})

        # newly discovered companies -> their socios
        for _, row in new_company_socios_df.iterrows():
            src_key = row['cnpj_clean']
            src_name = company_lookup.get(src_key, src_key)
            tgt = safe_name(row['nome_socio_razao_social'])
            if src_name and tgt:
                relationships.append({'source': src_name, 'target': tgt, 'relationship_type': 'new_company_to_socio'})

        # new socios -> their companies
        if not new_socio_companies_df.empty:
            new_socio_name_lookup = {}
            for _, r in new_company_socios_df.iterrows():
                sid = r['socio_id_clean']
                if sid:
                    new_socio_name_lookup[sid] = safe_name(r['nome_socio_razao_social'])

            for _, row in new_socio_companies_df.iterrows():
                sid = row['socio_id_clean']
                tgt_key = row['cnpj_clean']
                tgt_name = company_lookup.get(tgt_key, tgt_key)
                src_name = new_socio_name_lookup.get(sid, '')
                if src_name and tgt_name:
                    relationships.append({'source': src_name, 'target': tgt_name, 'relationship_type': 'new_socio_to_company'})

        # 8) Save deduped relationships
        if relationships:
            network_df = pd.DataFrame(relationships)
            network_df['source'] = network_df['source'].astype(str)
            network_df['target'] = network_df['target'].astype(str)
            network_df = network_df.drop_duplicates(subset=['source', 'target', 'relationship_type'])

            # ensure output dir
            Path(output_file).parent.mkdir(parents=True, exist_ok=True)
            network_df.to_csv(output_file, index=False)
            print(f"\nNetwork generation complete!")
            print(f"Generated {len(network_df)} relationships")
            print(network_df['relationship_type'].value_counts().to_string())
            print(f"Output saved to: {output_file}")
        else:
            print("Warning: No relationships found")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    generate_network()