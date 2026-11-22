// Node から browser 用の js/analyze.js・js/catalog.js・js/layout.js を読み込み、YAML モデルを解析するための共通処理
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let cached;
export function loadAnalyze() {
  if (cached) return cached;
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of ['js/catalog.js', 'js/layout.js', 'js/analyze.js', 'js/views.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  cached = ctx.window.Analyze;
  cached.Catalog = ctx.window.Catalog;
  cached.layout = ctx.window.Layout.apply;
  cached.Views = ctx.window.Views;
  return cached;
}

/* YAML → モデル（座標のない部品は自動配置） */
export function readModel(file) {
  return loadAnalyze().layout(yaml.load(fs.readFileSync(file, 'utf8')));
}

export function loadModels(only) {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'models/registry.json'), 'utf8'));
  return reg.filter(r => !only || only.includes(r.id)).map(r => {
    const dir = path.join(ROOT, 'models', r.id);
    const model = readModel(path.join(dir, 'model.yaml'));
    const actual = r.actual ? yaml.load(fs.readFileSync(path.join(dir, 'actual.yaml'), 'utf8')) : null;
    return { id: r.id, dir, model, actual, reference: r.reference };
  });
}

export function loadDocs(A, model) {
  const docs = {};
  for (const src of model.sources || []) {
    const p = path.join(ROOT, src);
    if (fs.existsSync(p)) docs[src] = A.parseSections(fs.readFileSync(p, 'utf8'));
  }
  return docs;
}
