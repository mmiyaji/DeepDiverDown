import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { platformFootprint, platformNeedsMemberBounds } from '../js/implementation-3d.js';

test('複数の提供元が同じフロアを共有しても各枠は所属部品だけを囲む', () => {
  const floors = [{ x: 0, z: 0, left: -2, right: 30, back: -2, front: 10 }];
  const a = platformFootprint([[1, 0, 1], [4, 5, 3]], floors, true);
  const b = platformFootprint([[20, 0, 1], [24, 5, 3]], floors, true);
  assert.ok(a[1] < b[0]);
  for (const [bounds, points] of [[a, [[1, 1], [4, 3]]], [b, [[20, 1], [24, 3]]]]) {
    for (const [x, z] of points) assert.ok(bounds[0] <= x && x <= bounds[1] && bounds[2] <= z && z <= bounds[3]);
  }
});

test('単一提供元では床を含む全体の枠を維持する', () => {
  const floors = [{ x: 2, z: 3, left: -2, right: 12, back: -1, front: 8 }];
  assert.deepEqual(platformFootprint([[4, 0, 5]], floors, false), [-1.2, 15.2, 0.8, 12.2]);
});


test('同じフロアの枠外クライアントをクラウドや自前環境に含めない', () => {
  const groups = [{ kind: 'datacenter', provider: 'onprem' }];
  const host = ['host', { tier: 'one' }], client = ['client', { tier: 'one' }];
  assert.equal(platformNeedsMemberBounds(groups, [host], [host, client]), true);
  assert.equal(platformNeedsMemberBounds(groups, [host], [host]), false);
  assert.equal(platformNeedsMemberBounds([...groups, {kind:'cloud', provider:'aws'}], [host], [host]), true);
});
