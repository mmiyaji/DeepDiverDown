#!/usr/bin/env node
// Terraform の状態から実環境スナップショット（actual.yaml）を作る
//   terraform show -json > state.json
//   node tools/import-tfstate.mjs state.json --out models/<id>/actual.yaml
// 入力は `terraform show -json` の出力、または terraform.tfstate（v4）のどちらでもよい。
// 部品のキーはリソースアドレス（aws_ecs_service.api）。モデル側は根拠 { type: iac, ref: <アドレス> } で対応付く。
import fs from 'node:fs';
import yaml from 'js-yaml';

/* リソース種別 → 部品。replicas は台数の求め方 */
const TYPES = {
  aws_route53_zone: { svc: 'route53', tier: 'edge', replicas: () => 99 },
  aws_cloudfront_distribution: { svc: 'cloudfront', tier: 'edge', replicas: () => 99 },
  aws_wafv2_web_acl: { svc: 'waf', tier: 'edge', replicas: () => 99 },
  aws_lb: { svc: 'alb', tier: 'app', az: (v, s) => azOfSubnets(v.subnets, s) },
  aws_nat_gateway: { svc: 'nat', tier: 'app', replicas: () => 1, az: (v, s) => azOfSubnets([v.subnet_id], s) },
  aws_ecs_service: { svc: 'ecs', tier: 'app', replicas: v => v.desired_count, az: (v, s) => azOfSubnets(v.network_configuration?.[0]?.subnets, s) },
  aws_lambda_function: { svc: 'lambda', tier: 'app', replicas: () => 99 },
  aws_instance: { svc: 'ec2', tier: 'app', replicas: () => 1, az: v => azSuffix([v.availability_zone]) },
  aws_rds_cluster: { svc: 'aurora', tier: 'data', replicas: (v, all) => all.filter(r => r.type === 'aws_rds_cluster_instance' && r.values.cluster_identifier === v.cluster_identifier).length || null, az: v => azSuffix(v.availability_zones) },
  aws_db_instance: { svc: 'rds', tier: 'data', replicas: v => (v.multi_az ? 2 : 1) },
  aws_elasticache_replication_group: { svc: 'elasticache', tier: 'data', replicas: v => v.num_cache_clusters, az: v => azSuffix(v.preferred_cache_cluster_azs) },
  aws_dynamodb_table: { svc: 'dynamodb', tier: 'data', replicas: () => 99 },
  aws_s3_bucket: { svc: 's3', tier: 'data', replicas: () => 99 },
  aws_sqs_queue: { svc: 'sqs', tier: 'data', replicas: () => 99 },
  aws_sns_topic: { svc: 'sns', tier: 'data', replicas: () => 99 },
  aws_secretsmanager_secret: { svc: 'secrets', tier: 'app', replicas: () => 99 },
};
/* 部品にはしないが、網羅の分母（在庫）に入れる種別 */
const INVENTORY_ONLY = ['aws_iam_role', 'aws_cloudwatch_log_group', 'aws_kms_key', 'aws_cloudwatch_metric_alarm'];

const azSuffix = list => { const s = [...new Set((list || []).filter(Boolean).map(z => z.slice(-1)))].sort(); return s.length ? s : undefined; };
function azOfSubnets(ids, subnets) { return azSuffix((ids || []).map(id => subnets[id])); }

/* show -json / tfstate v4 → [{ address, type, name, values }] */
function resources(state) {
  if (state.values?.root_module) {
    const out = [], walk = mod => { (mod.resources || []).forEach(r => r.mode !== 'data' && out.push(r)); (mod.child_modules || []).forEach(walk); };
    walk(state.values.root_module); return out;
  }
  return (state.resources || []).filter(r => r.mode !== 'data').flatMap(r => r.instances.map((i, n) => ({
    address: `${r.module ? r.module + '.' : ''}${r.type}.${r.name}${r.instances.length > 1 ? `[${i.index_key ?? n}]` : ''}`, type: r.type, name: r.name, values: i.attributes,
  })));
}

export function importState(state, { source = 'terraform' } = {}) {
  const res = resources(state);
  const subnets = Object.fromEntries(res.filter(r => r.type === 'aws_subnet').map(r => [r.values.id, r.values.availability_zone]));
  const nodes = {}, inventory = [];
  for (const r of res) {
    const t = TYPES[r.type];
    if (t) {
      const replicas = t.replicas ? t.replicas(r.values, res) : undefined;
      const n = { label: r.values.name || r.values.tags?.Name || r.name, svc: t.svc, tier: t.tier };
      if (replicas != null) n.replicas = replicas;
      const az = t.az?.(r.values, subnets);
      if (az) n.az = az;
      nodes[r.address] = n;
      inventory.push({ type: 'iac', ref: r.address });
    } else if (INVENTORY_ONLY.includes(r.type)) inventory.push({ type: 'iac', ref: r.address });
  }
  return { capturedAt: new Date().toISOString().slice(0, 16).replace('T', ' '), source, nodes, inventory };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:')}` || process.argv[1]?.endsWith('import-tfstate.mjs')) {
  const [file, ...rest] = process.argv.slice(2);
  if (!file) { console.error('usage: node tools/import-tfstate.mjs <state.json> [--out actual.yaml]'); process.exit(2); }
  const out = rest[rest.indexOf('--out') + 1];
  const a = importState(JSON.parse(fs.readFileSync(file, 'utf8')), { source: `terraform:${file}` });
  const text = `# tools/import-tfstate.mjs で ${file} から生成\n` + yaml.dump(a, { lineWidth: 140, flowLevel: 3 });
  if (rest.includes('--out')) { fs.writeFileSync(out, text); console.log(`${out}: ${Object.keys(a.nodes).length} 部品 / 在庫 ${a.inventory.length}`); }
  else process.stdout.write(text);
}
