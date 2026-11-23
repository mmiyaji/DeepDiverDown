import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { buildDiagramLayout } from '../js/diagram-layout.js';

const view = {
  tiers: [{ id: 'edge', z: 1 }, { id: 'app', z: 1 }, { id: 'data', z: 0 }],
  nodes: {
    client: { x: 0, y: 1, tier: 'edge' }, api: { x: 0, y: 0, tier: 'app' },
    worker: { x: 3, y: 0, tier: 'app' }, service: { x: 6, y: 0, tier: 'app' },
    db: { x: 1, y: 1, tier: 'data' },
  },
  groups: [{ tier: 'app', x0: -2, x1: 8, y0: -1, y1: 2 }],
  links: [
    { id: 'forward', from: 'api', to: 'service' }, { id: 'back', from: 'service', to: 'api' },
    { id: 'store', from: 'service', to: 'db' }, { id: 'loop', from: 'worker', to: 'worker' },
  ],
};

test('dense full-size cards reserve their actual width when routing around other nodes', () => {
  const graph = yaml.load(readFileSync(new URL('../models/iceberg-v3-variant/model.yaml', import.meta.url), 'utf8'));
  const plan = buildDiagramLayout(graph, { flat: true, comparison: true, cardWidthPx: 170, width: 984, height: 650 });
  const clearance = 85 * plan.unitsPerPixel;
  const [x,, z] = plan.point(graph.nodes.typed.x, graph.nodes.typed.y, graph.nodes.typed.tier);
  const path = plan.routes.get('stats');
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    assert.ok(!(Math.min(a[0], b[0]) < x + clearance && Math.max(a[0], b[0]) > x - clearance &&
      Math.min(a[2], b[2]) < z + 25 * plan.unitsPerPixel && Math.max(a[2], b[2]) > z - 25 * plan.unitsPerPixel));
  }
});

test('comparison places the Streams and Flink pipelines in reading order with room for labels', () => {
  for (const [model, tier] of [['kafka-streams', 'app'], ['flink', 'flow']]) {
    const graph = yaml.load(readFileSync(new URL('../models/' + model + '/model.yaml', import.meta.url), 'utf8'));
    const pipeline = Object.values(graph.nodes).filter(n => n.tier === tier).sort((a,b) => a.x - b.x);
    for (const [width, height, compact] of [[706, 342, false], [303, 568, true]]) {
      const layout = buildDiagramLayout(graph, { flat: true, comparison: true, width, height, compact });
      const axis = compact ? 2 : 0;
      const positions = pipeline.map(n => layout.point(n.x, n.y, tier)[axis] / layout.unitsPerPixel);
      for (let i = 1; i < positions.length; i++) assert.ok(positions[i] - positions[i-1] >= 54, model);
    }
  }
});

test('Kafka Connect keeps its pipeline straight and its offset traffic distinguishable', () => {
  const graph = yaml.load(readFileSync(new URL('../models/kafka-connect/model.yaml', import.meta.url), 'utf8'));
  for (const [width, height] of [[984, 669], [696, 268], [372, 573]]) {
    const plan = buildDiagramLayout(graph, { flat: true, compact: width < 620, width, height });
    for (const id of ['capture', 'publish', 'fetch', 'write']) assert.equal(plan.routes.get(id).length, 2);
    const segments = [];
    for (const [id, path] of plan.routes) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1], axis = a[0] === b[0] ? 2 : 0;
        segments.push({ id, axis, line: a[2-axis], lo: Math.min(a[axis], b[axis]), hi: Math.max(a[axis], b[axis]) });
      }
    }
    for (const [id, path] of plan.routes) {
      const { segment, fraction } = plan.arrowPositions.get(id);
      const tip = path[segment].map((v, k) => v + fraction * (path[segment+1][k] - v));
      for (const s of segments.filter(s => s.id !== id)) {
        const distance = Math.hypot(tip[2-s.axis] - s.line, Math.max(0, s.lo - tip[s.axis], tip[s.axis] - s.hi));
        assert.ok(distance >= 3 * plan.unitsPerPixel, `${width}px: ${id} arrow at ${s.id}`);
      }
    }
    for (const [a, b] of [['start-sink', 'source-offset'], ['sink-offset', 'resume']]) {
      for (const s of segments.filter(s => s.id === a)) {
        for (const t of segments.filter(t => t.id === b && t.axis === s.axis)) {
          if (Math.abs(t.line - s.line) < 0.001)
            assert.ok(Math.min(s.hi, t.hi) <= Math.max(s.lo, t.lo) + 0.001, `${width}px: ${a} overlaps ${b}`);
        }
      }
    }
  }
});

test('floor bounds include group coordinates and separate coplanar plates on desktop and mobile', () => {
  for (const compact of [true, false]) {
    const plan = buildDiagramLayout(view, { flat: true, compact });
    const [edge, app, data] = [...plan.floors.values()];
    assert.ok(app.left < plan.point(-2, 0, 'app')[0] - app.x);
    if (compact) assert.ok(app.z + app.back > edge.z + edge.front);
    else assert.ok(app.x + app.left > edge.x + edge.right);
    assert.ok(data.z + data.back > app.z + app.front);
    assert.ok([...plan.floors.values()].every(f => f.y === 0));
  }
});

test('orthogonal paths avoid a third node between endpoints and separate return traffic', () => {
  const plan = buildDiagramLayout(view, { flat: true });
  const [wx,, wz] = plan.point(3, 0, 'app');
  for (const id of ['forward', 'back']) {
    const points = plan.routes.get(id);
    for (let i = 1; i < points.length; i++) {
      const [x,, z] = points[i - 1], [u,, w] = points[i];
      assert.ok(x === u || z === w);
      assert.ok(!(Math.min(x,u) < wx + 1.45 && Math.max(x,u) > wx - 1.45 &&
        Math.min(z,w) < wz + 0.58 && Math.max(z,w) > wz - 0.58));
    }
  }
  assert.notDeepEqual(plan.routes.get('forward'), [...plan.routes.get('back')].reverse());
  const loop = plan.routes.get('loop');
  assert.deepEqual(loop[0], loop.at(-1));
  assert.ok(loop.length >= 4);
});

test('expanding 3D floors moves the link endpoints with their nodes and preserves the source', () => {
  const original = structuredClone(view);
  const standard = buildDiagramLayout(view, { flat: false });
  const expanded = buildDiagramLayout(view, { flat: false, expanded: true });
  const gap = p => p.floors.get('app').y - p.floors.get('data').y;
  assert.ok(gap(expanded) > gap(standard));
  const end = expanded.routes.get('store').at(-1);
  assert.deepEqual(end, expanded.point(1, 1, 'data').map((v, i) => i === 1 ? v + 0.26 : v));
  assert.deepEqual(view, original);
});

test('flat overview reserves screen space for cards at the ends of a long single-row floor', () => {
  const graph = { tiers: [{ id: 'flow', size: [16, 3] }], links: [], nodes: {} };
  for (const x of [0, 4, 8, 12, 16]) graph.nodes[x] = { x, y: 1.5, tier: 'flow' };
  for (const width of [696, 984]) {
    const plan = buildDiagramLayout(graph, { flat: true, width, height: 400 });
    const f = plan.floors.get('flow');
    const pixelsPerUnit = (width - 40) / (f.right - f.left);
    for (const x of [0, 16]) {
      const [cx] = plan.point(x, 1.5, 'flow');
      assert.ok((cx - f.x - f.left) * pixelsPerUnit >= 90);
      assert.ok((f.x + f.right - cx) * pixelsPerUnit >= 90);
    }
  }
  const portrait = buildDiagramLayout(graph, { flat: true, compact: true, width: 372, height: 570 });
  const first = portrait.point(0, 1.5, 'flow'), last = portrait.point(16, 1.5, 'flow');
  assert.equal(first[0], last[0]);
  assert.ok(first[2] < last[2]);
});
