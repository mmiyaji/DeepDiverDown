# Google Cloud Dataflow のパイプラインアーキテクチャ

## 1. 範囲
Google Cloud Dataflow で Apache Beam パイプラインを実行し、注文イベントを入力から変換・集計して BigQuery に出力する流れを示す。Dataflow はバッチとストリーミングの両方を扱うマネージド実行サービスである。

出典 [Dataflow documentation](https://cloud.google.com/dataflow/docs/overview)

## 2. Beam パイプライン
利用者は Apache Beam SDK で Pipeline を作り、PCollection を入力・中間・出力データの論理的な集合として扱う。ParDo などの変換をつないで処理グラフを定義し、Dataflow Runner に実行を委ねる。

出典 [Use Apache Beam to build pipelines](https://cloud.google.com/dataflow/docs/guides/use-beam)・[Beam programming guide](https://beam.apache.org/documentation/programming-guide/)

## 3. 入力と変換
例では Pub/Sub から注文イベントを読み、Beam の変換で検証・キー付け・ウィンドウ集計を行う。入力コネクターや変換の詳細はパイプラインのコードと選択した I/O に依存する。

出典 [Dataflow documentation](https://cloud.google.com/dataflow/docs/overview)

## 4. Dataflow Runner とワーカー
Dataflow Runner は Beam グラフを Dataflow ジョブとして実行する。サービスはパイプラインを分散実行するワーカーを管理し、バッチまたはストリーミングの処理要件に応じて実行環境を提供する。

出典 [Dataflow documentation](https://cloud.google.com/dataflow/docs/overview)

## 5. 出力と監視
集計済み PCollection は BigQuery などのシンクへ書き込める。Dataflow の監視画面と Cloud Monitoring でジョブの状態、パイプライン段階の指標、ボトルネックを確認する。

出典 [Dataflow monitoring interface](https://cloud.google.com/dataflow/docs/guides/using-monitoring-intf)・[Dataflow product overview](https://cloud.google.com/products/dataflow)

## 6. シナリオ
図では、Pub/Sub の注文イベントを Beam Pipeline が読み、PCollection と変換を通じて集計し、Dataflow Runner がワーカーへ分散実行する。結果は BigQuery に保存し、ジョブを監視する。

出典 [Dataflow documentation](https://cloud.google.com/dataflow/docs/overview)

## 7. 参考資料
- [Dataflow documentation](https://cloud.google.com/dataflow/docs/overview)
- [Use Apache Beam to build pipelines](https://cloud.google.com/dataflow/docs/guides/use-beam)
- [Dataflow monitoring interface](https://cloud.google.com/dataflow/docs/guides/using-monitoring-intf)
- [Dataflow product overview](https://cloud.google.com/products/dataflow)
