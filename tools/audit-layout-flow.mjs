#!/usr/bin/env node
// 3D・2D の配置で、接続線が別の部品の上を通る（飛び越し）、流れが右から左へ戻る、を座標から数える。
// 使い方: node tools/audit-layout-flow.mjs [--summary] [model-id ...]
import { loadModels } from './load.mjs';

const HIT = 0.6;      // 線と部品の中心の距離がこれ未満なら「上を通る」
const BACK = 3;       // --back のとき、左へこれ以上戻る接続も数える（向きは問い合わせの向きでもあるので参考値）
const args = process.argv.slice(2);
const summary = args.includes('--summary');
const withBack = args.includes("--back");
const only = args.filter(a => !a.startsWith('--'));

function positions(layout, nodes) {
  const tiers = Object.fromEntries((layout.tiers || []).map(t => [t.id, t]));
  const pos = {};
  for (const [id, p] of Object.entries(layout.nodes || {})) {
    const t = tiers[p.tier]; if (!t) continue;
    pos[id] = { x: (t.origin?.[0] || 0) + p.x, y: (t.origin?.[1] || 0) + p.y, z: t.z || 0 };
  }
  return pos;
}

function linksOf(model, impl) {
  const real = {};
  for (const [id, n] of Object.entries(impl.nodes || {})) for (const r of [].concat(n.realizes || [])) (real[r] ||= []).push(id);
  const out = [];
  for (const l of model.links || []) for (const a of real[l.from] || []) for (const b of real[l.to] || []) out.push([a, b, l.id]);
  for (const l of impl.links || []) out.push([l.from, l.to, l.id]);
  return out;
}

function check(pos, links) {
  const issues = [];
  for (const [a, b, id] of links) {
    const A = pos[a], B = pos[b]; if (!A || !B || A.z !== B.z) continue;
    if (withBack && B.x - A.x < -BACK) issues.push(`戻り：${id}（${a} → ${b}）`);
    const dx = B.x - A.x, dy = B.y - A.y, len2 = dx * dx + dy * dy; if (!len2) continue;
    for (const [c, C] of Object.entries(pos)) {
      if (c === a || c === b || C.z !== A.z) continue;
      const t = ((C.x - A.x) * dx + (C.y - A.y) * dy) / len2;
      if (t <= 0.1 || t >= 0.9) continue;
      const d = Math.hypot(A.x + t * dx - C.x, A.y + t * dy - C.y);
      if (d < HIT) issues.push(`飛び越し：${id}（${a} → ${b}）が ${c} の上`);
    }
  }
  return issues;
}

let total = 0;
for (const { id, model } of loadModels(only.length ? only : null)) {
  for (const impl of model.implementations || []) {
    for (const view of ['layout3d', 'layout2d']) {
      if (!impl[view]?.nodes) continue;
      const issues = check(positions(impl[view], impl.nodes), linksOf(model, impl));
      if (!issues.length) continue;
      total += issues.length;
      console.log(summary ? `${id} / ${impl.id} [${view.slice(-2)}] ${issues.length} 件` : `■ ${id} / ${impl.id} [${view.slice(-2)}]\n  - ${issues.join('\n  - ')}`);
    }
  }
}
console.log(total ? `\n${total} 件` : '問題なし');
