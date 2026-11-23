import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAnalyze, loadDocs, loadModels } from '../tools/load.mjs';
import { NODE_KINDS } from '../js/node-kinds.js';

const A = loadAnalyze();
const models = loadModels();

test('各リファレンスは機能配置と公式資料付きの実装例を持つ', () => {
  for (const { id, model } of models.filter(item => item.reference)) {
    assert.ok(model.implementations?.length, `${id} は実装例を持つ`);
    assert.ok(Object.values(model.nodes).every(node => !node.svc), `${id} の機能配置にサービスを直書きしない`);
    const gates = A.gates(model, null, loadDocs(A, model)).results;
    for (const gate of gates.filter(gate => ['IMPL', 'BROKEN_REF'].includes(gate.id))) {
      assert.ok(gate.pass, `${id} / ${gate.id}: ${gate.items.join('、')}`);
    }
    for (const example of model.implementations) {
      for (const node of Object.values(example.nodes)) {
        assert.ok(Object.hasOwn(NODE_KINDS, node.kind), `${id} / ${example.id}: 不明な種別 ${node.kind}`);
        if (node.svc) assert.ok(A.Catalog.lookup(node.svc), `${id} / ${example.id}: 不明なサービス ${node.svc}`);
      }
    }
  }
});

test('オブジェクト一覧から該当する種類が描かれた機能配置を開ける', () => {
  for (const [kind, { example }] of Object.entries(NODE_KINDS)) {
    if (!example) continue;
    const model = models.find(item => item.id === example)?.model;
    assert.ok(model && Object.values(model.nodes).some(node => node.kind === kind), `${kind} / ${example}`);
  }
});

test('実装例は自動の直結を置き換え、同じシナリオの経路を描ける', () => {
  const { model } = models.find(item => item.id === 'kubernetes');
  const view = A.Views.project(model, model, 'impl:kubeadm');
  const entryPath = view.links.filter(link => view.linkFrom[link.id].includes('apply'));
  assert.deepEqual(Array.from(entryPath, link => [link.from, link.to]), [
    ['kubeadm-kubectl', 'kubeadm-api-lb'],
    ['kubeadm-api-lb', 'kubeadm-apiserver'],
  ]);
});
