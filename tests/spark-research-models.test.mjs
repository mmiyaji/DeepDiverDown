import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { loadAnalyze } from '../tools/load.mjs';
import { implementation3D } from '../js/implementation-3d.js';
import { buildDiagramLayout } from '../js/diagram-layout.js';

const ids = ['spark-catalyst-planning', 'spark-aqe-join-skew', 'spark-datasource-v2-iceberg', 'spark-ui-performance-diagnosis', 'spark-gluten-velox', 'spark-connect-internals', 'spark-memory-spill-write', 'spark-rapids-gpu'];
const load = id => yaml.load(readFileSync(new URL(`../models/${id}/model.yaml`, import.meta.url), 'utf8'));
const edge = (model, id) => model.links.find(link => link.id === id);

test('Spark の詳細モデルは資料と実装例を持ち、2D と 3D へ投影できる', () => {
  const registry = JSON.parse(readFileSync(new URL('../models/registry.json', import.meta.url), 'utf8'));
  const { Views } = loadAnalyze();
  for (const id of ids) {
    const model = load(id);
    assert.ok(registry.some(entry => entry.id === id), id);
    assert.ok(model.reference.sources.length >= 2, id);
    if (model.parent) assert.equal(load(model.parent.model).nodes[model.parent.node].drill, id, `${id}: parent`);
    for (const link of model.links) assert.ok(model.nodes[link.from] && model.nodes[link.to], `${id}: ${link.id}`);
    for (const step of model.scenarios.flatMap(s => s.steps)) for (const link of step.links) assert.ok(edge(model, link), `${id}: ${link}`);
    for (const impl of model.implementations) {
      const base = Views.project(model, model, `impl:${impl.id}`);
      for (const flat of [true, false]) {
        const view = implementation3D(base, flat ? impl.layout2d : impl.layout3d, { flat });
        const layout = buildDiagramLayout(view, { flat, width: 900, height: 600 });
        assert.deepEqual(Object.keys(view.nodes).sort(), Object.keys(base.nodes).sort(), id);
        assert.equal(view.links.length, base.links.length, id);
        for (const [nodeId, node] of Object.entries(view.nodes)) assert.ok(layout.point(node.x, node.y, node.tier).every(Number.isFinite), `${id}: ${nodeId}`);
        for (const link of view.links) assert.ok(layout.routes.get(link.id)?.every(point => point.every(Number.isFinite)), `${id}: ${link.id}`);
      }
    }
  }
});

test('実測統計、Iceberg の task commit、Connect の通信と GPU fallback を区別する', () => {
  const aqe = load('spark-aqe-join-skew');
  assert.deepEqual([edge(aqe, 'measure').from, edge(aqe, 'adapt').to], ['shuffle', 'aqe']);
  const ds = load('spark-datasource-v2-iceberg');
  assert.deepEqual([edge(ds, 'messages').from, edge(ds, 'messages').to, edge(ds, 'commit').from], ['writer', 'commit', 'commit']);
  const connect = load('spark-connect-internals');
  assert.deepEqual([edge(connect, 'rpc').from, edge(connect, 'forward').to], ['plan', 'server']);
  const rapids = load('spark-rapids-gpu');
  assert.deepEqual([edge(rapids, 'fallback').from, edge(rapids, 'fallback').to], ['plugin', 'cpu']);
});
