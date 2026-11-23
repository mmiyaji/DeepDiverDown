#!/usr/bin/env node
// Kubernetes マニフェストから実環境スナップショット（actual.yaml）を作る
//   node tools/import-k8s.mjs manifests.yaml [...] --out models/<id>/actual.yaml
//   kubectl get deploy,sts,svc -A -o yaml > live.yaml でも可（List 形式に対応）
// - Deployment / StatefulSet / DaemonSet → 部品（名前空間と種類を区別）
// - 環境変数の値が「<Service の DNS 名>:<ポート>」→ その Service が指す部品への接続
// - 参照先の Service / 部品が存在しないものは unresolved に記録
import fs from 'node:fs';
import yaml from 'js-yaml';

const DATA = /redis|postgres|mysql|mongo|memcached|elasticsearch|kafka|rabbitmq|cassandra/i;
const SERVICE_ADDRESS = /^([a-z0-9-]+)(?:\.([a-z0-9-]+)(?:\.svc(?:\.[a-z0-9-]+)*)?)?\.?:\d+$/;
const namespace = resource => resource.metadata.namespace || 'default';
const resourceKey = resource => `${namespace(resource)}/${resource.metadata.name}`;
const resourceLabel = resource => namespace(resource) === 'default' ? resource.metadata.name : resourceKey(resource);

export function importManifests(texts) {
  const docs = texts.flatMap(t => yaml.loadAll(t)).filter(Boolean).flatMap(d => d.kind === 'List' ? d.items : [d]);
  const relevant = docs.filter(d => ['Deployment', 'StatefulSet', 'DaemonSet', 'Service'].includes(d.kind));
  const resources = [...new Map(relevant.map(d => [`${d.kind}/${resourceKey(d)}`, d])).values()];
  const workloads = resources.filter(d => d.kind !== 'Service');
  const services = resources.filter(d => d.kind === 'Service');
  const match = (sel, labels) => sel && Object.keys(sel).length > 0 && Object.entries(sel).every(([k, v]) => labels?.[k] === v);
  const workloadsByName = new Map();
  for (const w of workloads) {
    const key = resourceKey(w);
    workloadsByName.set(key, (workloadsByName.get(key) || 0) + 1);
  }
  // default の既存 ID を、同名の異種ワークロードがない限り維持する。
  const workloadId = w => namespace(w) === 'default' && workloadsByName.get(resourceKey(w)) === 1
    ? w.metadata.name : `${namespace(w)}/${w.kind.toLowerCase()}/${w.metadata.name}`;
  const svcTargets = new Map();
  const exposedByWorkload = new Map();
  const loadBalancers = [];
  const nodes = new Map(), links = [], unresolved = [];
  for (const s of services) {
    const ns = namespace(s), name = s.metadata.name;
    const targets = workloads.filter(w => namespace(w) === ns && match(s.spec?.selector, w.spec?.template?.metadata?.labels)).map(workloadId);
    svcTargets.set(resourceKey(s), targets);
    if (s.spec?.type !== 'LoadBalancer') continue;
    const id = ns === 'default' ? `service/${name}` : `${ns}/service/${name}`;
    const label = resourceLabel(s);
    loadBalancers.push({ id, label, targets });
    for (const target of targets) {
      if (!exposedByWorkload.has(target)) exposedByWorkload.set(target, []);
      exposedByWorkload.get(target).push(label);
    }
  }
  for (const w of workloads) {
    const id = workloadId(w), pod = w.spec?.template?.spec || {};
    const images = [...(pod.containers || [])].map(c => c.image);
    const exposed = exposedByWorkload.get(id);
    const data = DATA.test(images.join(' ') + w.metadata.name);
    nodes.set(id, {
      label: resourceLabel(w), svc: `k8s:${w.kind.toLowerCase()}`, kind: data ? 'db' : 'service', tier: data ? 'data' : 'app',
      replicas: w.kind === 'DaemonSet' ? 99 : (w.spec?.replicas ?? 1), image: images[0],
      ...(exposed ? { exposed } : {}),
    });
    const connections = new Set();
    for (const c of [...(pod.containers || []), ...(pod.initContainers || [])]) for (const e of c.env || []) {
      const m = String(e.value ?? '').match(SERVICE_ADDRESS);
      if (!m) continue;
      const [, name, ns = namespace(w)] = m;
      const targets = svcTargets.get(`${ns}/${name}`);
      const label = ns === 'default' ? name : `${ns}/${name}`;
      if (!targets?.length) unresolved.push({ from: id, env: e.name, value: e.value, reason: targets
        ? `Service「${label}」の宛先ワークロードがない` : `Service「${label}」がない` });
      else for (const target of targets) if (target !== id) connections.add(target);
    }
    for (const target of connections) links.push([id, target]);
  }
  for (const { id, label, targets } of loadBalancers) {
    nodes.set(id, { label, svc: 'k8s:service', kind: 'lb', tier: 'app' });
    for (const target of targets) links.push([id, target]);
  }
  return { capturedAt: new Date().toISOString().slice(0, 16).replace('T', ' '), source: 'kubernetes', nodes: Object.fromEntries(nodes), links, ...(unresolved.length ? { unresolved } : {}) };
}

if (process.argv[1]?.endsWith('import-k8s.mjs')) {
  const args = process.argv.slice(2), oi = args.indexOf('--out');
  const files = args.filter((x, i) => x !== '--out' && i !== oi + 1 || oi < 0 && x !== '--out');
  if (!files.length) { console.error('usage: node tools/import-k8s.mjs <manifests.yaml...> [--out actual.yaml]'); process.exit(2); }
  const a = importManifests(files.map(f => fs.readFileSync(f, 'utf8')));
  const text = `# tools/import-k8s.mjs で ${files.join(', ')} から生成\n` + yaml.dump(a, { lineWidth: 140, flowLevel: 3 });
  if (oi >= 0) { fs.writeFileSync(args[oi + 1], text); console.log(`${args[oi + 1]}: ${Object.keys(a.nodes).length} 部品 / 接続 ${a.links.length} / 未解決 ${a.unresolved?.length || 0}`); }
  else process.stdout.write(text);
}
