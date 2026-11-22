#!/usr/bin/env node
// 点検スクリプト：全モデル（または引数で指定したモデル）を点検し、1 つでも不合格なら exit 1
//   node tools/gates.mjs [modelId ...]
import { loadAnalyze, loadModels, loadDocs } from './load.mjs';

const A = loadAnalyze();
let ok = true;
for (const { id, model, actual } of loadModels(process.argv.slice(2).length ? process.argv.slice(2) : null)) {
  const g = A.gates(model, actual, loadDocs(A, model));
  ok &&= g.pass;
  console.log(`\n■ ${id}（${model.name}） … ${g.pass ? '合格' : '不合格'}`);
  for (const r of g.results) {
    console.log(`  ${r.pass ? 'OK ' : 'NG '} ${r.id.padEnd(12)} ${r.label}（${r.detail}）`);
    if (!r.pass) r.items.slice(0, 8).forEach(x => console.log(`        - ${x}`));
  }
}
process.exit(ok ? 0 : 1);
