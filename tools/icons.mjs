#!/usr/bin/env node
// 公式アイコンの対応表を作る：icons/<provider>/ 以下の SVG / PNG を探し、カタログの icon キーワードと突き合わせて icons/manifest.json に書く
//   1. 各社の配布ページからアイコンセットをダウンロードし、icons/aws・icons/gcp・icons/azure・icons/oci・icons/cloudflare・icons/k8s に展開
//   2. npm run icons
// アイコンは各社の利用規約に従うこと。このリポジトリには含めない（icons/ は .gitignore 済み）
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './load.mjs';

const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/catalog.js'), 'utf8'), ctx);
const { SERVICES } = ctx.window.Catalog;
const DIR = path.join(ROOT, 'icons');

const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
const norm = s => s.toLowerCase().replace(/[\s_\-]+/g, '-');
const compact = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const iconName = f => compact(path.basename(f, path.extname(f))
  .replace(/^\d+-icon-service-/i, '').replace(/[-_]512[-_]color(?:[-_]rgb)?$/i, ''));
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

const aws = path.join(DIR, 'aws'), extracted = path.join(aws, 'pptx-icons');
const indexFile = path.join(extracted, 'index.json');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--aws-pptx' || !/\.pptx$/i.test(args[1]))) {
  console.error('使い方: npm run icons -- [--aws-pptx <AWS ツールキット.pptx>]');
  process.exit(2);
}
const decks = args.length ? [path.resolve(args[1])] : walk(aws).filter(file => /\.pptx$/i.test(file)).sort();
let fromPptx = {};
if (fs.existsSync(indexFile)) fromPptx = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
if (decks.length) {
  const aliases = Object.fromEntries(Object.entries(SERVICES.aws).filter(([, service]) => service.icon)
    .map(([key, service]) => [key, [key, service.abbr, service.name, ...service.icon]]));
  const equivalents = {
    s3: ['Amazon Simple Storage Service', 'Amazon S3'], ec2: ['Amazon Elastic Compute Cloud', 'Amazon EC2'],
    lambda: ['AWS Lambda'], rds: ['Amazon Relational Database Service', 'Amazon RDS'],
    ecs: ['Amazon Elastic Container Service', 'Amazon ECS'],
    eks: ['Amazon Elastic Kubernetes Service', 'Amazon EKS'],
    cloudwatch: ['Amazon CloudWatch'], aurora: ['Amazon Aurora'],
  };
  for (const [key, names] of Object.entries(equivalents)) aliases[key].push(...names);
  const run = spawnSync('python', [path.join(ROOT, 'tools/import-aws-pptx.py'), extracted, ...decks],
    { input: JSON.stringify(aliases), encoding: 'utf8' });
  if (run.error || run.status !== 0) {
    console.error('AWS PowerPoint を読み込めませんでした。', run.error?.message || run.stderr.trim());
    process.exit(1);
  }
  const found = JSON.parse(run.stdout);
  if (Object.keys(found).length) {
    fromPptx = found;
    fs.writeFileSync(indexFile, JSON.stringify(fromPptx, null, 2) + '\n');
  } else {
    console.log('AWS PowerPoint にサービス名を照合できる埋め込み SVG / PNG が見つかりませんでした。');
  }
  console.log(`AWS PowerPoint：${Object.keys(found).length} 件を照合`);
}

const manifest = {}, missing = [];
for (const [p, svcs] of Object.entries(SERVICES)) {
  const files = walk(path.join(DIR, p)).filter(f => /\.(svg|png)$/i.test(f) && path.dirname(f) !== extracted);
  if (!files.length && !(p === 'aws' && Object.keys(fromPptx).length)) continue;
  for (const [k, s] of Object.entries(svcs)) {
    if (!s.icon) continue;
    const exactNames = [s.name, ...s.icon].map(compact).filter(Boolean);
    const exact = f => exactNames.includes(iconName(f));
    let hits = files.filter(f => exact(f) || s.icon.some(w => norm(path.basename(f)).includes(norm(w))));
    if (p === 'gcp') {
      const core = hits.filter(f => exact(f) && path.relative(path.join(DIR, p, 'core'), f).split(path.sep)[0] !== '..');
      if (core.length) hits = core;
      else if (hits.some(exact)) hits = hits.filter(exact);
    }
    if (p === 'azure' && hits.some(exact)) hits = hits.filter(exact);
    if (p === 'aws' && k === 'alb') {
      const application = hits.filter(f => norm(path.basename(f)).includes('application-load-balancer'));
      if (application.length) hits = application;
    }
    const imported = p === 'aws' && typeof fromPptx[k] === 'string' &&
      /^[a-z0-9-]+\.(svg|png)$/.test(fromPptx[k]) ? path.join(extracted, fromPptx[k]) : null;
    const best = hits.sort((a, b) => score(b) - score(a))[0] || (imported && fs.existsSync(imported) ? imported : null);
    if (!best) { missing.push(`${p}:${k}`); continue; }
    manifest[`${p}:${k}`] = path.relative(ROOT, best).split(path.sep).join('/');
  }
}
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);
fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`icons/manifest.json：${Object.keys(manifest).length} 件の対応`);
if (missing.length) console.log(`見つからなかった：${missing.join(', ')}（catalog.js の icon キーワードを調整してください）`);
if (!Object.keys(manifest).length) console.log('icons/<provider>/ にアイコンセットが見つかりません。README の「公式アイコン」を参照してください。');
