import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { overviewScale } from '../js/diagram-layout.js';

test('全体表示は必要な幅と高さの両方を領域に収める', () => {
  for (const [vw, vh, cw, ch] of [[900, 600, 1500, 700], [800, 400, 600, 1500]]) {
    const scale = overviewScale(vw, vh, cw, ch);
    assert.ok(scale < 1 && cw * scale <= vw && ch * scale <= vh);
  }
});

test('余裕があれば文字を縮めず、測定不能な領域では変更しない', () => {
  assert.equal(overviewScale(900, 600, 500, 300), 1);
  assert.equal(overviewScale(0, 600, 500, 300), 1);
});
