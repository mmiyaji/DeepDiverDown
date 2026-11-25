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

test('整理済み２分類は実装例の稼働環境を 2D・3D の両方に記載する', () => {
  for (const { id, model, reference } of loadModels()) {
    if (!['バッチ・SQL エンジン', 'ストリーム処理'].includes(reference?.category)) continue;
    for (const impl of model.implementations || []) {
      for (const dimension of ['layout2d', 'layout3d']) {
        assert.ok(impl[dimension]?.groups?.some(g => ['cloud', 'datacenter'].includes(g.kind)), `${id}/${impl.id}: ${dimension}`);
      }
    }
  }
});
