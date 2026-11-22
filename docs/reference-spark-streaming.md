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
