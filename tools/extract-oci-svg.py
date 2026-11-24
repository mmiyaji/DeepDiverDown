#!/usr/bin/env python3
"""Extract specific OCI service SVGs from Oracle's published icon package."""
from pathlib import Path
import sys
from zipfile import ZipFile

ICONS = {
    'Load-Balancer.svg': 'Networking/Load Balancer LB.svg',
    'Container-Engine.svg': 'Developer services/Container Engine For Kubernetes.svg',
    'Virtual-Machine.svg': 'Compute/Virtual Machine.svg',
    'Functions.svg': 'Compute/Functions.svg',
    'Autonomous-Database.svg': 'Database/Autonomous Database.svg',
    'Database-System.svg': 'Database/Database System.svg',
    'MySQL.svg': 'Database/MySQL HeatWave.svg',
    'Object-Storage.svg': 'Storage/Object Storage.svg',
    'Streaming.svg': 'Analytics & AI/Streaming.svg',
    'WAF.svg': 'Identity & Security/Web Application Firewall WAF.svg',
    'Vault.svg': 'Identity & Security/Vault.svg',
    'Dynamic-Routing-Gateway.svg': 'Networking/Dynamic Routing Gateway DRG.svg',
}

archive, destination = sys.argv[1:]
out = Path(destination)
out.mkdir(parents=True, exist_ok=True)
with ZipFile(archive) as package:
    for filename, member in ICONS.items():
        data = package.read('OCI_Uploaded to OMM/' + member)
        if b'<svg' not in data[:2048]:
            raise ValueError('Invalid SVG: ' + member)
        (out / filename).write_bytes(data)
print('oci: ' + str(len(ICONS)) + ' official SVG icons')
