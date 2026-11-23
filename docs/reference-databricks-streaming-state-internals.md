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

Kafka 等の再読可能な入力を AWS 上の Databricks クラシック Jobs compute が処理し、RocksDB の状態差分と進捗を顧客 S3 の各クエリ専用チェックポイントに保存し、S3 上の Delta テーブルに出力する概念例。クラスター、バケットと権限は事前に用意する。個々の環境の権限、再処理の保証は公式ガイドで確認する。

| 機能 | 担い手 |
| --- | --- |
| 再読できる入力 | Kafka などの入力 |
| バッチの進行管理 | Structured Streaming のクエリ |
| 状態付き演算 | Databricks Runtime のタスク |
| ローカル状態ストア | RocksDB state store |
| 状態の差分 | 状態の changelog |
| 状態のスナップショット | RocksDB snapshot |
| オフセットと完了記録 | チェックポイントログ |
| 結果の出力 | Delta 出力テーブル |
| 障害からの再開 | クエリの再起動 |

## 公式資料

- [状態付きパイプラインの性能改善](https://www.databricks.com/blog/deep-dive-latest-performance-improvements-stateful-pipelines-apache-spark-structured-streaming)
- [RocksDB state store の設定](https://docs.databricks.com/aws/en/structured-streaming/rocksdb-state-store)
- [Structured Streaming のチェックポイント](https://docs.databricks.com/aws/en/structured-streaming/checkpoints)
- [非同期 state checkpointing](https://docs.databricks.com/aws/en/structured-streaming/async-checkpointing)
- [Databricks コンピュート](https://docs.databricks.com/aws/en/compute/)
- [Unity Catalog 管理ストレージ](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)
