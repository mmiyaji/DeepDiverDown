#!/usr/bin/env node
// 索引の生成：models/<id>/index.json に「ID → 要素」と「参照先（設計書の節・IaC・コード）→ ID」の逆引きを書き出す
//   AI エージェントはこの索引から必要な要素だけを引く（docs/AGENTS.md 参照）
import fs from 'node:fs';
import path from 'node:path';
import { loadAnalyze, loadModels, loadDocs } from './load.mjs';

const A = loadAnalyze();
for (const { id, dir, model, actual, reference } of loadModels()) {
  const idx = A.index(model), cls = A.classify(model, actual), cov = A.coverage(model, actual, loadDocs(A, model));
  for (const [k, v] of Object.entries(idx.byId)) {
    const r = cls.nodes[k] || cls.links[k] || cls.reqs[k];
    if (r) v.status = r.status;
  }
  // 生成日時は入れない（内容が同じなら差分を出さないため）
  const out = { model: id, name: model.name, coverage: { covered: cov.covered, total: cov.total }, byId: idx.byId, byRef: idx.byRef };
  if (reference) out.reference = { ...reference, ...model.reference };
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`${id}: ${Object.keys(idx.byId).length} ids / ${Object.keys(idx.byRef).length} refs`);
}
