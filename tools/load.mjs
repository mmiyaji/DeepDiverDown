// Node から browser 用の js/analyze.js・js/aws.js を読み込み、YAML モデルを解析するための共通処理
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadAnalyze() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of ['js/aws.js', 'js/analyze.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx.window.Analyze;
}

export function loadModels(only) {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'models/registry.json'), 'utf8'));
  return reg.filter(r => !only || only.includes(r.id)).map(r => {
    const dir = path.join(ROOT, 'models', r.id);
    const model = yaml.load(fs.readFileSync(path.join(dir, 'model.yaml'), 'utf8'));
    const actual = r.actual ? yaml.load(fs.readFileSync(path.join(dir, 'actual.yaml'), 'utf8')) : null;
    return { id: r.id, dir, model, actual };
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
