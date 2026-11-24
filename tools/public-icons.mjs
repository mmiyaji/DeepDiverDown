import fs from 'node:fs';
import path from 'node:path';

// The icon tree is ignored by Git and may include archives or local user files.
// Only publish verified, manifest-referenced images inside that tree.
export function copyPublicIcons(root, out, { required = false } = {}) {
  const manifestFile = path.join(root, 'icons', 'manifest.json');
  if (!fs.existsSync(manifestFile)) {
    if (required) throw new Error('Official icon manifest not found');
    return 0;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Invalid icon manifest');
  const entries = Object.entries(manifest);
  if (required && !entries.length) throw new Error('Official icon manifest is empty');
  const iconRoot = fs.realpathSync(path.join(root, 'icons'));
  for (const [id, file] of entries) {
    if (!/^[a-z0-9_-]+:[a-z0-9_-]+$/i.test(id) || typeof file !== 'string' || !/^icons\/[^\\?#%]+\.(svg|png)$/i.test(file) || file.split('/').some(part => part === '.' || part === '..' || part === '')) throw new Error(`Invalid icon entry: ${id}`);
    const source = fs.realpathSync(path.join(root, file));
    const relative = path.relative(iconRoot, source);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || !fs.statSync(source).isFile()) throw new Error(`Icon outside icons directory: ${id}`);
    const dest = path.join(out, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, dest);
  }
  fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(out, 'icons', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return entries.length;
}
