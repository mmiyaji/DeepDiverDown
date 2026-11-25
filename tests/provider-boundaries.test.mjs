import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAnalyze, loadModels } from '../tools/load.mjs';
import { providerBoundaryIssues } from '../tools/audit-provider-boundaries.mjs';

// 整理の型（reference.product）に合わせたリファレンスは、実装例の稼働環境の枠をそろえる
test('製品として整理したリファレンスの実装例は稼働環境の枠に入る', () => {
  const A = loadAnalyze();
  for (const { id, model, reference } of loadModels()) {
    if (!reference?.product) continue;
    assert.deepEqual(providerBoundaryIssues(model, A.Catalog), [], id);
  }
});
