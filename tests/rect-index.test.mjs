import test from 'node:test';
import assert from 'node:assert/strict';
import { RectIndex } from '../js/rect-index.js';

test('矩形索引は全件比較と同じ重なりを検出する', () => {
  let seed = 173;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rect = () => { const x = random() * 1200 - 600, y = random() * 900 - 450; return { left:x, top:y, right:x + random() * 200, bottom:y + random() * 150 }; };
  const rects = Array.from({length: 250}, rect), index = new RectIndex();
  rects.forEach(r => index.add(r));
  for (let i = 0; i < 1000; i++) {
    const q = rect(), gap = i % 5;
    const expected = rects.some(r => r.left < q.right + gap && r.right + gap > q.left && r.top < q.bottom + gap && r.bottom + gap > q.top);
    assert.equal(index.overlaps(q, gap), expected);
  }
});
