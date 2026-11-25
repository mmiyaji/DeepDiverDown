import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAnalyze, loadModels } from '../tools/load.mjs';
import { providerBoundaryIssues } from '../tools/audit-provider-boundaries.mjs';
import { implementation3D } from '../js/implementation-3d.js';
import { buildDiagramLayout } from '../js/diagram-layout.js';

test('取り込み製品の詳細図は概要と実装例につながる', () => {
  const A = loadAnalyze(), models = loadModels();
  const byId = new Map(models.map(x => [x.id, x]));
  for (const product of ['Debezium', 'Airbyte', 'Fivetran', 'PostgreSQL']) {
    const entries = models.filter(x => x.reference?.product === product);
    const overview = entries.filter(x => x.reference.role === 'overview');
    const details = entries.filter(x => x.reference.role === 'internals').sort((a, b) => a.reference.step - b.reference.step);
    assert.equal(overview.length, 1, product);
    assert.deepEqual(details.map(x => x.reference.step), [1, 2], product);
    for (const entry of entries) {
      assert.deepEqual(providerBoundaryIssues(entry.model, A.Catalog), [], entry.id);
      assert.ok(entry.model.implementations?.length, entry.id);
      if (entry.reference.role === 'internals') {
        assert.equal(entry.reference.detailOf, overview[0].id, entry.id);
        const parent = byId.get(entry.model.parent?.model);
        assert.equal(parent?.model.nodes[entry.model.parent.node]?.drill, entry.id, entry.id);
      }
      for (const impl of entry.model.implementations) {
        assert.ok(impl.sources?.length, `${entry.id}/${impl.id}`);
        const base = A.Views.project(entry.model, entry.model, `impl:${impl.id}`);
        for (const flat of [true, false]) {
          const layout = flat ? impl.layout2d : impl.layout3d;
          assert.ok(layout?.groups?.length, `${entry.id}/${impl.id}/${flat}`);
          const view = implementation3D(base, layout, {flat});
          assert.deepEqual(Object.keys(view.nodes).sort(), Object.keys(base.nodes).sort());
          assert.equal(view.links.length, base.links.length);
          const plan = buildDiagramLayout(view, {flat, width: 1000, height: 700});
          for (const [id,n] of Object.entries(view.nodes)) assert.ok(plan.point(n.x,n.y,n.tier).every(Number.isFinite), `${entry.id}/${impl.id}/${id}`);
        }
      }
    }
  }
});

test('Fivetran と GitHub は SaaS 提供元、PostgreSQL は自前設置できる製品として区別する', () => {
  const c = loadAnalyze().Catalog;
  assert.equal(c.lookup('fivetran:platform').provider, 'fivetran');
  assert.equal(c.lookup('github:platform').provider, 'github');
  assert.equal(c.lookup('postgresql:server').provider, 'postgresql');
  const incorrect = { implementations: [{ id:'x', nodes: { service: {svc:'fivetran:platform',kind:'service'} }, groups: [{kind:'cloud',provider:'aws',nodes:['service']}] }] };
  assert.ok(providerBoundaryIssues(incorrect, c).some(x => x.includes('fivetran')));
});

test('Snowflake ingestion details belong to the Snowflake overview', () => {
  const models = loadModels();
  const ids = ['snowflake-ingestion-cdc', 'snowflake-snowpipe-streaming-internals', 'snowflake-kafka-iceberg-streaming'];
  const overview = models.find(x => x.id === 'snowflake');
  assert.equal(overview.reference.role, 'overview');
  ids.forEach((id, i) => {
    const entry = models.find(x => x.id === id);
    assert.equal(entry.reference.product, 'Snowflake');
    assert.equal(entry.reference.detailOf, 'snowflake');
    assert.equal(entry.reference.role, 'internals');
    assert.equal(entry.reference.step, i + 1);
  });
});
