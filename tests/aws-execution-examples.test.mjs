import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import yaml from 'js-yaml';
const load = id => yaml.load(fs.readFileSync(new URL(`../models/${id}/model.yaml`,import.meta.url),'utf8'));
test('Trino file readers specify AWS execution, metadata and data services',()=>{
  for (const id of ['trino','parquet-internals','orc-internals']) {
    const model=load(id), impl=model.implementations[0], nodes=Object.values(impl.nodes);
    for (const svc of ['eks','ec2','glue','s3']) assert.ok(nodes.some(n=>n.svc===svc),`${id} ${svc}`);
    for (const role of Object.keys(model.nodes)) assert.ok(nodes.some(n=>n.realizes?.includes(role)),`${id} ${role}`);
    assert.ok(impl.groups.some(g=>g.kind==='cluster'));
    assert.ok(impl.groups.some(g=>g.provider==='aws'));
    assert.ok(impl.links.some(l=>/Coordinator/.test(impl.nodes[l.from]?.label) && impl.nodes[l.to]?.svc==='glue'));
  }
});
test('Polaris implementation distinguishes managed runtime, persistence and data',()=>{
  const impl=load('apache-polaris').implementations[0],nodes=Object.values(impl.nodes);
  for (const svc of ['eks','ec2','emr','rds','s3','aws:sts','aws:iam']) assert.ok(nodes.some(n=>n.svc===svc),svc);
  assert.ok(nodes.some(n=>n.svc==='rds'&&n.realizes?.includes('catalog-db')));
  assert.ok(impl.groups.some(g=>g.kind==='cluster'&&g.nodes.includes('polaris-aws-server')));
});

test('analytics and search examples place application runtime and data services separately',()=>{
  const a=load('analytics-agent').implementations[0];
  for (const svc of ['ecs','fargate','cognito','cloudwatch','databricks:sql','databricks:delta','databricks:aisearch']) assert.ok(Object.values(a.nodes).some(n=>n.svc===svc),svc);
  assert.equal(a.nodes['ex-warehouse'].svc,'databricks:delta');
  for (const id of ['example-metrics-sql','example-sql-delta']) assert.ok(a.links.some(l=>l.id===id&&l.replace&&l.realizes.includes('read')));
  const s=load('databricks-ai-search').implementations[0];
  for (const svc of ['ecs','fargate','s3','databricks:lakeflow','databricks:aisearch']) assert.ok(Object.values(s.nodes).some(n=>n.svc===svc),svc);
  assert.ok(s.links.some(l=>l.from==='db-s3'&&l.to==='db-auto-loader'));
  assert.ok(s.links.some(l=>l.from==='db-auto-loader'&&l.to==='db-source'));
});
test('synthetic data job specifies execution and restricted candidate storage',()=>{
  const impl=load('dwh-synthetic-data').implementations[0];
  assert.equal(impl.nodes['ex-run'].svc,'gcp:cloudrun');
  assert.equal(impl.nodes['ex-engine'].svc,'gcp:bigquery');
  assert.ok(!impl.nodes['ex-candidate'].svc, '候補データセットと BigQuery サービスを区別する');
  assert.match(impl.nodes['ex-candidate'].description, /権限/);
  assert.ok(impl.links.some(l=>l.from==='ex-run'&&l.to==='ex-train'));
});

test('Fivetran SaaS separates source, destination and warehouse',()=>{
  const impl=load('fivetran').implementations[0], n=impl.nodes;
  assert.equal(n['postgres-snowflake-pg'].svc,'rds');
  assert.equal(n['postgres-snowflake-snowflake'].svc,'snowflake:platform');
  assert.equal(n['postgres-snowflake-warehouse'].svc,'snowflake:warehouse');
  assert.ok(impl.groups.some(g=>g.label==='Fivetran SaaS'&&g.nodes.includes('postgres-snowflake-connection')));
});
test('managed monitoring shows AWS execution and alert routing',()=>{
  const impl=load('monitoring-prometheus').implementations.find(i=>i.id==='aws-managed-prometheus');
  for(const svc of ['eks','ec2','amp','grafana','sns'])assert.ok(Object.values(impl.nodes).some(n=>n.svc===svc),svc);
  for(const edge of ['amp-pull','amp-write'])assert.ok(impl.links.some(l=>l.id===edge&&l.replace&&l.realizes.includes('ingest')));
});

test('managed platform service icons identify the actual service or endpoint',()=>{
  const df=load('google-cloud-dataflow').implementations[0].nodes;
  assert.equal(df['gcp-dataflow'].svc,'gcp:dataflow');
  const redshift=load('redshift').implementations[0].nodes;
  assert.equal(redshift['example-s3-endpoint'].svc,'vpcendpoint');
});
