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
