#!/usr/bin/env python3
"""Export selected icons from Oracle's unmodified draw.io library."""
import base64
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import unquote
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import zlib

ICONS = {
    'Autonomous-Database.svg': 'Database - Autonomous DB',
    'Container-Engine.svg': 'Developer Services - Container Engine for Kubernetes',
    'Database-System.svg': 'Database - Database System',
    'Dynamic-Routing-Gateway.svg': 'Networking - Dynamic Routing Gateway DRG',
    'FastConnect.svg': 'Physical - Special Connectors - FastConnect - Horizontal',
    'Functions.svg': 'Compute - Functions',
    'Load-Balancer.svg': 'Networking - Load Balancer',
    'MySQL.svg': 'Database - MySQL',
    'Object-Storage.svg': 'Storage - Object Storage',
    'Streaming.svg': 'Analytics and AI - Streaming',
    'Vault.svg': 'Identity and Security - Vault',
    'Virtual-Machine.svg': 'Compute - Virtual Machine VM',
    'WAF.svg': 'Identity and Security - WAF',
}


def drawio_executable():
    configured = os.environ.get('DRAWIO_BIN')
    candidates = [configured, shutil.which('drawio'), shutil.which('draw.io')]
    if os.name == 'nt':
        candidates.append(str(Path(os.environ.get('ProgramFiles', r'C:\Program Files')) / 'draw.io' / 'draw.io.exe'))
    elif sys.platform == 'darwin':
        candidates.append('/Applications/draw.io.app/Contents/MacOS/draw.io')
    return next((p for p in candidates if p and Path(p).is_file()), None)


def main():
    executable = drawio_executable()
    if not executable:
        print('draw.io が見つからないため OCI の SVG 出力を省略しました。DRAWIO_BIN を設定してください。', file=sys.stderr)
        return 2
    archive, output = sys.argv[1:]
    with ZipFile(archive) as package:
        library = ET.fromstring(package.read('OCI Style Guide for Drawio/OCI Library.xml'))
    entries = json.loads(library.text)
    by_title = {entry.get('title'): entry for entry in entries}
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='ddd-oci-export-') as tmp:
        for filename, title in ICONS.items():
            entry = by_title[title]
            xml = unquote(zlib.decompress(base64.b64decode(entry['xml']), -15).decode('utf-8'))
            # Validate the vendor's graph before wrapping it for draw.io.
            if ET.fromstring(xml).tag != 'mxGraphModel':
                raise ValueError('Invalid graph: ' + title)
            source = Path(tmp) / (filename + '.drawio')
            source.write_text('<mxfile><diagram name="icon">' + xml + '</diagram></mxfile>', encoding='utf-8')
            target = output / filename
            kwargs = {'capture_output': True, 'text': True, 'timeout': 60}
            if os.name == 'nt':
                kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
            result = subprocess.run([executable, '--export', '--format', 'svg', '--crop', '--output', str(target), str(source)], **kwargs)
            if result.returncode or not target.is_file():
                raise RuntimeError(f'draw.io: {title}: {result.stderr or result.stdout}')
    print('oci: ' + str(len(ICONS)) + ' SVG icons')
    return 0


if __name__ == '__main__':
    sys.exit(main())
