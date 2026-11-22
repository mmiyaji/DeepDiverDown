#!/usr/bin/env node
// Kubernetes マニフェストから実環境スナップショット（actual.yaml）を作る
//   node tools/import-k8s.mjs manifests.yaml [...] --out models/<id>/actual.yaml
//   kubectl get deploy,sts,svc -A -o yaml > live.yaml でも可（List 形式に対応）
// - Deployment / StatefulSet → 部品（キーは名前。replicas 未指定は 1）
// - 環境変数の値が「<Service 名>:<ポート>」→ その Service が指す部品への接続
// - 参照先の Service / 部品が存在しないものは unresolved に記録
import fs from 'node:fs';
import yaml from 'js-yaml';

const DATA = /redis|postgres|mysql|mongo|memcached|elasticsearch|kafka|rabbitmq|cassandra/i;

export function importManifests(texts) {
  const docs = texts.flatMap(t => yaml.loadAll(t)).filter(Boolean).flatMap(d => d.kind === 'List' ? d.items : [d]);
  const workloads = docs.filter(d => ['Deployment', 'StatefulSet', 'DaemonSet'].includes(d.kind));
  const services = docs.filter(d => d.kind === 'Service');
  const match = (sel, labels) => sel && Object.entries(sel).every(([k, v]) => labels?.[k] === v);
  // Service 名 → 部品名（セレクタでワークロードを引く）
  const svcTarget = {};
  for (const s of services) {
    const w = workloads.find(w => match(s.spec?.selector, w.spec?.template?.metadata?.labels));
    svcTarget[s.metadata.name] = w?.metadata.name || null;
  }
  const nodes = {}, links = [], unresolved = [];
  for (const w of workloads) {
    const name = w.metadata.name, pod = w.spec?.template?.spec || {};
    const images = [...(pod.containers || [])].map(c => c.image);
    const exposed = services.filter(s => svcTarget[s.metadata.name] === name && s.spec?.type === 'LoadBalancer').map(s => s.metadata.name);
    nodes[name] = {
      label: name, kind: DATA.test(images.join(' ') + name) ? 'db' : 'service', tier: DATA.test(images.join(' ') + name) ? 'data' : 'app',
      replicas: w.kind === 'DaemonSet' ? 99 : (w.spec?.replicas ?? 1), image: images[0],
      ...(exposed.length ? { exposed } : {}),
    };
    for (const c of [...(pod.containers || []), ...(pod.initContainers || [])]) for (const e of c.env || []) {
      const m = String(e.value ?? '').match(/^([a-z0-9-]+)(?:\.[a-z0-9.-]+)?:\d+$/);
      if (!m) continue;
      const target = svcTarget[m[1]];
      if (target === undefined) unresolved.push({ from: name, env: e.name, value: e.value, reason: `Service「${m[1]}」がない` });
      else if (target === null) unresolved.push({ from: name, env: e.name, value: e.value, reason: `Service「${m[1]}」の宛先ワークロードがない` });
      else if (target !== name && !links.some(([f, t]) => f === name && t === target)) links.push([name, target]);
    }
  }
  return { capturedAt: new Date().toISOString().slice(0, 16).replace('T', ' '), source: 'kubernetes', nodes, links, ...(unresolved.length ? { unresolved } : {}) };
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
