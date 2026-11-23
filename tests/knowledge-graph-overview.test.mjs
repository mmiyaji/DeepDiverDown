import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeKnowledgeGraph, overviewLayout } from '../js/knowledge-graph.js';
const index=JSON.parse(readFileSync(new URL('../models/research-index.json',import.meta.url),'utf8'));
const registry=JSON.parse(readFileSync(new URL('../models/registry.json',import.meta.url),'utf8'));
test('overview places each reference exactly once and connects every curated comparison',()=>{
  const graph=makeKnowledgeGraph(index.entries,registry), view=overviewLayout(graph);
  assert.equal(view.nodes.length,index.entries.length);
  assert.equal(view.byId.size,index.entries.length);
  const keys=new Set(view.edges.map(e=>[e.from,e.to].sort().join('|')));
  assert.equal(keys.size,view.edges.length);
  for(const node of view.nodes)for(const peer of graph.related(node.entry.id))assert.ok(keys.has([node.entry.id,peer.entry.id].sort().join('|')));
  for(const g of view.groups)for(const h of view.groups)if(g!==h)assert.ok(g.x+g.width<=h.x||h.x+h.width<=g.x||g.y+g.height<=h.y||h.y+h.height<=g.y);
});
