"""手元の PPTX から、AWS サービス名を確認できる埋め込み SVG / PNG を取り出す。"""
import hashlib
import json
import posixpath
import re
import sys
from pathlib import Path
from urllib.parse import unquote
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

NS = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'svg': 'http://schemas.microsoft.com/office/drawing/2016/SVG/main',
}
EMBED = '{' + NS['r'] + '}embed'
PART = re.compile(r'ppt/(?:slides/slide|slideLayouts/slideLayout|slideMasters/slideMaster)\d+\.xml')
LIMIT = 8 * 1024 * 1024


def names(value):
    for name in [value, *re.split(r'[()\n]', value)]:
        name = re.sub(r'\.(svg|png)$', '', name.strip(), flags=re.I)
        tokens = re.findall(r'[a-z0-9]+', name.lower())
        if not tokens or tokens[0] in {'res', 'resource'}:
            continue
        while tokens and tokens[0] in {'arch', 'aws', 'amazon'}:
            tokens.pop(0)
        if tokens and tokens[-1] in {'16', '32', '48', '64', '128', '256'}:
            tokens.pop()
        if tokens:
            yield ''.join(tokens)


def parse(zipped, part):
    try:
        info = zipped.getinfo(part)
    except KeyError:
        return None
    if info.file_size > LIMIT:
        return None
    return ET.fromstring(zipped.read(info))


def picture_names(picture):
    meta = picture.find('p:nvPicPr/p:cNvPr', NS)
    if meta is not None:
        for attr in ('title', 'descr', 'name'):
            yield meta.get(attr, '')


def by_caption(slide):
    """同じグループに画像が1枚だけあるときに限り、ラベルを候補にする。"""
    for group in slide.findall('.//p:grpSp', NS):
        pictures = group.findall('.//p:pic', NS)
        if len(pictures) == 1:
            labels = []
            for shape in group.findall('p:sp', NS):
                paragraphs = shape.findall('.//a:p', NS)
                text = '\n'.join(''.join(t.text or '' for t in paragraph.findall('.//a:t', NS))
                                 for paragraph in paragraphs)
                labels.append(text)
            yield pictures[0], labels


def inspect_file(filename, aliases, selected):
    with ZipFile(filename) as zipped:
        for part in sorted(zipped.namelist()):
            if not PART.fullmatch(part):
                continue
            folder, short = posixpath.split(part)
            slide = parse(zipped, part)
            rels = parse(zipped, f'{folder}/_rels/{short}.rels')
            if slide is None or rels is None:
                continue
            targets = {
                rel.get('Id'): posixpath.normpath(posixpath.join(folder, unquote(rel.get('Target', ''))))
                if not rel.get('Target', '').startswith('/') else unquote(rel.get('Target', '')).lstrip('/')
                for rel in rels if rel.get('TargetMode', 'Internal') == 'Internal'
                and rel.get('Type', '').endswith('/image')
            }
            captions = dict(by_caption(slide))
            for pic in slide.findall('.//p:pic', NS):
                links = [*pic.findall('.//svg:svgBlip', NS), *pic.findall('p:blipFill/a:blip', NS)]
                for link in links:
                    target = targets.get(link.get(EMBED), '')
                    ext = posixpath.splitext(target)[1].lower()
                    if not target.startswith('ppt/media/') or ext not in {'.png', '.svg'}:
                        continue
                    keys = set().union(*(aliases.get(name, set()) for label in
                        [*picture_names(pic), posixpath.basename(target)] for name in names(label)))
                    reliability = 1
                    if not keys:
                        reliability = 0
                        keys = set().union(*(aliases.get(name, set()) for label in
                            captions.get(pic, []) for name in names(label)))
                    if len(keys) != 1:
                        continue
                    key = next(iter(keys))
                    quality = (reliability, ext == '.svg')
                    if key in selected and selected[key][0] >= quality:
                        continue
                    try:
                        entry = zipped.getinfo(target)
                    except KeyError:
                        continue
                    if entry.file_size > LIMIT:
                        continue
                    content = zipped.read(entry)
                    if ext == '.png' and not content.startswith(b'\x89PNG\r\n\x1a\n'):
                        continue
                    if ext == '.svg':
                        try:
                            if ET.fromstring(content).tag != '{http://www.w3.org/2000/svg}svg':
                                continue
                        except ET.ParseError:
                            continue
                    selected[key] = (quality, ext, content)


def main():
    output = Path(sys.argv[1])
    alias_map = {}
    for key, labels in json.load(sys.stdin).items():
        for normalized in {n for label in labels for n in names(label)}:
            alias_map.setdefault(normalized, set()).add(key)

    selected = {}
    for filename in sys.argv[2:]:
        inspect_file(filename, alias_map, selected)
    if not selected:
        print('{}')
        return
    output.mkdir(parents=True, exist_ok=True)
    files = {}
    for key, (_, ext, content) in selected.items():
        digest = hashlib.sha256(content).hexdigest()[:16]
        filename = f'{key}-{digest}{ext}'
        (output / filename).write_bytes(content)
        files[key] = filename
    print(json.dumps(files))


if __name__ == '__main__':
    try:
        main()
    except (OSError, BadZipFile, ET.ParseError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
