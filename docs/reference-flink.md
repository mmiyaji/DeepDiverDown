# Apache Flink の基本アーキテクチャ

## 1. 読み方と範囲

Kafka の受注イベントを Flink の並列ストリーム処理で読み、イベント時刻の窓集計を出力する。演算子と配置は説明用の構成である。

出典 [Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)・[Timely Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/)

## 2. Source とデータフロー

Source がイベントを読み、演算子間のデータフローへ渡す。Kafka のように位置を戻せるソースはチェックポイントからの再開に利用できる。

出典 [Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)

## 3. イベント時刻とウォーターマーク

イベントに含まれる時刻を基準に処理し、ウォーターマークがイベント時刻の進行を知らせる。遅れて届くイベントを扱うため、処理時刻とは区別する。

出典 [Timely Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/)

## 4. 状態付き窓演算子

キー付き演算子は集計状態を保持し、窓が閉じると結果を Sink へ送る。並列サブタスクはキーグループを分担する。

出典 [Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)

## 5. チェックポイント

チェックポイントは入力位置と各演算子の状態を一貫したスナップショットにする。失敗時は最新の成功チェックポイントからデータフローを再配置する。

出典 [Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)

## 6. 出力と復旧

Sink は集計結果を下流へ書く。復旧時は状態を復元し、ソースをチェックポイント位置へ戻して処理を続ける。実際の保証は Sink のコネクター設定にも依存する。

出典 [Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)

## 7. シナリオ

「イベント時刻の窓集計と復旧」シナリオをクリックすると、Source、ウォーターマーク、状態、Sink、チェックポイント復帰を追える。
