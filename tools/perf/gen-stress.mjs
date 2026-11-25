// 性能の再現用：CAN 正規化 DWH 相当の合成モデルを作る。使い方：node tools/perf/gen-stress.mjs <出力.yaml> <部品数>
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

const N = Number(process.argv[3] || 130);
const tiers = [
  { id: 'ops', label: '運用', z: 0, origin: [-2, 6], size: [4, 4] },
  { id: 'vdp', label: 'VDP（車外活用変換）', z: 0, origin: [0, 0], size: [12, 8] },
  { id: 'vap', label: 'VAP：EKS クラスタ', z: 0, origin: [14, 0], size: [26, 8] },
  { id: 'managed', label: 'VAP：AWS マネージドサービス', z: 1, origin: [8, 0], size: [30, 9] },
  { id: 'saas', label: 'Spot Ocean（SaaS）', z: 0, origin: [14, -10], size: [10, 6] },
  { id: 'wh', label: 'Snowflake', z: 1, origin: [40, 0], size: [10, 8] },
];
const kinds = ['service', 'worker', 'db', 'host', 'queue', 'scheduler', 'cache'];
const svcs = ['s3', 'ec2', 'eks', 'lambda', 'emr', 'sqs', 'sns', 'cloudwatch', 'ecr', 'kms'];
const nodes = {};
const perTier = Math.ceil(N / tiers.length);
let k = 0;
for (const t of tiers) {
  const cols = Math.ceil(Math.sqrt(perTier * t.size[0] / t.size[1]));
  for (let i = 0; i < perTier && k < N; i++, k++) {
    const id = `n${String(k).padStart(3, '0')}`;
    const x = 1 + (i % cols) * Math.max(1.2, (t.size[0] - 2) / cols);
    const y = 1 + Math.floor(i / cols) * Math.max(1.2, (t.size[1] - 2) / Math.ceil(perTier / cols));
    nodes[id] = {
      label: `部品 ${k}（${['Lambda', 'Glue', 'Kafka', 'S3', 'EMR', 'Pod', 'SQS', 'Alert Manager'][k % 8]}・サンプル名）`,
      kind: kinds[k % kinds.length], tier: t.id, x: +x.toFixed(2), y: +y.toFixed(2),
      description: '性能計測用の部品。',
      ...(k % 3 === 0 ? { svc: svcs[k % svcs.length] } : {}),
      ...(k % 11 === 0 ? { slots: 4 } : {}),
      ...(k % 7 === 0 ? { management: { type: ['aws', 'shared', 'customer'][k % 3], scope: '計測用の管理区分。' } } : {}),
    };
  }
}
const ids = Object.keys(nodes);
const links = [];
let lk = 0;
for (let i = 0; i < ids.length; i++) for (const step of [1, 7]) {
  const j = (i + step) % ids.length;
  if (i !== j && links.length < N * 1.4) links.push({ id: `l${lk++}`, from: ids[i], to: ids[j], label: `接続 ${lk}`, ...(lk % 4 === 0 ? { sync: true } : {}) });
}
const groups = [
  { kind: 'cloud', label: 'VAP AWS アカウント', provider: 'aws', tier: ['vdp', 'vap', 'managed', 'ops'], nodes: ids.filter((_, i) => i % 5 !== 4) },
  { kind: 'cluster', label: 'EKS クラスタ', provider: 'k8s', tier: ['vap'], nodes: ids.filter(i => nodes[i].tier === 'vap') },
  { kind: 'namespace', label: '名前空間', provider: 'k8s', tier: ['vap'], nodes: ids.filter(i => nodes[i].tier === 'vap').slice(0, 15) },
  { kind: 'cloud', label: 'Snowflake', provider: 'snowflake', tier: ['wh'], nodes: ids.filter(i => nodes[i].tier === 'wh') },
];
const model = { name: `性能計測用（${N} 部品）`, description: '合成データ', tiers, nodes, links, groups };
fs.writeFileSync(process.argv[2], yaml.dump(model, { lineWidth: 200 }), 'utf8');
console.log(Object.keys(nodes).length, 'nodes', links.length, 'links');
