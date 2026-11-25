#!/usr/bin/env node
// Inspect service icons and cloud boundaries in every implementation.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, loadModels } from './load.mjs';

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/catalog.js'), 'utf8'), context);
const { lookup } = context.window.Catalog;
const manifestPath = path.join(ROOT, 'icons', 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
let total = 0, missingIcons = 0, missingBoundaries = 0, unresolved = 0, needsReview = 0, reviewed = 0, intrusions = 0;
// These names identify candidates for review, not automatic service mappings.
// A query client, for example, need not run inside the named provider.
const namedProvider = /\b(AWS|Amazon|Azure|BigQuery|Snowflake|Databricks|Unity Catalog|Lakeflow|Google Cloud|OCI|Oracle Cloud|Microsoft Fabric|Fabric|OneLake|Purview|Knowledge Catalog|Dataplex|Cloud Storage|Redshift|Athena|EKS|AKS|S3)\b/i;
// Reviewed by model/implementation/node and exact label, so edits to the
// example cause a fresh review rather than inheriting an obsolete exception.
const reviewedNonServices = {
  'kafka-connect/distributed/distributed-sink': ['Confluent S3 Sink コネクター', 'Confluent のコネクターであり、S3 サービス自体ではない'],
  'etl-elt/aws-redshift/aws-redshift-dbt-client': ['dbt-redshift 実行環境', 'dbt クライアントの配置先は指定されていない'],
  'etl-elt/aws-redshift/aws-redshift-bi': ['Redshift 対応の BI クライアント', '外部の BI クライアント'],
  'data-catalog-architecture/uc-on-aws/uc-on-aws-analyst': ['Databricks ワークスペース利用者', '利用者'],
  'project-nessie/nessie-local/nessie-local-minio': ['MinIO（S3 互換）', 'S3 互換の MinIO であり、Amazon S3 ではない'],
  'fabric-onelake-catalog/fabric-managed/fabric-managed-admin': ['Fabric ワークスペース管理者', '管理者'],
  'google-cloud-knowledge-catalog/gcp-bigquery/gcp-bigquery-user': ['BigQuery の利用者', '利用者'],
  'google-cloud-knowledge-catalog/gcp-bigquery/gcp-bigquery-job-project': ['BigQuery ジョブ実行プロジェクト', 'Google Cloud のプロジェクトでありサービスではない'],
  'databricks-open-sharing/databricks-sharing/example-owner': ['提供側 Unity Catalog 管理者', '管理者'],
};
for (const { id, model } of loadModels()) {
  for (const implementation of model.implementations || []) {
    total++;
    const groups = implementation.groups || [];
    const missing = [];
    for (const [nodeId, node] of Object.entries(implementation.nodes || {})) {
      if (!node.svc) {
        if (namedProvider.test(node.label || '')) {
          const review = reviewedNonServices[[id, implementation.id, nodeId].join('/')];
          if (review?.[0] === node.label) reviewed++;
          else {
            needsReview++;
            missing.push(nodeId + ': 表示名から所属・アイコンを要確認 ' + node.label);
          }
        }
        continue;
      }
      const service = lookup(node.svc);
      if (!service) { unresolved++; missing.push(nodeId + ': 未登録 ' + node.svc); continue; }
      const icon = manifest[service.id];
      if (service.icon && (!icon || !fs.existsSync(path.join(ROOT, icon)))) {
        missingIcons++; missing.push(nodeId + ': アイコン未配置 ' + service.id);
      }
      if (!['aws', 'gcp', 'azure', 'oci', 'databricks', 'snowflake', 'fabric', 'purview', 'fivetran', 'github'].includes(service.provider) || service.id === 'aws:github') continue;
      const inBoundary = groups.some(group => group.kind === 'cloud' &&
        (group.provider === service.provider || (!group.provider && group.label?.toLowerCase().includes(service.provider))) &&
        (!group.tier || [].concat(group.tier).includes(node.tier)) && (!group.nodes || group.nodes.includes(nodeId)));
      if (!inBoundary) { missingBoundaries++; missing.push(nodeId + ': クラウド境界未指定 ' + service.provider); }
    }
    // A rectangular boundary can unintentionally surround a non-member even
    // if its node list is correct. Check explicit coordinates per tier; this
    // is a conservative model-space check, not a substitute for rendered QA.
    const nodes = implementation.nodes || {};
    for (const group of groups.filter(g => g.kind === 'cloud' && g.nodes?.length)) {
      const tiers = new Set(group.nodes.map(id => nodes[id]?.tier).filter(Boolean));
      for (const tier of tiers) {
        const members = group.nodes.map(id => nodes[id]).filter(n => n?.tier === tier && Number.isFinite(n.x) && Number.isFinite(n.y));
        if (members.length < 2) continue;
        const xs = members.map(n => n.x), ys = members.map(n => n.y), pad = 1.2;
        const left = Math.min(...xs) - pad, right = Math.max(...xs) + pad;
        const top = Math.min(...ys) - pad, bottom = Math.max(...ys) + pad;
        for (const [nodeId, node] of Object.entries(nodes)) {
          if (group.nodes.includes(nodeId) || node.tier !== tier || !Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;
          if (node.x > left && node.x < right && node.y > top && node.y < bottom) {
            intrusions++;
            missing.push(nodeId + ': 所属しない部品がクラウド枠内に配置 ' + group.label);
          }
        }
      }
    }
    if (missing.length) console.log(id + ' / ' + implementation.id + '\n  ' + missing.join('\n  '));
  }
}
console.log(`実装例 ${total} 件、未登録サービス ${unresolved} 件、アイコン未配置 ${missingIcons} 件、境界未指定 ${missingBoundaries} 件、枠内の非所属部品 ${intrusions} 件、サービス以外と確認済み ${reviewed} 件、名称から要確認 ${needsReview} 件`);
