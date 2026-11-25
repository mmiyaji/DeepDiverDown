# Databricks：RocksDB 状態とチェックポイント

## 1. 対象と前提

状態付き Structured Streaming の RocksDB、差分チェックポイント、障害復旧を追う。 公式資料を組み合わせた説明用のモデルで、実機の配置や導入事例ではない。

## 2. 構成と役割

- **再読できる入力**：入力イベントと処理位置を取得する。
- **バッチの進行管理**：マイクロバッチの入力範囲と完了状況を管理する。
- **状態付き演算**：キー別の集計などを行い、状態ストアを読み書きする。
- **ローカル状態ストア**：RocksDB がネイティブメモリとローカルディスクを利用してキー別状態を管理する。
- **状態の差分**：changelog checkpointing では各バッチの変更を永続ストレージに記録する。
- **状態のスナップショット**：復旧を速めるためのスナップショットをバックグラウンドで保存する。
- **オフセットと完了記録**：入力位置、コミット、クエリと状態のメタデータをチェックポイントに保持する。
- **結果の出力**：結果を出力先に保存する。処理保証は出力先の対応に依存する。
- **障害からの再開**：チェックポイントから進捗と状態を復元し、必要な入力を再処理する。

## 3. 処理の流れ

1. 入力範囲の各イベントで RocksDB のキー別状態を更新する。
2. 差分と進捗を保存し、結果を出力する。snapshot はバックグラウンドで作られる。
3. 障害後に保存済みの状態と進捗を復元し、必要な入力を再処理する。

RocksDB はネイティブメモリとローカルディスクを利用し、変更を changelog として耐久ストレージに記録する。背景スナップショットは復旧時の再生量を抑える。通常の差分 checkpointing と、次バッチの処理を保存と重ねる asynchronous state checkpointing は別設定である。Databricks Runtime 17.3 LTS 以降の既定値や、再起動時に同じ checkpoint を再利用できる変更の制約に注意する。

## 4. 留意点

changelog checkpointing と非同期 state checkpointing は別の機能。後者は次のバッチと保存処理を重ねられるが、障害時に複数バッチの再実行が必要になる場合がある。exactly-once はソース・シンクと利用方法を含む条件に依存する。DBR のバージョンごとに既定値が異なる。

## 5. 実装例

Databricks のコントロールプレーンで、Lakeflow Jobs が継続実行に設定したジョブの起動と再試行を管理する。ジョブは顧客 AWS アカウントのクラシックジョブコンピュートで動く。Databricks Runtime のドライバーとワーカーはクラスタの EC2 ノードで動き、RocksDB はワーカーのローカルメモリとディスクを使う。

この構成例では、クラスタと同じ顧客 AWS アカウント内の S3 にクエリ専用のチェックポイントと Delta 出力テーブルを置く。AWS は S3 の基盤を運用する。利用者はバケットの設定、データ、アクセス権限を管理する。

利用者はジョブ定義で実行環境とトリガーを設定し、Kafka への接続と認証を用意する。ジョブの再実行では、Structured Streaming が同じチェックポイントを読み込み、Kafka の必要なオフセットから再処理する。Kafka は外部入力として示す。提供元と設置場所は未特定で、再処理に必要なレコードがトピックに残っていることを前提とする。

| 機能 | 担い手 |
| --- | --- |
| 再読できる入力 | 外部 Kafka トピック |
| バッチの進行管理 | クラシックジョブコンピュート上の Spark ドライバー |
| 状態付き演算 | ワーカー上の Spark エグゼキューター |
| ローカル状態ストア | ワーカーローカルの RocksDB state store |
| 状態の差分 | S3 チェックポイント内の changelog |
| 状態のスナップショット | S3 チェックポイント内の RocksDB snapshot |
| オフセットと完了記録 | S3 チェックポイント内のオフセットログとコミットログ |
| 結果の出力 | S3 上の Delta 出力テーブル |
| 障害からの再開 | Lakeflow Jobs による再試行と Structured Streaming による進捗・状態の復元 |

## 公式資料

- [状態付きパイプラインの性能改善](https://www.databricks.com/blog/deep-dive-latest-performance-improvements-stateful-pipelines-apache-spark-structured-streaming)
- [RocksDB state store の設定](https://docs.databricks.com/aws/en/structured-streaming/rocksdb-state-store)
- [Structured Streaming のチェックポイント](https://docs.databricks.com/aws/en/structured-streaming/checkpoints)
- [非同期 state checkpointing](https://docs.databricks.com/aws/en/structured-streaming/async-checkpointing)
- [Databricks コンピュート](https://docs.databricks.com/aws/en/compute/)
- [Databricks on AWS のアーキテクチャ](https://docs.databricks.com/aws/en/getting-started/high-level-architecture)
- [クラシックコンピュートの設定](https://docs.databricks.com/aws/en/compute/configure)
- [本番向け Structured Streaming のジョブ設定](https://docs.databricks.com/aws/en/structured-streaming/production)
- [Lakeflow Jobs の継続実行](https://docs.databricks.com/aws/en/jobs/continuous)
- [Apache Kafka への接続](https://docs.databricks.com/aws/en/connect/streaming/kafka)
- [Spark Structured Streaming の Kafka コネクター](https://spark.apache.org/docs/latest/streaming/structured-streaming-kafka-integration.html)
- [Delta テーブルのストリーミング書き込み](https://docs.databricks.com/aws/en/structured-streaming/delta-lake)
- [Amazon S3 の責任共有モデル](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security.html)
