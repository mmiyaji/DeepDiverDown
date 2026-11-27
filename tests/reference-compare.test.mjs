import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comparisonCandidates } from '../js/reference-compare.js';
import { compareRoles, mechanism } from '../js/comparison-roles.js';
import yaml from 'js-yaml';

const registry = JSON.parse(readFileSync(new URL('../models/registry.json', import.meta.url), 'utf8'));
const load = id => ({ id, model: yaml.load(readFileSync(new URL('../models/' + id + '/model.yaml', import.meta.url), 'utf8')) });

test('カタログ発行の認証情報は取得側と発行側の違いを比較できる', () => {
  const ids = ['snowflake-iceberg-vended-credentials', 'databricks-unity-vended-credentials'];
  assert.ok(comparisonCandidates(registry, ids[0]).some(c => c.entry.id === ids[1]));
  const group = compareRoles(ids.map(load)).groups.find(g => g.sides[0].includes('credentials') && g.sides[1].includes('credential'));
  assert.ok(group?.difference);
});

test('Snowflake と Databricks の性能詳細は対応役割と異なる実装を示す', () => {
  const a = 'snowflake-query-performance', b = 'databricks-sql-performance';
  assert.ok(comparisonCandidates(registry, a).some(c => c.entry.id === b));
  assert.ok(comparisonCandidates(registry, b).some(c => c.entry.id === a));
  const pair = [load(a), load(b)];
  const comparison = compareRoles(pair);
  for (const [left, right] of [['metadata','log'], ['micro','files'], ['whcache','diskcache'], ['clusters','operators']]) {
    const group = comparison.groups.find(g => g.sides[0].includes(left) && g.sides[1].includes(right));
    assert.ok(group?.difference, `${left} / ${right}`);
  }
  assert.ok(comparison.other[0].includes('qas'));
});

test('comparison distinguishes adapters from inputs and explains a shared role with different mechanisms', () => {
  const pair = ['kafka-connect', 'airbyte'].map(load);
  const { groups } = compareRoles(pair);
  const progress = groups.find(g => g.sides[0].includes('offsets'));
  assert.deepEqual(progress.sides[1], ['state']);
  assert.ok(progress.difference);
  assert.match(mechanism(pair[1], progress.sides[1]), /Destination/);
  assert.deepEqual(groups.find(g => g.sides[0].includes('source')).sides[1], ['sourceConnector']);
  const managed = compareRoles(['amazon-eks', 'azure-aks'].map(load));
  assert.ok(managed.groups.find(g => g.sides[0].includes('managed')).difference);
  assert.equal(managed.groups.find(g => g.sides[0].includes('workload')).difference, '');
});

test('Iceberg v3 diagrams match schema, manifest, files and the Variant dictionary', () => {
  const variant = load('iceberg-v3-variant'), metadata = load('iceberg-v3-metadata');
  const { groups } = compareRoles([variant, metadata]);
  for (const [left, right] of [['schema', 'schema'], ['manifest', 'data-manifest'], ['file', 'data'], ['meta', 'dictionary']])
    assert.ok(groups.some(g => g.sides[0].includes(left) && g.sides[1].includes(right)), left);
  for (const model of [variant, metadata])
    assert.ok(compareRoles([model, load('apache-iceberg')]).groups.length > 0);
});

test('Slack distinguishes API messages from transient WebSocket events', () => {
  const model = load('slack-real-time-messaging').model;
  const link = id => model.links.find(edge => edge.id === id);
  assert.deepEqual([link('post').from, link('post').to], ['sender', 'api']);
  assert.deepEqual([link('transient').from, link('transient').to], ['sender', 'gateway-a']);
  assert.deepEqual([link('fan-a').from, link('fan-b').from], ['channel', 'channel']);
  assert.ok(compareRoles([load('slack-real-time-messaging'), load('kafka')]).groups.length >= 2);
});

test('overlapping IDs, ambiguous labels and a shared node shape alone do not establish a correspondence', () => {
  const node = label => ({ label, kind: 'db' });
  const { groups, other } = compareRoles([
    { id: 'a', model: { nodes: { store: node('ログ'), x: node('控え'), y: node('控え') } } },
    { id: 'b', model: { nodes: { store: node('集計'), backup: node('控え') } } },
  ]);
  assert.deepEqual(groups, []);
  assert.deepEqual(other, [['store','x','y'], ['store','backup']]);
});

test('comparisons start at the open architecture and combine shared topics without duplicating a target', () => {
  const candidates = comparisonCandidates(registry, 'kafka-connect');
  assert.ok(candidates.some(c => c.entry.id === 'airbyte'));
  assert.ok(!candidates.some(c => c.entry.id === 'amazon-eks'));
  assert.ok(!candidates.some(c => c.entry.id === 'postgresql-logical-decoding'));
  assert.deepEqual(comparisonCandidates([...registry, { id: 'local-example' }], 'local-example'), []);
});

test('pairs can be opened from either end, including overview and detail diagrams', () => {
  const peers = new Map(registry.map(e => [e.id, comparisonCandidates(registry, e.id).map(c => c.entry.id)]));
  for (const [id, ids] of peers) {
    assert.ok(!ids.includes(id));
    assert.equal(new Set(ids).size, ids.length);
    for (const other of ids) assert.ok(peers.get(other).includes(id), id + ' / ' + other);
  }
  assert.ok(peers.get('redis').includes('valkey'));
  assert.ok(!peers.get('redis').includes('redis-memory-internals'));
  assert.deepEqual(peers.get('kafka'), []);
});
