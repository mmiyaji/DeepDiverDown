# ストリーム処理の違い

| 観点 | Kafka Streams | Apache Flink | Spark Structured Streaming | RisingWave |
| --- | --- | --- | --- | --- |
| 特徴 | アプリに **組み込むライブラリ** | **状態付き処理** に特化したエンジン | **バッチと同じ API** で書ける | **SQL のマテリアライズドビュー** が自動で更新 |
| 処理の単位 | 入力パーティションごとの **Task** | Operator をつないだ Task を **スロット上の Subtask** で並列実行 | 一定間隔の **マイクロバッチ** | Fragment を並列の **Actor** が実行 |
| 状態の持ち方 | Task ごとの **ローカル状態ストア**（RocksDB など） | **HashMap か RocksDB**。チェックポイントは別の保存先 | Executor の **状態ストア**（RocksDB を選べる） | **Hummock**（LSM）でオブジェクトストレージに保存 |
| 時刻の扱い | stream time と **grace period** | **Watermark** がウィンドウの終端を越えたら確定 | **Watermark** で遅れたデータの待ち時間を決める | `WATERMARK FOR` と **一時フィルター** |
| 障害からの再開 | **changelog Topic を再生** して状態を戻す | **チェックポイント** から状態と Source の位置を戻す | **チェックポイントの offset** から再実行 | 既定 1 秒ごとの **Barrier** で作った checkpoint から再開 |
| 動かし方 | アプリの JVM を **複数起動** して分担 | Standalone・**Kubernetes**・Managed Service for Apache Flink | Spark アプリとして **投入**（EMR・Kubernetes など） | **Kubernetes Operator**・Docker・RisingWave Cloud |

Kafka 本体は処理エンジンではなく、上の 4 つが読み書きする **分散ログ** です。Apicurio Registry は、Kafka に流すメッセージの **スキーマと互換性を管理する台帳** で、処理はしません。

## 選び方

- 既存の Java アプリに、Kafka のデータの集計を足したい → **Kafka Streams**
- 大きな状態を持ち、イベント時刻で正確にウィンドウを切りたい → **Flink**
- 同じ処理をバッチでも動かしたい、Spark の基盤がすでにある → **Spark Structured Streaming**
- SQL だけで、常に最新の集計表を持ちたい → **RisingWave**
- Producer と Consumer の間でスキーマの変更を壊さずに進めたい → **Apicurio Registry**

## 公式資料

- [Kafka Streams Architecture](https://kafka.apache.org/44/streams/architecture/)
- [Flink Architecture](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/flink-architecture/)
- [Structured Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming/index.html)
- [RisingWave Architecture](https://docs.risingwave.com/get-started/architecture)
- [Apicurio Registry](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-intro-to-the-registry.html)
