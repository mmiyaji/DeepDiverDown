#!/usr/bin/env node
// 3D の階層（制御・処理・保存）の割り当てを一覧にして、誤りがないか目視で点検する。
// 使い方: node tools/audit-layer-roles.mjs [--role ctrl|proc|data|actor] [model-id ...]
import { loadModels } from './load.mjs';
import { roleOf } from '../js/lab-layout.js';

const args = process.argv.slice(2);
const ri = args.indexOf('--role');
const want = ri >= 0 ? args[ri + 1] : null;
const only = args.filter((a, i) => !a.startsWith('--') && i !== ri + 1);
const seen = new Map();
for (const { id, model } of loadModels(only.length ? only : null)) {
  for (const impl of model.implementations || []) {
    if (!impl.layout3d?.nodes) continue;
    for (const [nid, n] of Object.entries(impl.nodes || {})) {
      if (!impl.layout3d.nodes[nid]) continue;
      const role = roleOf({ kind: n.kind, svc: n.svc, label: n.label });
      if (want && role !== want) continue;
      const key = `${role}\t${n.kind}\t${n.svc || '-'}\t${n.label}`;
      const e = seen.get(key) || { n: 0, ex: id }; e.n++; seen.set(key, e);
    }
  }
}
for (const [k, v] of [...seen].sort((a, b) => a[0].localeCompare(b[0]))) console.log(`${k}\t×${v.n}\t${v.ex}`);
