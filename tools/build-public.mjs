#!/usr/bin/env node
// Assemble a reference-only static site into a new, explicitly specified directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2];
if (!arg) throw new Error('Usage: node tools/build-public.mjs <new-output-directory>');
const out = path.resolve(arg);
if (out === root || fs.existsSync(out)) throw new Error('Output must be a new directory');
fs.mkdirSync(out, { recursive: true });
function copy(rel) {
  const src = path.join(root, rel), dest = path.join(out, rel);
  if (!fs.existsSync(src)) throw new Error(`Missing public asset: ${rel}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}
for (const file of ['index.html', 'home.html', 'research.html', 'knowledge-graph.html', 'objects.html', 'brand-mark.svg', 'css', 'js', 'vendor', 'docs/object-samples']) copy(file);
const registry = JSON.parse(fs.readFileSync(path.join(root, 'models/registry.json'), 'utf8')).filter(e => e.reference);
if (!registry.length) throw new Error('No reference models found');
for (const entry of registry) {
  if (!/^[a-z0-9-]+$/.test(entry.id)) throw new Error('Invalid reference ID');
  copy(`models/${entry.id}/model.yaml`);
  const doc = `docs/reference-${entry.id}.md`;
  if (fs.existsSync(path.join(root, doc))) copy(doc);
}
for (const doc of ['docs/reference-modern-data-stack-candidates.md']) if (fs.existsSync(path.join(root, doc))) copy(doc);
const publicRegistry = registry.map(({ actual, compare, ...entry }) => ({ ...entry, actual: false }));
fs.writeFileSync(path.join(out, 'models/registry.json'), JSON.stringify(publicRegistry, null, 2) + '\n');
const index = JSON.parse(fs.readFileSync(path.join(root, 'models/research-index.json'), 'utf8'));
const ids = new Set(registry.map(entry => entry.id));
index.entries = index.entries.filter(entry => ids.has(entry.id)).map(entry => ({ ...entry, documents: (entry.documents || []).filter(doc => /^docs\/reference-[a-z0-9-]+\.md$/.test(doc) && fs.existsSync(path.join(out, doc))) }));
fs.writeFileSync(path.join(out, 'models/research-index.json'), JSON.stringify(index, null, 2) + '\n');
fs.writeFileSync(path.join(out, '_headers'), '/*\n  Cache-Control: public, max-age=0, must-revalidate\n  X-Content-Type-Options: nosniff\n  X-Robots-Tag: noindex, nofollow, noarchive\n');
fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log(`Prepared ${registry.length} references in ${out}`);
