import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { minimapViewport } from '../js/minimap-viewport.js';

function camera(position, target = [0, 0, 0]) {
  const cam = new THREE.OrthographicCamera(-4, 4, 2, -2, -500, 500);
  cam.position.set(...position);
  if (position[0] === 0 && position[2] === 0) cam.up.set(0, 0, -1);
  cam.lookAt(...target);
  cam.updateProjectionMatrix();
  return cam;
}

test('ミニマップは表示範囲とズームを地面へ投影する', () => {
  const cam = camera([0, 10, 0]);
  const bounds = { cx: 0, cz: 0, hw: 10, hh: 10 };
  const coords = minimapViewport(cam, 0, bounds);
  for (const [actual, expected] of coords.flat().map((v, i) => [v, [30, 40, 70, 40, 70, 60, 30, 60][i]]))
    assert.ok(Math.abs(actual - expected) < 1e-8);
  cam.zoom = 2;
  cam.updateProjectionMatrix();
  const zoomed = minimapViewport(cam, 0, bounds);
  assert.ok(Math.abs(zoomed[1][0] - zoomed[0][0] - 20) < 1e-8);
  const clipped = minimapViewport(cam, 0, bounds, { left: 0, right: 1, top: 1, bottom: -1 });
  assert.ok(Math.abs(clipped[0][0] - 50) < 1e-8);
});

test('斜めの表示は回転した範囲を示し、真横では非表示にする', () => {
  const bounds = { cx: 0, cz: 0, hw: 10, hh: 10 };
  const angled = minimapViewport(camera([10, 10, 10]), 0, bounds);
  assert.equal(angled.length, 4);
  assert.notEqual(angled[0][1], angled[1][1]);
  assert.equal(minimapViewport(camera([10, 0, 0]), 0, bounds), null);
});
