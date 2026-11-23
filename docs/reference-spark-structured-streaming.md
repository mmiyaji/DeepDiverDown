# Apache Spark Structured Streaming の基本アーキテクチャ

## 1. 読み方と範囲

Kafka の受注イベントを Structured Streaming が処理し、時間窓の集計を外部ストレージへ出力する例を示す。入力・出力先とクラスタ構成は説明用で、具体的な設定値を表さない。

出典 [Structured Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming/index.html)

## 2. ストリーム入力

Kafka Source はイベントを読み、DataFrame/Dataset としてクエリに渡す。Structured Streaming はストリームを無限のテーブルとして扱う。

出典 [Structured Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming/index.html)

## 3. マイクロバッチと窓集計

トリガーごとに新しい入力範囲を処理するマイクロバッチの例で、イベント時刻の窓に対して集計する。遅延データの扱いと古い状態の削除はウォーターマークで制御する。

出典 [Structured Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming/getting-started.html)

## 4. 実行と状態

Driver がクエリを調整し、Executor が入力パーティションを並列処理する。窓集計の中間状態はクエリの進行に伴って更新される。

出典 [Cluster Mode Overview](https://spark.apache.org/docs/latest/cluster-overview.html)・[Structured Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming/getting-started.html)

## 5. 出力

Sink は集計結果をファイルやテーブルなどへ書く。出力モード（append、update、complete）はクエリと sink の要件に合わせて選ぶ。

出典 [Structured Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming/index.html)

## 6. 障害からの再開

チェックポイントと write-ahead log により、処理済み範囲を追跡する。障害後はチェックポイントからクエリを再開し、必要な入力を再処理する。

出典 [Structured Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming/getting-started.html)

## 7. シナリオ

「Kafka から窓集計・再開」シナリオをクリックすると、入力、処理、出力、障害復旧の順に追える。

## 8. 実装例：Structured Streaming・Kafka・Parquet

Kafka の注文イベントを窓で集計し、確定した集計行を Parquet に保存するマイクロバッチの例。出力先とクエリ固有のチェックポイント先は別パスにする。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| ストリーム入力 | Kafka orders トピック | Spark Kafka ソースが分割ごとの読み取り位置を管理する。 |
| クエリの調整プロセス | Spark Driver のストリーミングクエリ | クエリのトリガーごとにマイクロバッチを起動する。 |
| 分散タスクの実行担当、時間窓ごとの状態 | Executor JVM の窓集計と State Store | ウィンドウとキーに対応する状態をタスクで更新する。 |
| 集計結果の出力先 | 共有ファイルシステムの Parquet 出力 | ウォーターマークで確定した窓結果を Append モードで保存する。 |
| 進捗と状態の復旧領域 | クエリ固有の checkpointLocation | クエリ進捗と状態ストアの復旧に必要なデータを保持する。 |

実装で加わる部品を以下に示す。

- Spark SQL 用 Kafka コネクター。Spark と Scala に合う Kafka コネクターをアプリケーションに組み込む。

公式資料

- [Structured Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming/index.html)
- [Structured Streaming Getting Started](https://spark.apache.org/docs/latest/streaming/getting-started.html)
- [Structured Streaming + Kafka Integration Guide](https://spark.apache.org/docs/latest/streaming/structured-streaming-kafka-integration.html)
