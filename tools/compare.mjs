#!/usr/bin/env node
// 2 つのモデル YAML を比較して変更点を表示する
//   node tools/compare.mjs <旧.yaml> <新.yaml>
//   例：git show HEAD~1:models/ec-shop/model.yaml > old.yaml && node tools/compare.mjs old.yaml models/ec-shop/model.yaml
import fs from 'node:fs';
import yaml from 'js-yaml';
import { loadAnalyze } from './load.mjs';

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error('usage: node tools/compare.mjs <old.yaml> <new.yaml>'); process.exit(2); }
const r = loadAnalyze().compareModels(yaml.load(fs.readFileSync(a, 'utf8')), yaml.load(fs.readFileSync(b, 'utf8')));
const mark = { added: '+', removed: '-', changed: '~' };
for (const c of r.changes) console.log(`${mark[c.kind]} [${c.type}] ${c.msg}`);
console.log(`\n追加 ${r.changes.filter(c => c.kind === 'added').length} / 削除 ${r.changes.filter(c => c.kind === 'removed').length} / 変更 ${r.changes.filter(c => c.kind === 'changed').length}`);
