# テーブル形式の違い

| 観点 | Apache Iceberg | Delta Lake | Apache Hudi | Apache Paimon |
| --- | --- | --- | --- | --- |
| 特徴 | **メタデータの木** でテーブルを表す | **_delta_log** のコミットで状態を決める | **タイムライン** でコミットを管理 | **LSM 型** で主キー更新と変更ログを扱う |
| 状態の持ち方 | メタデータが **スナップショット** を指す | JSON のコミットと **チェックポイント** | **instant**（requested・inflight・completed） | **スナップショット** とマニフェスト |
| 更新の仕方 | 更新ごとに **新しいスナップショット** を作る | **楽観的並行制御** で競合を検出 | **Copy-on-Write と Merge-on-Read** を選ぶ | 主キーの **upsert** をコンパクションで統合 |
| 読み書きするエンジン | Spark・Trino など **複数のエンジン** | **Spark** など | **Spark・Flink** など | **Flink** が中心 |
| 運用で要る作業 | **古いスナップショットの整理** | **OPTIMIZE と VACUUM** の実行 | Merge-on-Read は **コンパクション** | **コンパクション**（負荷は未確認） |

Iceberg REST Catalog は表形式ではなく、Iceberg のテーブルを SQL エンジンが共通の API で解決するためのカタログです。表形式が決めるのは表の中身の持ち方で、どのテーブルがどの場所にあるかは、カタログが担います。

## 選び方

- 複数のエンジンから同じテーブルを読み書きする → **Apache Iceberg**
- Spark でログを再生して表の状態を決め、MERGE やタイムトラベルを使う → **Delta Lake**
- キー単位の upsert・delete と CDC の取り込み、増分クエリを使う → **Apache Hudi**
- Flink で主キーを更新し、変更ログを下流へ流す → **Apache Paimon**

対応するエンジン、バージョンごとの機能、ロックと同時書き込みの扱いは、各プロジェクトの資料で確認します。

## 公式資料

- [Iceberg Spark Quickstart](https://iceberg.apache.org/spark-quickstart/)
- [Iceberg REST Catalog](https://iceberg.apache.org/docs/latest/rest-catalog/)
- [Delta Lake PROTOCOL](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)
- [Delta Lake Concurrency control](https://docs.delta.io/latest/concurrency-control.html)
- [Delta Lake Optimizations](https://docs.delta.io/latest/optimizations-oss.html)
- [Hudi Concepts](https://hudi.apache.org/docs/concepts/)
- [Hudi Compaction](https://hudi.apache.org/docs/compaction/)
- [Paimon Basic Concepts](https://paimon.apache.org/docs/2.1/concepts/basic-concepts/)
- [Paimon Primary Key Table](https://paimon.apache.org/docs/2.1/primary-key-table/)
