import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeKnowledgeGraph } from '../js/knowledge-graph.js';
const index = JSON.parse(readFileSync(new URL('../models/research-index.json', import.meta.url), 'utf8'));
const registry = JSON.parse(readFileSync(new URL('../models/registry.json', import.meta.url), 'utf8'));
test('knowledge graph includes every indexed reference in its declared category', () => {
  const graph = makeKnowledgeGraph(index.entries, registry);
  assert.equal([...graph.categories.values()].reduce((n, entries) => n + entries.length, 0), index.entries.length);
  assert.equal(graph.byId.size, index.entries.length);
  assert.ok([...graph.categories.values()].some(items => items.some(e => e.id === 'autoware-autonomous-driving')));
});
test('knowledge graph exposes curated comparison reasons and never links missing references', () => {
  const graph = makeKnowledgeGraph(index.entries, registry);
  const flink = graph.related('kafka-streams').find(r => r.entry.id === 'flink');
  assert.ok(flink?.topics.includes('ストリーム処理の状態管理'));
  assert.deepEqual(graph.related('does-not-exist'), []);
  for (const e of index.entries) for (const peer of graph.related(e.id)) assert.ok(graph.byId.has(peer.entry.id) && peer.topics.length);
});
