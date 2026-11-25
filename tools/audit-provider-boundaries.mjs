#!/usr/bin/env node
// 実装例で、クラウドや SaaS のサービスが、その提供元の枠（group.provider）の中に入っているかを点検する。
// 使い方: node tools/audit-provider-boundaries.mjs [model-id ...]
import { loadAnalyze, loadModels } from './load.mjs';

// 提供元の領域として枠で囲むべき提供元（オンプレや Kubernetes 自体は対象外）
export const BOUNDARY_PROVIDERS = new Set(['aws', 'gcp', 'azure', 'oci', 'cloudflare', 'databricks', 'snowflake', 'fabric']);

export function providerBoundaryIssues(model, Catalog) {
  const issues = [];
  for (const impl of model.implementations || []) {
    const views = [
      ['共通', impl.groups || []],
      ...(impl.layout2d?.groups ? [['2D', impl.layout2d.groups]] : []),
      ...(impl.layout3d?.groups ? [['3D', impl.layout3d.groups]] : []),
    ];
    for (const [id, node] of Object.entries(impl.nodes || {})) {
      const provider = Catalog.providerOf(node);
      if (!provider || !BOUNDARY_PROVIDERS.has(provider)) continue;
      for (const [view, groups] of views) {
        const inside = groups.some(g => g.provider === provider && (!g.nodes || g.nodes.includes(id)));
        if (!inside) issues.push(`${impl.id} [${view}] ${node.label || id}（${provider}）が ${provider} の枠に入っていない`);
      }
    }
    // 稼働環境の枠：利用者・外部クライアント以外の部品は、クラウド（cloud）か自前の拠点（datacenter）の枠に入れる
    for (const [view, groups] of views) {
      const envs = groups.filter(g => ENV_KINDS.has(g.kind));
      for (const [id, node] of Object.entries(impl.nodes || {})) {
        if (OUTSIDE_KINDS.has(node.kind)) continue;
        if (!envs.some(g => !g.nodes || g.nodes.includes(id))) issues.push(`${impl.id} [${view}] ${node.label || id} が稼働環境の枠（cloud / datacenter）に入っていない`);
      }
      for (const g of envs) if (g.kind === 'cloud' && !g.provider) issues.push(`${impl.id} [${view}] 枠「${g.label || g.kind}」に provider がない`);
    }
  }
  return issues;
}

// 稼働環境を表す枠と、枠の外に置いてよい部品の種類
export const ENV_KINDS = new Set(['cloud', 'datacenter']);
export const OUTSIDE_KINDS = new Set(['client', 'actor', 'user', 'external']);

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:')}` || process.argv[1]?.endsWith('audit-provider-boundaries.mjs')) {
  const A = loadAnalyze();
  const only = process.argv.slice(2);
  let total = 0;
  for (const { id, model } of loadModels(only.length ? only : undefined)) {
    if (!model.implementations?.length) continue;
    const issues = providerBoundaryIssues(model, A.Catalog);
    if (!issues.length) continue;
    total += issues.length;
    console.log(`■ ${id}`);
    for (const i of issues) console.log(`  - ${i}`);
  }
  console.log(total ? `\n${total} 件` : '問題なし');
  process.exitCode = total ? 1 : 0;
}
