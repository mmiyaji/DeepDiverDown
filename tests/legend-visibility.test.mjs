import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { legendState, showGroup, showLink } from '../js/legend-visibility.js';

test('提供元の領域だけを隠し、クラスタや他の提供元は残す', () => {
  const state = legendState({ hiddenProviders: ['aws'] });
  assert.equal(showGroup({ kind: 'cloud', provider: 'aws' }, state), false);
  assert.equal(showGroup({ kind: 'cloud', provider: 'azure' }, state), true);
  assert.equal(showGroup({ kind: 'cluster', provider: 'aws' }, state), true);
  state.clouds = false;
  assert.equal(showGroup({ kind: 'datacenter', provider: 'onprem' }, state), false);
  assert.equal(showGroup({ kind: 'cluster' }, state), true);
});

test('同期・非同期の表示設定は、種類が未指定の接続を消さない', () => {
  const state = legendState({ sync: false });
  assert.equal(showLink(true, state), false);
  assert.equal(showLink(false, state), true);
  assert.equal(showLink(undefined, state), true);
  assert.deepEqual(legendState({ labels: false, hiddenProviders: ['aws', 'aws', null] }).hiddenProviders, ['aws']);
});

test('境界の種類と管理区分は独立して保持し、リセットで戻る', () => {
  const state = legendState({ management: false, hiddenKinds: ['vpc', 'vpc'] });
  assert.equal(state.management, false);
  assert.deepEqual(state.hiddenKinds, ['vpc']);
  assert.equal(showGroup({ kind: 'vpc' }, state), false);
  assert.equal(showGroup({ kind: 'cluster' }, state), true);
  assert.equal(showGroup({ kind: 'cloud', provider: 'aws' }, state), true);
  const reset = legendState();
  assert.equal(reset.management, true);
  assert.equal(showGroup({ kind: 'vpc' }, reset), true);
});
