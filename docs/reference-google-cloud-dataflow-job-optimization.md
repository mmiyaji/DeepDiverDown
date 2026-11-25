# Google Cloud Dataflow：ジョブの最適化とワーカー

## 1. 対象

Apache Beam パイプラインが Dataflow ジョブになり、最適化されてワーカーで実行されるまでを扱う。バッチとストリーミングに共通する流れである。

## 2. 実行グラフの構築

Beam はパイプラインの起動コードを手元で実行し、ソース・シンク・変換の呼び出しを実行グラフのノードにする。`DoFn` の中のコードはワーカーで実行する。構築時に Cloud Storage のバケット、BigQuery のテーブル、Pub/Sub のトピックやサブスクリプションの存在とアクセス可否を確認する。

出典 [Dataflow pipeline lifecycle](https://docs.cloud.google.com/dataflow/docs/pipeline-lifecycle)

## 3. 投入と検証

グラフは JSON に変換して Dataflow サービスへ送る。サービスが検証するとジョブになり、投入元にジョブ ID が返る。ジョブ ID は監視に使う。

出典 [Dataflow pipeline lifecycle](https://docs.cloud.google.com/dataflow/docs/pipeline-lifecycle)

## 4. グラフの最適化

サービスはグラフを変更することがある。主な変更はステップの融合で、融合した範囲では中間の PCollection を実体化しない。データ依存を保てば、ステップの実行順は指定と変わることがある。`GroupByKey` などの集計の前には、局所的な部分結合を行う。有界データでは可能な限り結合し、無界データでは遅延を優先して部分結合を省くことがある。

出典 [Dataflow pipeline lifecycle](https://docs.cloud.google.com/dataflow/docs/pipeline-lifecycle)

## 5. ワーカーでの実行

サービスは処理を複数のワーカーとスレッドに分けて実行する。並列化はワーカー数（水平）と、各 VM の CPU コア・スレッド（垂直）の両方で行う。ステージを割り当てる内部の仕組みは公開資料で確認できていないため、図では「処理を割り当て」の接続にとどめる。

出典 [Dataflow pipeline lifecycle](https://docs.cloud.google.com/dataflow/docs/pipeline-lifecycle)・[Dataflow documentation](https://cloud.google.com/dataflow/docs/overview)

## 6. シナリオ

手元で実行グラフを作って依存ファイルを置き、JSON でサービスへ送る。サービスがジョブとして検証・最適化し、融合したステージをワーカーが実行する。結果をシンクへ書き、ジョブ ID で状態を確認する。

## 7. 実装例：Java Beam ジョブを Dataflow へ投入（Google Cloud）

開発端末の Java Beam SDK で実行グラフを作り、Dataflow Runner で投入する。依存ファイルのステージングと一時領域には Cloud Storage を使う。Dataflow サービスが検証・最適化し、Dataflow が管理する Compute Engine ワーカーが処理して BigQuery に書く。

| 機能 | 担い手 |
| --- | --- |
| パイプラインのコード、実行グラフ | 開発端末の Java Beam SDK |
| 依存ファイルの置き場 | Cloud Storage |
| 検証済みジョブ、グラフの最適化、融合後のステージ | Dataflow サービス |
| ワーカー | Dataflow 管理の Compute Engine VM |
| 出力先 | BigQuery のテーブル |
| ジョブの監視 | Dataflow のジョブ監視画面 |

Google は Dataflow と各サービスの基盤を運用し、利用者はジョブの投入・停止・監視、コード、ネットワーク、ワーカーのサービスアカウント、テーブルと権限を設定する。管理サービスの内部構成は図に追加しない。Cloud Storage へのステージングは [ワーカーとステージングの資料](https://docs.cloud.google.com/dataflow/docs/request-quotas) による。ライフサイクルの資料にはステージングとワーカー VM の管理の記述がない。

## 8. 未確認

どのステップが融合されるかはグラフの形に依存し、個別の例では未確認である。ステージの割り当ての内部、ワーカー VM の起動順序、実環境での動作は未検証である。この構成は公式資料を組み合わせた代表例である。

## 公式資料

- [Dataflow pipeline lifecycle](https://docs.cloud.google.com/dataflow/docs/pipeline-lifecycle)
- [Dataflow documentation](https://cloud.google.com/dataflow/docs/overview)
- [Dataflow のワーカーとステージング](https://docs.cloud.google.com/dataflow/docs/request-quotas)
- [Dataflow monitoring interface](https://cloud.google.com/dataflow/docs/guides/using-monitoring-intf)
