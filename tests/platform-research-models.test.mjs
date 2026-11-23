import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { loadAnalyze } from '../tools/load.mjs';
import { implementation3D } from '../js/implementation-3d.js';
import { buildDiagramLayout } from '../js/diagram-layout.js';

const ids = ['snowflake-snowpipe-streaming-internals', 'snowflake-kafka-iceberg-streaming', 'snowflake-optima-internals', 'snowflake-iceberg-vended-credentials', 'snowflake-iceberg-s3-compatible', 'snowflake-aggregation-placement', 'databricks-streaming-state-internals', 'databricks-deletion-vectors-internals', 'databricks-unity-vended-credentials', 'databricks-dynamic-file-pruning'];
const load = id => yaml.load(readFileSync(new URL(`../models/${id}/model.yaml`, import.meta.url), 'utf8'));
const link = (model, id) => model.links.find(l => l.id === id);

test('追加した調査モデルは参照先・接続・シナリオ・実装例を持つ', () => {
  const registry = JSON.parse(readFileSync(new URL('../models/registry.json', import.meta.url), 'utf8'));
  for (const id of ids) {
    const model = load(id);
    assert.ok(registry.some(entry => entry.id === id), id);
    assert.ok(model.reference.sources.length >= 2, id);
    assert.ok(model.implementations.length, id);
    for (const edge of model.links) assert.ok(model.nodes[edge.from] && model.nodes[edge.to], `${id}: ${edge.id}`);
    for (const step of model.scenarios.flatMap(s => s.steps)) for (const edge of step.links) assert.ok(link(model, edge), `${id}: ${edge}`);
    const parent = load(model.parent.model);
    assert.ok(parent.nodes[model.parent.node], `${id}: parent`);
    assert.equal(parent.nodes[model.parent.node].drill, id, `${id}: detail navigation`);
  }
});

test('事前クラスタリングの有無と差分・状態の復旧は別の経路', () => {
  const snow = load('snowflake-snowpipe-streaming-internals');
  assert.deepEqual([link(snow, 'direct').from, link(snow, 'direct').to], ['job', 'table']);
  assert.deepEqual([link(snow, 'prepare').from, link(snow, 'prepare').to], ['job', 'cluster']);
  const streaming = load('databricks-streaming-state-internals');
  for (const id of ['restore', 'replay', 'resume']) assert.equal(link(streaming, id).to, 'restart');
  assert.ok(streaming.blocks.some(block => block.items.delta.length === 2));
});

test('論理削除とファイルの書き換え・削除は独立する', () => {
  const model = load('databricks-deletion-vectors-internals');
  assert.deepEqual([link(model, 'mark').from, link(model, 'mark').to], ['locate', 'dv']);
  assert.deepEqual([link(model, 'apply').from, link(model, 'apply').to], ['dv', 'read']);
  assert.deepEqual([link(model, 'cleanup').from, link(model, 'cleanup').to], ['purge', 'vacuum']);
  assert.ok(model.scenarios[0].steps[0].links.includes('mark'));
  assert.ok(!model.scenarios[0].steps[0].links.includes('cleanup'));
});

test('すべての実装例は 2D と 3D に同じ部品と接続を投影できる', () => {
  const { Views } = loadAnalyze();
  for (const id of ids) {
    const model = load(id);
    for (const example of model.implementations) {
      const base = Views.project(model, model, `impl:${example.id}`);
      for (const flat of [true, false]) {
        const view = implementation3D(base, flat ? example.layout2d : example.layout3d, { flat });
        const layout = buildDiagramLayout(view, { flat, width: 900, height: 600 });
        assert.deepEqual(Object.keys(view.nodes).sort(), Object.keys(base.nodes).sort(), `${id}: ${flat}`);
        assert.equal(view.links.length, base.links.length, `${id}: ${flat}`);
        for (const [nodeId, node] of Object.entries(view.nodes))
          assert.ok(layout.point(node.x, node.y, node.tier).every(Number.isFinite), `${id}: ${nodeId}`);
        for (const edge of view.links) {
          const points = layout.routes.get(edge.id);
          assert.ok(points?.length >= 2 && points.every(point => point.every(Number.isFinite)), `${id}: ${edge.id}`);
        }
        for (const group of view.groups || []) for (const nodeId of group.nodes || [])
          assert.ok(view.nodes[nodeId], `${id}: group ${nodeId}`);
      }
    }
  }
});
