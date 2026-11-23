import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { implementation3D } from '../js/implementation-3d.js';
import { buildDiagramLayout } from '../js/diagram-layout.js';
import { loadAnalyze } from '../tools/load.mjs';
const m=yaml.load(readFileSync(new URL('../models/spark-streaming/model.yaml',import.meta.url),'utf8'));
const A=loadAnalyze();
test('Spark Streaming AWS layouts stack compute and keep independent services in AWS',()=>{
 for(const [id,prefix] of [['aws-eks-spark','eks'],['aws-emr-ec2','emr']]){
  const impl=m.implementations.find(i=>i.id===id), base=A.Views.project(m,m,'impl:'+id), v=implementation3D(base,impl.layout3d);
  assert.equal(base.nodes[`${prefix}-driver`].tier,'compute');
  assert.equal(v.nodes[`${prefix}-driver`].tier,'workloads');
  assert.equal(v.nodes[`${prefix}-ec2`].tier,'platform');
  assert.equal(v.nodes[`${prefix}-msk`].tier,'services');
  const cloud=v.groups.find(g=>g.kind==='cloud'), cluster=v.groups.find(g=>g.kind==='cluster');
  for(const service of [`${prefix}-msk`,`${prefix}-output`,`${prefix}-checkpoint`]) {assert.ok(cloud.nodes.includes(service));assert.ok(!cluster.nodes.includes(service));}
  assert.deepEqual(v.links,base.links);
  const p=buildDiagramLayout(v,{flat:false}), driver=p.point(v.nodes[`${prefix}-driver`].x,1.5,'workloads');
  const control=p.point(1,1.5,'platform');assert.equal(driver[0],control[0]);assert.equal(driver[2],control[2]);assert.ok(driver[1]>control[1]);
 }
});
test('invalid or partial 3D layout safely falls back to original view',()=>{
 const view={tiers:[{id:'old'}],nodes:{a:{tier:'old'}}};
 assert.equal(implementation3D(view,{tiers:[{id:'new'}],nodes:{}}),view);
 assert.equal(implementation3D(view),view);
});
test('management labels distinguish AWS-operated services from application operations',()=>{
 for(const [id,prefix] of [['aws-eks-spark','eks'],['aws-emr-ec2','emr']]){
  const i=m.implementations.find(x=>x.id===id);
  for(const name of ['msk','output','checkpoint'])assert.equal(i.nodes[`${prefix}-${name}`].management.type,'shared');
  for(const name of ['driver','executor'])assert.equal(i.nodes[`${prefix}-${name}`].management.type,'customer');
  assert.ok(Object.values(i.nodes).every(n=>n.management?.scope));
 }
 assert.equal(m.implementations.find(x=>x.id==='aws-eks-spark').nodes['eks-ec2'].management.type,'shared');
});
test('2D platform layouts nest compute while MSK and S3 remain outside the cluster',()=>{
 for(const [id,p] of [['aws-eks-spark','eks'],['aws-emr-ec2','emr']]){
  const i=m.implementations.find(x=>x.id===id),base=A.Views.project(m,m,'impl:'+id),v=implementation3D(base,i.layout2d,{flat:true});
  assert.ok(v.platform2D);assert.ok(!v.platformStack);assert.deepEqual(v.links,base.links);
  const cloud=v.groups.find(g=>g.kind==='cloud'),cluster=v.groups.find(g=>g.kind==='cluster'),nodeGroup=v.groups.find(g=>g.kind==='nodegroup');
  for(const [key,node] of Object.entries(v.nodes)){
   assert.ok(node.x>cloud.x0&&node.x<cloud.x1&&node.y>cloud.y0&&node.y<cloud.y1,key);
   if(cluster.nodes.includes(key))assert.ok(node.x>cluster.x0&&node.x<cluster.x1&&node.y>cluster.y0&&node.y<cluster.y1,key);
  }
  for(const part of ['msk','output','checkpoint']) assert.ok(!cluster.nodes.includes(`${p}-${part}`));
  for(const part of ['driver','executor','ec2'])assert.ok(nodeGroup.nodes.includes(`${p}-${part}`));
 }
});
