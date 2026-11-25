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

## 8. 実装例：Pub/Sub → Dataflow（Beam）→ BigQuery

Apache Beam SDK で定義した注文のウィンドウ集計を Dataflow に投入する例。Pub/Sub から読み、BigQuery に出力するパイプラインを専用ワーカーサービスアカウントで実行する。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 注文イベントの入力 | Pub/Sub サブスクリプション | 注文トピックから Dataflow ジョブへ配信する。 |
| 処理グラフの定義、分散データの集合、キー付けと時間ウィンドウの集計 | Beam SDK の Pipeline・PCollection・Transform | イベント検証、イベント時刻のウィンドウ、キーごとの集計を処理グラフとして記述する。 |
| 処理グラフの実行調整、分散タスクの実行基盤 | Dataflow Runner と管理ワーカー | Beam グラフをストリーミングジョブとして分散実行する。 |
| 分析用テーブル | BigQuery の集計テーブル | BigQueryIO でスキーマに合わせて書き込む。 |
| ジョブの監視 | Dataflow Monitoring | ステージ指標とジョブの状態を確認する。 |

実装で加わる部品を以下に示す。

- ワーカーサービスアカウント。Pub/Sub の読み取り、対象 BigQuery への書き込み、実行に必要な権限を割り当てる。

開発端末で Java 向け Beam SDK のジョブを Dataflow Runner で送信する。依存 JAR のステージングと一時ファイルには Cloud Storage を使う。Dataflow が管理する Compute Engine ワーカーで `PubsubIO` の入力をウィンドウごとに集計し、`BigQueryIO` の Storage Write API で BigQuery のテーブルへ書く。ジョブのステージと処理状況は Dataflow の監視画面で確認する。

- [Dataflow のワーカーとステージング](https://docs.cloud.google.com/dataflow/docs/request-quotas)
- [Dataflow から BigQuery へのストリーミング書き込み](https://docs.cloud.google.com/dataflow/docs/guides/write-to-bigquery)

公式資料

- [Dataflow documentation](https://cloud.google.com/dataflow/docs/overview)
- [Use Apache Beam to build pipelines](https://cloud.google.com/dataflow/docs/guides/use-beam)
- [Dataflow monitoring interface](https://cloud.google.com/dataflow/docs/guides/using-monitoring-intf)
- [Dataflow product overview](https://cloud.google.com/products/dataflow)
- [Dataflow security and permissions](https://docs.cloud.google.com/dataflow/docs/concepts/security-and-permissions)
- [Beam Programming Guide](https://beam.apache.org/documentation/programming-guide/)

この例は Streaming Engine を使わない Java Beam ジョブを仮定し、利用者が指定した VPC・サブネットの Dataflow 管理 Compute Engine ワーカーで実行する。Google は Dataflow、Pub/Sub、BigQuery、Cloud Storage の基盤を運用し、利用者はジョブの投入・停止・監視、コード、ネットワーク、ワーカーサービスアカウント、テーブルと権限を設定する。個々の VM の手動管理を運用前提にせず、管理サービスの内部構成は図に追加しない。Streaming Engine を有効にする場合は処理基盤が異なる。バージョン、ネットワーク経路、ウィンドウと配信保証は未指定で、この構成は公式資料を組み合わせた未検証例である。

- [Dataflow Streaming Engine](https://docs.cloud.google.com/dataflow/docs/streaming-engine)
