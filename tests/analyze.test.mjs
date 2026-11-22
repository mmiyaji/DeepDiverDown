// 解析処理の単体テスト：node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAnalyze, loadModels, loadDocs } from '../tools/load.mjs';

const A = loadAnalyze();
const M = Object.fromEntries(loadModels().map(x => [x.id, x]));
const ec = M['ec-shop'], aws = M['aws-web'], ci = M['cicd'];
const rules = (m, o) => A.lint(m, o).map(i => i.rule);

/* 最小の健全なモデル（点検がすべて合格する前提） */
const clean = () => ({
  name: 'clean', sources: [], inventory: [{ type: 'iac', ref: 'r.a' }, { type: 'iac', ref: 'r.b' }],
  tiers: [{ id: 'app', label: 'app' }],
  nodes: {
    a: { label: 'A', kind: 'service', tier: 'app', x: 0, y: 0, replicas: 2, evidence: [{ type: 'iac', ref: 'r.a' }] },
    b: { label: 'B', kind: 'db', tier: 'app', x: 3, y: 0, replicas: 2, evidence: [{ type: 'iac', ref: 'r.b' }] },
  },
  links: [{ id: 'ab', from: 'a', to: 'b', sync: true, timeoutMs: 1000, evidence: [{ type: 'code', ref: 'src/a.ts', at: 'src/a.ts:1' }] }],
  requirements: [{ id: 'R1', kind: 'rule', title: 'r', text: 't', links: ['ab'], evidence: [{ type: 'code', ref: 'src/a.ts' }] }],
});

test('parseSections：番号付き見出しを節にし、子を持つ親は除く', () => {
  const s = A.parseSections('## 1. 概要\n## 2. 構成\n### 2.1 A\n### 2.2 B\n## 参考');
  assert.equal(s.map(x => x.id).join(','), '§1,§2.1,§2.2'); // vm 由来の配列なので文字列で比較
});

test('lint：EC サンプルの仕込んだ問題を検出する', () => {
  const r = rules(ec.model);
  for (const id of ['SPOF', 'NO_TIMEOUT', 'CYCLE', 'SHARED_DB', 'RETRY_STORM']) assert.ok(r.includes(id), id);
});

test('lint：disabled で個別に無効化できる', () => {
  assert.ok(!rules(ec.model, { disabled: ['SPOF'] }).includes('SPOF'));
});

test('lint：パイプライン専用ルールはパイプラインにだけ当たる', () => {
  assert.ok(rules(ci.model).includes('NO_APPROVAL'));
  assert.ok(!rules(ec.model).includes('NO_APPROVAL'));
  assert.ok(!rules(ci.model).includes('SPOF'));
});

test('impact：決済停止で注文確定が止まり、上流に伝播する', () => {
  const r = A.impact(ec.model, ['pay']);
  assert.ok(r.impacted.includes('order') && r.impacted.includes('web'));
  assert.deepEqual(r.brokenScenarios.map(s => s.id), ['checkout']);
});

test('impact：パイプラインは下流に伝播し、join:any は別経路で実行される', () => {
  const r = A.impact(ci.model, ['unit']);
  assert.ok(r.impacted.includes('ecr') && r.impacted.includes('appr'));
  assert.ok(!r.impacted.includes('dprod'));
});

test('classify：IaC の says が食い違うと「ずれ」、doc のみは「主張」、根拠なしは「不明」', () => {
  const c = A.classify(aws.model, null);
  assert.equal(c.nodes.ecs.status, 'drift');
  assert.equal(c.nodes.user.status, 'claim');
  assert.equal(c.nodes.ext.status, 'unknown');
  assert.equal(c.nodes.aurora.status, 'fact');
});

test('classify：実環境スナップショットとの台数差・欠落は「ずれ」', () => {
  const c = A.classify(ec.model, ec.actual);
  assert.equal(c.nodes.order.status, 'drift');
  assert.equal(c.nodes.redis.status, 'drift');
  assert.equal(c.nodes.web.status, 'fact');
});

test('coverage：inventory の未対応と存在しない節への参照を数える', () => {
  const cov = A.coverage(aws.model, null, loadDocs(A, aws.model));
  assert.ok(cov.missing.some(x => x.ref === 'aws_iam_role.ecs_task'));
  const ecCov = A.coverage(ec.model, ec.actual, loadDocs(A, ec.model));
  assert.ok(ecCov.broken.some(b => b.ref.endsWith('#§7')));
});

test('gates：サンプルは不合格、健全なモデルは合格', () => {
  assert.equal(A.gates(ec.model, ec.actual, loadDocs(A, ec.model)).pass, false);
  const g = A.gates(clean(), null, {});
  assert.equal(g.pass, true, JSON.stringify(g.results.filter(r => !r.pass)));
});

test('gates：しきい値の上書き', () => {
  const g = A.gates(aws.model, null, loadDocs(A, aws.model), { gates: { maxDrift: 5 } });
  assert.equal(g.results.find(r => r.id === 'DRIFT').pass, true);
});

test('index：逆引き索引に設計書の節と IaC リソースが入る', () => {
  const i = A.index(aws.model);
  assert.ok(i.byRef['aws_ecs_service.api'].includes('ecs'));
  assert.ok(i.byRef['docs/sample-aws-web.md'].length > 3);
});

test('compareModels：追加 / 削除 / 変更を検出する', () => {
  const base = clean(), cur = clean();
  delete cur.nodes.b; cur.links = [];
  cur.nodes.a.replicas = 3;
  cur.nodes.c = { label: 'C', kind: 'service', tier: 'app', x: 5, y: 0 };
  const r = A.compareModels(base, cur);
  assert.equal(r.nodes.b, 'removed');
  assert.equal(r.nodes.a, 'changed');
  assert.equal(r.nodes.c, 'added');
  assert.equal(r.links.ab, 'removed');
});

test('CROSS_CLOUD_SYNC：クラウド間の同期リンクを指摘する', () => {
  const nodes = {
    aks: { label: 'AKS', svc: 'azure:aks' },
    adb: { label: 'ADB', svc: 'oci:adb' },
    sql: { label: 'SQL', svc: 'azure:sqldb' },
    pod: { label: 'Pod', svc: 'k8s:deployment' },
  };
  const links = [
    { id: 'cross', from: 'aks', to: 'adb', sync: true },
    { id: 'async', from: 'aks', to: 'adb', sync: false },
    { id: 'same', from: 'aks', to: 'sql', sync: true },
    { id: 'workload', from: 'aks', to: 'pod', sync: true },
  ];
  const issues = A.lint({ nodes, links }).filter(i => i.rule === 'CROSS_CLOUD_SYNC');
  assert.equal(issues.length, 1);
  assert.equal(issues[0].links[0], 'cross');
});
