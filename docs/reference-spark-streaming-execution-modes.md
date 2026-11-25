# Structured Streaming の実行モードと内部構造

## 1. 位置付け

Structured Streaming の DataFrame / Dataset クエリには、既定のマイクロバッチ、Spark 2.3 導入の実験的 Continuous Processing、Spark 4.1 導入の Real-Time Mode がある。Real-Time は Continuous Processing の改名ではない。ここでは Apache Spark 3.5.7 と 4.3.0 を基準とする。DStream ベースの Spark Streaming は別 API である。

## 2. マイクロバッチ

Driver は入力オフセットの範囲を決め、各バッチで短時間のタスクをスケジュールする。通常の shuffle は上流の出力を実体化してから下流が読み、状態あり演算は State Store を更新する。バッチの進捗と状態をチェックポイントに記録して再開する。エンジン内の状態の exactly-once と、外部 sink の配信保証は分けて考える。

## 3. Continuous Processing

`continuous` トリガーで長時間タスクが入力を連続処理し、進捗を定期的にチェックポイントする。選択・射影など map 系に限定され、集計など状態あり演算は使えない。障害時の保証は at-least-once。Spark 3.5.7 の公式ガイドでは実験的機能である。

## 4. Real-Time Mode のデータ経路

Spark 4.1 で導入された `realTime` トリガーは長時間タスクを用い、レコードを入力から出力へ連続的に流す。4.3 では集計、`dropDuplicates`、JVM の `transformWithState` が対応する。入力 Stage と状態あり Stage は同時に実行され、pipelined shuffle が両者をスケジュールし、streaming shuffle がレコードをネットワーク経由でキー別の下流に渡す。通常の shuffle ファイルを完成させるまで下流を待たせない。対応範囲は限定され、stream-stream join、PySpark の `transformWithState`、`foreachBatch` は 4.3 では未対応。

## 5. 状態と復旧

4.3 の状態あり Real-Time 処理では State Store と checkpoint format v2 を利用する。トリガーの時間は主に長時間バッチのチェックポイント間隔で、各レコードの出力間隔ではない。ウォーターマーク更新や入力のないパーティションのタイマーはバッチ境界まで待つ場合がある。失敗時は最後にコミットされたオフセットと状態から再実行する。エンジン内の状態への効果は exactly-once だが、既に書いた外部出力は再送され得る。Kafka sink は at-least-once なので、重複排除や冪等な書き込みが必要。状態ありクエリは同期的に進捗をコミットする。

## 6. 実行資源と制約

Real-Time のタスクは長時間スロットを保持する。状態ありクエリでは入力側と shuffle 後のタスクが同時に実行できる資源が必要である。4.3 の Apache Spark の対応ソースは Kafka、sink は Kafka、foreach、console、memory に限定される。AQE は非対応。RocksDB と checkpoint format v2 など互換条件を満たす場合、同一の互換チェックポイントを使ってマイクロバッチと Real-Time の間で再開できる。

## 7. 実装例：Spark 4.3 Standalone と Kafka

自前のサーバー群に Kafka クラスター、Spark Standalone クラスター、HDFS 互換の共有ファイルシステムを置く例である。入出力トピックは同じ Kafka クラスターに置く。共有ファイルシステムは Spark クラスターの外に置き、Driver と Executor からチェックポイントのパスにアクセスできるようにする。RocksDB State Store は Executor で動き、チェックポイントは共有ファイルシステムに保存する。

投入クライアントの `spark-submit` は、`cluster` モードで Standalone Master にアプリケーションを投入する。Master の割り当てに従って Worker が Driver と Executor を起動する。投入クライアントの設置場所は指定しない。図は公式資料を組み合わせた構成例で、実機での動作と具体的な可用性構成、認証設定、ホスト台数は未確認である。Kafka sink は重複し得るため、後続の消費側で対処する。

| 機能配置 | 実装例の部品 |
| --- | --- |
| 再読可能な入力 | Kafka 入力トピック |
| Driver・進捗管理 | Spark Driver |
| 短時間のタスクと通常 shuffle | Executor 入力タスク |
| Continuous の長時間タスク | Executor 入力タスク |
| Real-Time 入力 Stage | Executor 入力タスク |
| Pipelined / streaming shuffle | Executor 状態タスク |
| 状態あり Stage | Executor 状態タスク |
| State Store | RocksDB State Store |
| 進捗と状態のチェックポイント | 共有ファイルシステムの `checkpointLocation` |
| 外部出力 | Kafka 出力トピック |

出典：[Spark 3.5.7 Continuous Processing](https://spark.apache.org/docs/3.5.7/structured-streaming-programming-guide.html#continuous-processing)、[Spark 4.1 リリース](https://spark.apache.org/releases/spark-release-4.1.0.html)、[Spark 4.3 Real-Time Mode](https://spark.apache.org/docs/4.3.0/streaming/real-time-mode.html)、[Spark 4.3 リリース](https://spark.apache.org/releases/spark-release-4-3-0.html)、[Standalone Mode](https://spark.apache.org/docs/4.3.0/spark-standalone.html)、[クラスターモード](https://spark.apache.org/docs/4.3.0/cluster-overview.html)、[チェックポイント](https://spark.apache.org/docs/4.3.0/streaming/apis-on-dataframes-and-datasets.html#recovering-from-failures-with-checkpointing)、[Kafka コネクター](https://spark.apache.org/docs/4.3.0/streaming/structured-streaming-kafka-integration.html)。
