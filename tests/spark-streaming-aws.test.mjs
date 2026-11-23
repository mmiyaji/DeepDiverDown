import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
const model = yaml.load(readFileSync(new URL('../models/spark-streaming/model.yaml', import.meta.url), 'utf8'));
test('DStreams AWS examples specify execution and storage, with Kafka read on executors', () => {
  for (const [id,prefix,control] of [['aws-emr-ec2','emr','emr'],['aws-eks-spark','eks','eks']]) {
    const impl=model.implementations.find(x=>x.id===id); assert.ok(impl);
    const nodes=Object.values(impl.nodes); assert.ok(nodes.some(n=>n.svc===control));
    for(const svc of ['msk','ec2','s3'])assert.ok(nodes.some(n=>n.svc===svc));
    for(const role of Object.keys(model.nodes))assert.ok(nodes.some(n=>n.realizes?.includes(role)),role);
    assert.ok(impl.links.some(l=>l.from===`${prefix}-msk`&&l.to===`${prefix}-executor`&&l.replace&&l.realizes.includes('receive')));
    assert.ok(impl.groups.some(g=>g.provider==='aws'));
    assert.ok(impl.sources.length>=3);
  }
});
