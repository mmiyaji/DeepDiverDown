import assert from 'node:assert/strict';
import test from 'node:test';
import { productOf, shortName } from '../js/products.js';

test('モデル ID から製品を判定する', () => {
  assert.equal(productOf('spark-aqe-join-skew'), 'Apache Spark');
  assert.equal(productOf('apache-iceberg'), 'Apache Iceberg');
  assert.equal(productOf('cortex-data-agent'), 'Snowflake');
  assert.equal(productOf('sparkle'), null);
  assert.equal(productOf('dwh-star-schema'), null);
});

test('製品の下では図の名前から製品名を省く', () => {
  assert.equal(shortName('Apache Spark の基本アーキテクチャ', 'Apache Spark'), '基本アーキテクチャ');
  assert.equal(shortName('Spark SQL：AQE と Join', 'Apache Spark'), 'SQL：AQE と Join');
  assert.equal(shortName('Snowflake：読み取り', 'Snowflake'), '読み取り');
  // 製品名のあとに助詞が続くものは文として残す
  assert.equal(shortName('Spark と Celeborn：リモートシャッフル', 'Apache Spark'), 'Spark と Celeborn：リモートシャッフル');
});

test('表にない製品は図の名前から製品名を取り、概念・パターンは製品にしない', async () => {
  const { productName, isConcept } = await import('../js/products.js');
  assert.equal(productName({ id: 'trino', name: 'Trino の分散クエリアーキテクチャ' }), 'Trino');
  assert.equal(productName({ id: 'keda-event-autoscaling', name: 'KEDA：イベント駆動の自動スケーリング' }), 'KEDA');
  assert.equal(productName({ id: 'spark-ui', name: 'Spark UI：実行計画' }), 'Apache Spark');
  assert.equal(isConcept({ id: 'compaction', name: '小ファイルの整理', tags: ['概念'] }), true);
  assert.equal(isConcept({ id: 'dwh-star-schema', name: 'DWH', tags: [] }), true);
  assert.equal(isConcept({ id: 'trino', name: 'Trino', tags: ['OSS'] }), false);
});
