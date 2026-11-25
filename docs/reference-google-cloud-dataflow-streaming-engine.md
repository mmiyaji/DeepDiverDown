# Google Cloud Dataflow：Streaming Engine とオートスケーリング

## 1. 対象

ストリーミングジョブで、パイプライン実行の一部をワーカー VM から Dataflow サービス側へ移す Streaming Engine と、ワーカー数を増減するオートスケーリングを扱う。バッチジョブ向けの Dataflow Shuffle との違いにも触れる。

## 2. Streaming Engine

Streaming Engine なしでは、ランナーがすべてのパイプラインステップをワーカー VM 上で実行し、VM の CPU、メモリ、Persistent Disk を使う。Streaming Engine を使うと、パイプライン実行がワーカー VM から Dataflow サービスのバックエンドへ移る。ワーカーの CPU、メモリ、Persistent Disk の使用量が減り、vCPU 数の少ないマシンタイプと小さなブートディスクで足りる。サービスの更新はパイプラインの再デプロイなしで適用される。

サービス側へ移る処理の内訳（状態、タイマー、シャッフル）は、取得した公式ページに個別の記述がなく未確認である。

出典 [Dataflow Streaming Engine](https://docs.cloud.google.com/dataflow/docs/streaming-engine)

## 3. 有効化と制約

Python 3 の SDK 2.21.0 以降（CMEK なし、ワーカーがジョブと同じリージョン）と Go の SDK 2.33.0 以降では、新しいストリーミングパイプラインで既定で有効になる。Java は起動時のパラメーターで有効にする。動作中のパイプラインは更新できず、drain して設定し直して再実行する。オープンなウィンドウの入力データは、バッファ済み要素とカスタム状態を含めて 1 キーあたり 60 GB までで、超えるとパイプラインが停止状態になり、システム遅延が大きくなる。ワーカーのゾーンは `--zone` で指定できず、`--region` を指定する。

出典 [Dataflow Streaming Engine](https://docs.cloud.google.com/dataflow/docs/streaming-engine)

## 4. 水平オートスケーリング

ストリーミングジョブでは、ワーカーの CPU 使用率とパイプラインの並列度をもとにワーカー数を増減する。カスタムの無界ソースは、Java の `getSplitBacklogBytes()` または `getTotalBacklogBytes()` でバックログを報告できる。Streaming Engine を使うジョブでは水平オートスケーリングが既定で有効になり、遅延ティアでバックログのしきい値を設定できる。Streaming Engine を使わないストリーミングジョブでは、アルゴリズムを `THROUGHPUT_BASED` にして最大ワーカー数を設定する。Streaming Engine では、より細かい単位でワーカー数を変えられる。

出典 [Dataflow Horizontal Autoscaling](https://docs.cloud.google.com/dataflow/docs/horizontal-autoscaling)・[Dataflow Streaming Engine](https://docs.cloud.google.com/dataflow/docs/streaming-engine)

## 5. Dataflow Shuffle との違い

バッチジョブのオートスケーリングは既定で有効で、ステージごとの仕事量を見積もり、30 秒ごとに再評価する。Dataflow Shuffle を使わないパイプラインでは、ワーカーがシャッフルしたデータをローカルディスクに持つため、縮小がうまくいかないことがある。つまり、バッチのシャッフルのサービス側への移行が Dataflow Shuffle、ストリーミング処理の移行が Streaming Engine という対応で読める。ただし Dataflow Shuffle の内部と適用範囲を説明するページは取得しておらず、詳細は未確認である。

出典 [Dataflow Horizontal Autoscaling](https://docs.cloud.google.com/dataflow/docs/horizontal-autoscaling)

## 6. シナリオ

ワーカー VM が入力を読み、Streaming Engine と分担して処理して出力先へ書く。オートスケーラーが CPU 使用率やバックログなどの指標からワーカー数を変える。Dataflow Shuffle はバッチジョブ向けで、図には描かない。

## 7. 実装例：Streaming Engine を有効にした Java ストリーミングジョブ（Google Cloud）

Pub/Sub から読む Java の Beam ストリーミングジョブを、Streaming Engine を有効にして Dataflow へ投入する。Dataflow が管理する Compute Engine ワーカーが処理し、BigQuery に書く。ジョブの投入と最適化は [ジョブの最適化とワーカー](reference-google-cloud-dataflow-job-optimization.md) を参照する。

| 機能 | 担い手 |
| --- | --- |
| ストリームの入力 | Pub/Sub サブスクリプション |
| ワーカー VM | Dataflow 管理の Compute Engine VM |
| Streaming Engine | Dataflow サービスのバックエンド |
| オートスケーラー | Dataflow の水平オートスケーリング |
| 出力先 | BigQuery のテーブル |
| ジョブの監視 | Dataflow のジョブ監視画面 |

Google は Dataflow、Streaming Engine のバックエンド、Pub/Sub、BigQuery の基盤を運用し、利用者はジョブの投入、Streaming Engine の有効化、最大ワーカー数、ネットワーク、サービスアカウント、テーブルと権限を設定する。Streaming Engine とオートスケーラーの内部構成は公開資料で確認できないため図に描かない。Dataflow Shuffle はバッチ向けのため、この図と実装例には部品を置かない。

## 8. 未確認

Streaming Engine が移す処理の内訳、Pub/Sub 入力でのバックログの扱い、Dataflow Shuffle の内部は未確認である。この構成は公式資料を組み合わせた代表例で、実環境の動作は未検証である。

## 公式資料

- [Dataflow Streaming Engine](https://docs.cloud.google.com/dataflow/docs/streaming-engine)
- [Dataflow Horizontal Autoscaling](https://docs.cloud.google.com/dataflow/docs/horizontal-autoscaling)
- [Dataflow documentation](https://cloud.google.com/dataflow/docs/overview)
- [Dataflow monitoring interface](https://cloud.google.com/dataflow/docs/guides/using-monitoring-intf)
