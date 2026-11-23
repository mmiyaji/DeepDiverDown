#!/usr/bin/env node
// 索引の生成：models/<id>/index.json に「ID → 要素」と「参照先（設計書の節・IaC・コード）→ ID」の逆引きを書き出す
//   AI エージェントはこの索引から必要な要素だけを引く（docs/AGENTS.md 参照）
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadAnalyze, loadModels, loadDocs } from './load.mjs';

const modelDir = path.join(ROOT, 'models');
const registry = JSON.parse(fs.readFileSync(path.join(modelDir, 'registry.json'), 'utf8'));
const tagsById = new Map(registry.map(({ id, tags }) => [id, tags || []]));
const docExists = src => /^docs\/[a-z0-9-]+\.md$/.test(src) && fs.existsSync(path.join(ROOT, src));

function officialSources(sources = []) {
  return sources.filter(({ title, url }) => {
    try { return Boolean(title) && ['http:', 'https:'].includes(new URL(url).protocol); }
    catch { return false; }
  });
}

function writeIndex(file, value, label) {
  const expected = JSON.stringify(value, null, 2) + '\n';
  if (!check) {
    fs.writeFileSync(file, expected);
  } else if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== expected) {
    console.error(`${label} が最新ではありません。npm run index を実行してください。`);
    process.exitCode = 1;
  }
}

const A = loadAnalyze();
const check = process.argv.includes('--check');
const entries = [];
for (const { id, dir, model, actual, reference } of loadModels()) {
  const idx = A.index(model), cls = A.classify(model, actual), cov = A.coverage(model, actual, loadDocs(A, model));
  for (const [k, v] of Object.entries(idx.byId)) {
    const r = cls.nodes[k] || cls.links[k] || cls.reqs[k];
    if (r) v.status = r.status;
  }
  // 生成日時は入れない（内容が同じなら差分を出さないため）
  const out = { model: id, name: model.name, coverage: { covered: cov.covered, total: cov.total }, byId: idx.byId, byRef: idx.byRef };
  if (reference) {
    const { objectives, sources } = model.reference || {};
    out.reference = { ...reference, objectives, sources };
    entries.push({
      id, name: model.name, description: model.description || '',
      domain: reference.domain, category: reference.category, kind: reference.kind,
      tags: tagsById.get(id), objectives: objectives || [],
      documents: [...new Set([`docs/reference-${id}.md`, ...(model.sources || [])])].filter(docExists),
      sources: officialSources(sources),
      implementations: (model.implementations || []).map(({ id, label, sources }) =>
        ({ id, label, sources: officialSources(sources) })),
    });
  }
  writeIndex(path.join(dir, 'index.json'), out, `${id}: index.json`);
  if (!check) console.log(`${id}: ${Object.keys(idx.byId).length} ids / ${Object.keys(idx.byRef).length} refs`);
}

// 収録時点の ID は別ファイルで固定し、浅い checkout でも同じ集約を生成する。
const history = JSON.parse(fs.readFileSync(path.join(modelDir, 'research-history.json'), 'utf8'));
writeIndex(path.join(modelDir, 'research-index.json'), { entries, history }, 'models/research-index.json');
if (!check) console.log(`research-index.json: ${entries.length} references / ${history.length} history entries`);
