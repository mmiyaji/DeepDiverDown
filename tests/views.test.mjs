// ビュー変換のテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAnalyze, loadModels } from '../tools/load.mjs';

const A = loadAnalyze(), V = A.Views;
const M = Object.fromEntries(loadModels().map(x => [x.id, x.model]));
const base = m => ({ tiers: m.tiers, groups: m.groups || [], nodes: m.nodes, links: m.links });
const has = (v, f, t) => v.links.some(l => l.from === f && l.to === t);

test('available：AZ やサブネットの情報があるモデルだけネットワークビューを持つ', () => {
  assert.ok(V.available(M['aws-web']).includes('network'));
  assert.ok(!V.available(M['ec-shop']).includes('network'));
});

test('実装例のアカウント境界は対象フロアに表示し、重複するサービス枠をまとめる', () => {
  const m = M['etl-elt'];
  const v = V.project(base(m), m, 'impl:aws-redshift');
  const account = v.groups.find(g => g.label === 'AWS 分析環境');
  assert.ok(account.tier.includes('input'));
  assert.ok(account.tier.includes('compare'));
  assert.ok(account.nodes.includes('aws-redshift-source'));
  assert.ok(!v.groups.some(g => g.label === 'AWS サービス' && g.nodes?.includes('aws-redshift-source')));
  const clean = M['data-clean-room'];
  const other = V.project(base(clean), clean, 'impl:aws-cleanrooms');
  assert.ok(other.groups.some(g => g.label === '共同分析の AWS 範囲' && g.tier.includes('flow')));
  assert.ok(other.groups.some(g => g.nodes?.includes('aws-cleanrooms-media')));
});

test('logical（自動）：基盤部品を隠し、通り抜けた接続を機能どうしの接続にする', () => {
  const v = V.project(base(M['ec-shop']), M['ec-shop'], 'logical');
  assert.ok(!v.nodes.cdn && !v.nodes.alb, 'CDN・ALB は隠す');
  assert.ok(has(v, 'user', 'web'), '利用者 → CDN → ALB → Web は 利用者 → Web');
  assert.ok(v.linkFrom['L:user>web'].includes('u2c') && v.linkFrom['L:user>web'].includes('a2w'));
  assert.ok(Object.values(v.nodes).every(n => n.x != null), '自動配置される');
});

test('logical（指定）：components で複数の物理部品を 1 つの機能にまとめる', () => {
  const v = V.project(base(M['online-boutique']), M['online-boutique'], 'logical');
  assert.deepEqual([...v.from.order].sort(), ['checkoutservice', 'paymentservice']);
  assert.ok(has(v, 'order', 'cart'), 'checkout → cart は 注文 → カート');
  assert.ok(!has(v, 'cart', 'cart'), 'カート内部の接続（cart → Redis）は消える');
});

test('network：複数 AZ の部品を AZ ごとに展開し、片側 AZ にしかない相手へは AZ をまたぐ', () => {
  const v = V.project(base(M['aws-web']), M['aws-web'], 'network');
  assert.ok(v.nodes['ecs@a'] && v.nodes['ecs@c'] && !v.nodes.ecs);
  assert.equal(v.nodes['ecs@a'].replicas, 2, '4 台を 2 AZ に');
  const toNat = v.links.filter(l => l.to === 'nat');
  assert.ok(toNat.some(l => l.from === 'ecs@c' && l.crossAz), 'AZ-c の ECS は AZ-a の NAT を使う');
  assert.ok(v.links.some(l => l.from === 'ecs@a' && l.to === 'aurora@a' && !l.crossAz), '同じ AZ 同士はその中で接続');
});

test('ビューごとにクラウド・クラスタ・ネットワークの枠を出し分ける', () => {
  const m = M['aws-web'];
  const visible = ['cloud', 'region', 'cluster', 'vpc', 'vnet', 'vcn', 'datacenter'];
  const networkOnly = ['az', 'subnet', 'namespace'];
  const groups = [...visible, ...networkOnly].map(kind => ({ kind, tier: m.tiers[0].id }));
  const model = { ...m, groups };
  assert.deepEqual(Array.from(V.project(base(model), model, 'cloud').groups, g => g.kind), visible);
  assert.equal(V.project(base(model), model, 'logical').groups.length, 0);
  assert.equal(V.project(base(model), model, 'network').groups.length, groups.length);
});

test('リファレンス：自動の論理構成は出さず、機能配置と実装例を並べる', () => {
  const m = M.debezium;
  assert.deepEqual([...V.available(m)], ['cloud', 'impl:aws']);
  assert.equal(V.info(m, 'cloud').label, '機能配置');
  assert.equal(V.info(m, 'impl:aws').label, '実装例：AWS');
});

test('実装例：機能をサービスに写し、同じサービスに収まる接続は消え、実装で加わる部品と接続が出る', () => {
  const m = M.debezium, v = V.project(base(m), m, 'impl:aws');
  assert.deepEqual([...v.from['aws-rds']].sort(), ['database', 'logical'], 'DB と論理レプリケーションを RDS が担う');
  assert.ok(!v.nodes.database && !v.nodes.topic, '機能の部品は実装の部品に置き換わる');
  assert.ok(has(v, 'aws-rds', 'aws-connect-eni') && has(v, 'aws-connect-eni', 'aws-connector'));
  assert.ok(!v.links.some(l => l.from === l.to), 'DB → 論理レプリケーションは RDS の中に収まる');
  for (const id of ['aws-snapshot-eni', 'aws-snapshot-task', 'aws-capture-eni', 'aws-capture-task']) {
    assert.ok(v.linkFrom[id]?.includes(id.includes('snapshot') ? 'snapshot' : 'capture'), 'ENI を経由する各区間にシナリオの接続を引き継ぐ');
  }
  assert.deepEqual([...v.from['aws-plugin']], [], 'S3 は実装で加わる部品');
  assert.ok(has(v, 'aws-plugin', 'aws-worker'));
});

test('点検：実装例が機能配置を覆い、資料を持つ', () => {
  const m = M.debezium;
  assert.equal(A.gates(m, null, {}).results.find(r => r.id === 'IMPL').pass, true);
  const broken = { ...m, implementations: [{ id: 'x', label: 'X', nodes: { a: { realizes: ['nope'] } } }] };
  const items = A.gates(broken, null, {}).results.find(r => r.id === 'IMPL').items;
  assert.ok(items.some(s => s.includes('公式資料')) && items.some(s => s.includes('nope')) && items.some(s => s.includes('担う部品がない')));
});

test('mergeNode：停止 > 影響、ずれ > 主張、強調は 1 つでもあれば', () => {
  const r = V.mergeNode([{ fill: 'impact', status: 'claim' }, { fill: 'down', status: 'drift', outline: true }, { dim: true }]);
  assert.equal(r.fill, 'down'); assert.equal(r.status, 'drift'); assert.equal(r.outline, true); assert.equal(r.dim, false);
});
