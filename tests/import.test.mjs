// 自動配置・IaC 取り込みのテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadAnalyze, ROOT } from '../tools/load.mjs';
import { importState } from '../tools/import-tfstate.mjs';
import { importManifests } from '../tools/import-k8s.mjs';

const A = loadAnalyze();
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('layout：座標のない部品をリンクの向きに沿って並べ、フロアの大きさを決める', () => {
  const m = A.layout({
    tiers: [{ id: 'app', label: 'app' }],
    nodes: { a: { tier: 'app' }, b: { tier: 'app' }, c: { tier: 'app' }, d: { tier: 'app' } },
    links: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'a', to: 'd' }, { from: 'c', to: 'a' }], // c→a は循環
  });
  assert.ok(m.nodes.a.x < m.nodes.b.x && m.nodes.b.x < m.nodes.c.x, '流れに沿って右へ');
  assert.equal(m.nodes.b.x, m.nodes.d.x, '同じ深さは同じ列');
  assert.notEqual(m.nodes.b.y, m.nodes.d.y, '同じ列では行をずらす');
  assert.ok(m.tiers[0].size[0] >= 3);
});

test('layout：座標のある部品は動かさない', () => {
  const m = A.layout({ tiers: [{ id: 't' }], nodes: { a: { tier: 't', x: 5, y: 2 }, b: { tier: 't' } }, links: [{ from: 'a', to: 'b' }] });
  assert.equal(m.nodes.a.x, 5);
  assert.ok(m.nodes.b.x > 5);
});

test('import-tfstate：台数・AZ・在庫を取り出す', () => {
  const a = importState(JSON.parse(read('samples/aws-web/terraform-show.json')));
  assert.equal(a.nodes['aws_ecs_service.api'].replicas, 2);
  assert.equal(a.nodes['aws_rds_cluster.main'].replicas, 2);
  assert.equal(a.nodes['aws_nat_gateway.a'].az.join(), 'a');
  assert.equal(a.nodes['aws_lb.api'].az.join(), 'a,c');
  assert.ok(a.inventory.some(x => x.ref === 'aws_iam_role.ecs_task'));
  assert.ok(!a.nodes['aws_subnet.public_a'], 'サブネットは部品にしない');
});

test('import-k8s：*_ADDR から接続を作り、存在しない宛先を未解決にする', () => {
  const a = importManifests([read('samples/online-boutique/kubernetes-manifests.yaml')]);
  assert.equal(Object.keys(a.nodes).length, 12);
  assert.equal(a.nodes['redis-cart'].tier, 'data');
  assert.equal(a.nodes.frontend.replicas, 1);
  assert.deepEqual(a.nodes.frontend.exposed, ['frontend-external']);
  assert.ok(a.links.some(([f, t]) => f === 'checkoutservice' && t === 'paymentservice'));
  assert.equal(a.unresolved[0].from, 'frontend');
});

test('diff：IaC の参照（根拠の ref）で設計と実環境を対応付ける', () => {
  const m = { tiers: [{ id: 'app' }], nodes: { api: { label: 'API', tier: 'app', replicas: 4, evidence: [{ type: 'iac', ref: 'aws_ecs_service.api' }] } }, links: [] };
  const d = A.diff(m, { nodes: { 'aws_ecs_service.api': { replicas: 2 }, 'aws_instance.bastion': { label: 'bastion', tier: 'app' } } });
  assert.equal(d.match.api, 'aws_ecs_service.api');
  assert.equal(d.nodes.api, 'replicas');
  assert.ok(d.extraNodes['aws_instance.bastion'].x != null, '設計にない部品にも座標を付ける');
});
