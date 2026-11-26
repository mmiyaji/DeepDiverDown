import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

const load = id => yaml.load(readFileSync(new URL(`../models/${id}/model.yaml`, import.meta.url), 'utf8'));

test('Liquid Clustering のキー変更とファイル書き換えは別のステップで追える', () => {
  const model = load('databricks-liquid-clustering-internals');
  const parent = load('databricks-sql-performance');
  assert.equal(parent.nodes.layout.drill, 'databricks-liquid-clustering-internals');
  const change = model.scenarios.find(s => s.id === 'key-change');
  assert.ok(change.steps[0].links.includes('manual'));
  assert.ok(!change.steps[0].links.includes('write'));
  assert.ok(change.steps.at(-1).links.includes('commit'));
  assert.ok(model.implementations[0].groups.some(g => g.provider === 'aws' && g.nodes.includes('ex-log')));
  assert.ok(model.implementations[0].groups.some(g => g.provider === 'databricks' && g.nodes.includes('ex-optimize')));
});
