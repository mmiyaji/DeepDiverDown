#!/usr/bin/env node
// 公式アイコンの対応表を作る：icons/<provider>/ 以下の SVG / PNG を探し、カタログの icon キーワードと突き合わせて icons/manifest.json に書く
//   1. 各社の配布ページからアイコンセットをダウンロードし、icons/aws・icons/gcp・icons/azure・icons/oci・icons/cloudflare・icons/k8s に展開
//   2. npm run icons
// アイコンは各社の利用規約に従うこと。このリポジトリには含めない（icons/ は .gitignore 済み）
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './load.mjs';

const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/catalog.js'), 'utf8'), ctx);
const { SERVICES } = ctx.window.Catalog;
const DIR = path.join(ROOT, 'icons');

const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
const norm = s => s.toLowerCase().replace(/[\s_\-]+/g, '-');
// 好ましい候補：SVG > PNG、サイズ 64 / 48 / 32、"Arch_" / "Res_" のうちアーキテクチャ用、ダーク版・ライト背景用でないもの
const score = f => {
  const b = path.basename(f).toLowerCase();
  let s = 0;
  if (b.endsWith('.svg')) s += 10;
  if (/_64|64x64|-64/.test(b)) s += 4; else if (/_48|48x48|-48/.test(b)) s += 3; else if (/_32|-32/.test(b)) s += 2;
  if (b.startsWith('arch_')) s += 3;
  if (/dark|light-bg|_light/.test(b)) s -= 2;
  return s - b.length / 1000;
};

const manifest = {}, missing = [];
for (const [p, svcs] of Object.entries(SERVICES)) {
  const files = walk(path.join(DIR, p)).filter(f => /\.(svg|png)$/i.test(f));
  if (!files.length) continue;
  for (const [k, s] of Object.entries(svcs)) {
    if (!s.icon) continue;
    const hits = files.filter(f => s.icon.some(w => norm(path.basename(f)).includes(norm(w))));
    if (!hits.length) { missing.push(`${p}:${k}`); continue; }
    const best = hits.sort((a, b) => score(b) - score(a))[0];
    manifest[`${p}:${k}`] = path.relative(ROOT, best).split(path.sep).join('/');
  }
}
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);
fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`icons/manifest.json：${Object.keys(manifest).length} 件の対応`);
if (missing.length) console.log(`見つからなかった：${missing.join(', ')}（catalog.js の icon キーワードを調整してください）`);
if (!Object.keys(manifest).length) console.log('icons/<provider>/ にアイコンセットが見つかりません。README の「公式アイコン」を参照してください。');
