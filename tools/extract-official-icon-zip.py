#!/usr/bin/env python3
"""Extract only SVGs from the vendors' fixed icon archives.

The archive path is supplied by fetch-provider-icons.mjs; no archive member
can choose a path outside the destination. Keep the original directory names
so the manifest builder can prefer Google Cloud's core icons over legacy ones.
"""
import os
from pathlib import Path, PurePosixPath
import sys
import zipfile

archive, destination, source_kind = sys.argv[1:]
root = Path(destination).resolve()
root.mkdir(parents=True, exist_ok=True)
count = 0
with zipfile.ZipFile(archive) as package:
    for info in package.infolist():
        member = PurePosixPath(info.filename)
        if (info.is_dir() or member.suffix.lower() != '.svg' or not member.parts
                or '__MACOSX' in member.parts or member.is_absolute()
                or any(part in ('.', '..') or '\\' in part or ':' in part for part in member.parts)):
            continue
        if source_kind == 'aws' and not (
                (member.parts[0].startswith('Architecture-Service-Icons_') and '64' in member.parts)
                or member.parts[0].startswith('Resource-Icons_')):
            continue
        target = root.joinpath(*member.parts)
        if os.path.commonpath((str(root), str(target.resolve()))) != str(root):
            raise ValueError('Unsafe archive member: ' + info.filename)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(package.read(info))
        count += 1
if not count:
    raise ValueError('No SVG icons found in ' + archive)
print(source_kind + ': ' + str(count) + ' SVG icons')
