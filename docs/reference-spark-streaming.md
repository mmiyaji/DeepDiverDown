# Apache Spark Streaming（DStreams）の基本アーキテクチャ

## 1. 読み方と範囲

Kafka などから受け取ったイベントを StreamingContext が時間間隔ごとの RDD 列として処理し、集計結果を保存する旧 DStream API の例を示す。

出典 [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)

## 2. 入力 DStream

受信ストリームは DStream になり、内部では連続する RDD の系列として表現される。Kafka 連携などは別ライブラリを明示的に追加して使う。

出典 [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)

## 3. StreamingContext とバッチ間隔

StreamingContext がバッチ間隔を定め、各間隔で生成された RDD に変換を適用する。`start` 後はストリーミング計算が継続し、`awaitTermination` などで待機する。

出典 [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)

## 4. 変換と集計

map や reduceByKey などの変換で各 RDD を処理し、状態を持つ変換では過去のバッチの結果を更新する。これは Structured Streaming のテーブルモデルとは異なる。

出典 [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)

## 5. 出力

`foreachRDD` などの出力操作で各バッチを外部システムへ保存する。出力の重複や冪等性はアプリケーションと保存先の設計に依存する。

出典 [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)

## 6. チェックポイントと復旧

信頼できるファイルシステムにチェックポイントディレクトリを設定すると、状態や進捗を保存できる。ドライバー障害時はチェックポイントから StreamingContext を再生成する。

出典 [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)

## 7. シナリオ

「DStream のバッチ処理と復旧」シナリオをクリックすると、入力 RDD、変換、出力、チェックポイント再開を追える。

## 8. 実装例：DStreams のファイル入力と HDFS

既存の DStreams アプリが新しいファイルを監視し、区間ごとに RDD を処理する例。メタデータや必要な RDD 状態のチェックポイントには HDFS を使う。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| Input Stream | HDFS 入力ディレクトリー | 新しいファイルを監視するファイル入力を使う。 |
| ストリーミング処理の調整役、区間ごとのデータ集合 | Driver 内の StreamingContext と DStream | 処理間隔と変換グラフを持ち、バッチごとの RDD 処理を起動する。 |
| 分散バッチの実行担当 | Spark Executor JVM | 分散 RDD の変換を実行する。 |
| Batch Output、復旧用の状態保存先 | HDFS 内の出力とチェックポイント | 結果とメタデータ・状態は別ディレクトリーに書く。 |

実装で加わる部品を以下に示す。

- バッチ間隔の設定。アプリケーションで処理間隔を決め、入力到着速度と変換処理時間を照合する。

公式資料

- [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)
