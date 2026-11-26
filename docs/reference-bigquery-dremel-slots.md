# BigQuery：クエリ実行とスロット

2026 年 11 月時点の公式資料に基づく。性能の数値は資料に載っていないため書かない。

## 1. 範囲
クエリジョブがステージに分解され、スロットで並列実行され、予約とスケジューラーでスロットが配分される流れを示す。ストレージの形式は [BigQuery：Capacitor とストレージの最適化](reference-bigquery-storage-optimization.md) で扱う。

## 2. ジョブとクエリ計画
クエリ計画はステージの一覧で、各ステージは READ・FILTER・AGGREGATE・JOIN などのステップを持つ。ステージの状態は PENDING・RUNNING・COMPLETE・FAILED・CANCELLED で示される。実行中に計画が修正されることがあり、その場合は REPARTITION・COALESCE ステージが加わる。

出典 [Query plan and timeline](https://docs.cloud.google.com/bigquery/docs/query-plan-explanation)

## 3. スロット
スロットは SQL クエリなどのジョブを実行する仮想的な計算単位である。利用者は 1 つのクエリが使うスロット数を直接指定できない。課金方式はオンデマンド（処理した TiB 単位。同時に使えるスロット数には上限がある）と、容量課金（予約）の 2 つである。

出典 [Understand slots](https://docs.cloud.google.com/bigquery/docs/slots)

## 4. 予約とオートスケール
予約のスロットは、常に確保され課金されるベースラインと、必要時に確保されるオートスケールからなる。オートスケールは 50 スロット単位で増減し、スケールダウンまで 1 分以上かかる。1 分の最小課金を外す「fluid scaling」は予約ごとの選択である。エディションは Standard・Enterprise・Enterprise Plus で、容量が競合したときは Enterprise Plus と Enterprise のベースライン、Enterprise Plus のオートスケール、Enterprise のオートスケール、Standard とオンデマンドの順に優先される。

出典 [Understand slots](https://docs.cloud.google.com/bigquery/docs/slots)

## 5. 公平なスケジューリング
スロットはまずプロジェクト間で均等に分け、次にプロジェクト内のジョブ間で分ける（結果的に公平になる方式）。予約間でアイドルのスロットを共有する公平性は Enterprise と Enterprise Plus のみが対象で、エディションをまたいだ共有はできない。管理プロジェクトの既定値は資料に日付つきで記載されており、導入時に公式ページで確認する。

出典 [Understand slots](https://docs.cloud.google.com/bigquery/docs/slots)

## 6. シャッフル
ステージ間の中間データは分散メモリのシャッフル層を介して渡される。ステージの出力量は shuffleOutputBytes、あふれた量は shuffleOutputBytesSpilled で確認できる。JOIN はブロードキャストとハッシュの 2 つの形がクエリ計画に現れる。

出典 [Query plan and timeline](https://docs.cloud.google.com/bigquery/docs/query-plan-explanation)

## 7. シナリオ
ジョブを受け付け、プロジェクトの割り当てから配分元を決める。ステージの作業単位にスロットを配分し、スロットが列を読んでシャッフルで中間データを渡し、最終ステージの結果を返す。

## 8. 実装例 BigQuery Enterprise 予約とオートスケール
| 機能 | 担い手 | 設定 |
|---|---|---|
| ジョブを送る利用者 | bq CLI の投入端末 | クエリジョブを送る |
| クエリ計画 | BigQuery ジョブとクエリ計画 | ステージを作る |
| 予約と割り当て | Enterprise edition の予約 | ベースラインとオートスケールの上限、プロジェクトへの割り当て |
| スロットの配分・スロット・シャッフル | BigQuery の実行基盤 | Google が運用する。ワーカーへの直接アクセスはない |
| 管理ストレージ | BigQuery の管理ストレージ | テーブルを保持する |

利用者が操作するのは予約、割り当て、ジョブ、IAM である。スロットのワーカーとシャッフル層は Google が運用し、利用者は直接操作できない。実行時間とコストは未検証で、公式資料を組み合わせた構成例である。

## 9. 未確認
- 実行エンジンの内部名（Dremel）と分散ツリー構造の詳細は、今回取得した資料に記述がなく未確認。
- スロット数ごとの実行時間、オートスケールの反応時間、シャッフルの容量上限は未確認。

## 10. 参考資料
- [Understand slots](https://docs.cloud.google.com/bigquery/docs/slots)
- [Query plan and timeline](https://docs.cloud.google.com/bigquery/docs/query-plan-explanation)
- [BigQuery のワークロード管理](https://docs.cloud.google.com/bigquery/docs/reservations-intro)
