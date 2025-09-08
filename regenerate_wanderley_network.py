#!/usr/bin/env python3

import subprocess
import sys
from pathlib import Path

def regenerate_wanderley_network():
    """Regenerate the Wanderley network with qualificacao_socio data"""
    
    cpf = "00640854737"  # Eduardo Monteiro Wanderley
    
    print("Regenerating Wanderley network with qualificacao_socio data...")
    print(f"CPF: {cpf}")
    
    # Step 1: Generate the network CSV with qualificacao_socio
    print("\nStep 1: Generating network CSV...")
    result1 = subprocess.run([
        sys.executable, 
        "generate_network_cpf.py", 
        cpf
    ], capture_output=True, text=True)
    
    if result1.returncode != 0:
        print(f"Error generating network CSV: {result1.stderr}")
        return False
    
    print(result1.stdout)
    
    # Step 2: Convert to Cosmograph format with qualificacao_socio
    print("\nStep 2: Converting to Cosmograph format...")
    result2 = subprocess.run([
        sys.executable, 
        "convert_cpf_to_cosmograph.py", 
        cpf
    ], capture_output=True, text=True)
    
    if result2.returncode != 0:
        print(f"Error converting to Cosmograph format: {result2.stderr}")
        return False
    
    print(result2.stdout)
    
    # Check if output files exist
    csv_file = Path(f"output/network_{cpf}.csv")
    json_file = Path(f"output/network_{cpf}_cosmograph.json")
    
    if csv_file.exists() and json_file.exists():
        print(f"\n✅ Successfully generated network files:")
        print(f"   CSV: {csv_file}")
        print(f"   JSON: {json_file}")
        print(f"\nThe wanderley.html visualization should now display qualificacao_socio information!")
        return True
    else:
        print(f"\n❌ Error: Expected output files not found:")
        if not csv_file.exists():
            print(f"   Missing: {csv_file}")
        if not json_file.exists():
            print(f"   Missing: {json_file}")
        return False

if __name__ == "__main__":
    success = regenerate_wanderley_network()
    if not success:
        sys.exit(1)