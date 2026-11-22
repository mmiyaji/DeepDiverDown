import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyInterview, isUndecided } from '../js/design-interview.js';

const node = { id: 'node-app', label: '予約サービス', kind: 'service', tier: 'app', description: '予約を受け付ける' };
const proposal = {
  question: '同時予約を許可しますか？ もう一つ質問ですか？',
  nodes: [node],
  links: [{ id: 'link-broken', from: node.id, to: 'ghost', sync: true, label: '' }],
  requirements: [{ id: 'req-book', title: '予約できる', kind: 'usecase', text: '', nodes: [node.id, 'ghost'], links: ['link-broken'] }],
};
const draft = () => ({
  model: { tiers: [{ id: 'app' }], nodes: {}, links: [], requirements: [], unknowns: [] },
  interview: { history: [], inProgress: true },
});

test('設計対話：一問だけを残し、参照切れのない設計案を作る', () => {
  const d = draft();
  assert.equal(applyInterview(d, proposal), 2);
  assert.equal(d.interview.question, '同時予約を許可しますか？');
  assert.equal(d.interview.inProgress, false);
  assert.deepEqual(d.model.links, []);
  assert.deepEqual(d.model.requirements[0].nodes, [node.id]);
  assert.deepEqual(d.model.requirements[0].links, []);
  assert.equal(d.model.nodes[node.id].status, 'claim');
});

test('設計対話：手で編集・削除した項目を上書きせず、未定の質問を繰り返さない', () => {
  const d = draft();
  applyInterview(d, proposal);
  d.model.nodes[node.id].label = '社員向け予約 API';
  d.model.requirements.length = 0;
  d.interview.history.push({ question: d.interview.question, answer: '未定' });
  assert.equal(applyInterview(d, proposal), 0);
  assert.equal(d.model.nodes[node.id].label, '社員向け予約 API');
  assert.equal(d.model.requirements.length, 0);
  assert.equal(d.interview.question, '');
  assert.equal(isUndecided(' 未定。 '), true);
  assert.equal(isUndecided('方式は未定ですが必要です'), false);
});

test('設計書取り込み：原文と一致する引用がある項目を根拠付きで保存する', () => {
  const d = draft();
  const document = '予約サービスを1台で動かす。';
  applyInterview(d, {
    nodes: [
      { ...node, replicas: 1, quote: document },
      { ...node, id: 'node-extra', label: '推測した部品', quote: '原文にはない' },
    ],
  }, { document });
  assert.deepEqual(Object.keys(d.model.nodes), [node.id]);
  assert.equal(d.model.nodes[node.id].replicas, 1);
  assert.equal(d.model.nodes[node.id].evidence[0].quote, document);
});

test('指摘対応：承認した差分だけで既存の構成を修正し、既存の属性を保つ', () => {
  const d = draft();
  d.model.nodes.order = { label: '注文受付', kind: 'service', tier: 'app', svc: 'aws:ecs', replicas: 1 };
  const proposal = { nodes: [{ ...d.model.nodes.order, id: 'order', replicas: 2 }] };
  assert.equal(applyInterview(d, proposal), 0);
  assert.equal(d.model.nodes.order.replicas, 1);
  assert.equal(applyInterview(d, proposal, { approved: true }), 1);
  assert.equal(d.model.nodes.order.replicas, 2);
  assert.equal(d.model.nodes.order.svc, 'aws:ecs');
});
