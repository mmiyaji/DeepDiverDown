# DWH の集約テーブルとセマンティックレイヤー

## 1. 対象の明細と集約

明細の粒度は1注文明細。日次集約の粒度は注文日・カテゴリ・通貨ごとで、明細から繰り返し読む画面を想定する。明細を保持して、集約の範囲外でも計算できるようにする。

## 2. 指標の定義と経路

同じ意味・通貨の売上は合計しやすい。平均単価を再集計する場合は売上合計と数量合計から求める。カテゴリ別のユニーク購入者数を足して全体を求めると、カテゴリをまたいだ購入者が重複する。対応できない指標やディメンションでは明細側の経路を選ぶ。図の経路選択は教材としての設計例。

## 3. 鮮度と再集計

当日と過去分を区別し、遅延到着した明細を受け付ける期間と、影響した日・カテゴリ・通貨の集約を再生成する方法を定義する。売上レポートに最終更新時刻を表示し、明細との突き合わせを行う。

## 図で確認するシナリオ

- **日次売上と購入者数で経路を選ぶ** — 日別・カテゴリ別の売上は集約表から返す。 → 全カテゴリの購入者数は明細からユニークな顧客を数える。
- **遅延注文で該当日を再集計** — 注文発生日より後に明細が到着する。 → 影響した日・カテゴリ・通貨の集約を再生成する。 → 再計算後の売上と更新時刻を公開する。

## 公式資料

- [Kimball Group の集約ファクトと加法性](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)
- [dbt Semantic Layer の構成](https://docs.getdbt.com/docs/use-dbt-semantic-layer/sl-architecture)

## 4. 実装例 BigQuery の日次集約と再計算

日付パーティションを持つ明細と集約表を BigQuery に置き、影響日だけをスケジュール SQL で再計算する例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 遅延した注文イベント | 補正対象日の記録 | 遅く到着した明細から再計算日を記録する。 |
| 受注明細ファクト | sales.fact_order_line | 注文日をパーティション列にした明細表。 |
| 増分集計・再生成 | BigQuery のスケジュール SQL | 対象日のファクトを再集計し、影響日の集約行だけを置き換える。 |
| 日・カテゴリ・通貨の集約 | sales.daily_category_currency | 注文日・カテゴリ・通貨の粒度に数量と金額を保存する。 |
| 指標定義と経路選択 | 集約用と明細用の SQL ビュー | ロールアップ可否でデータ源を選び、購入者数は明細から重複排除する。 |
| BI／日次レポート | 日次売上と購入者レポート | 登録済みの指標と元データの基準時刻を確認する。 |

日次・カテゴリ・通貨の集約表は加算できる指標に使う。ユニーク購入者数はカテゴリごとの部分集約を足さず、明細から計算する。スケジュールの時刻と対象となる注文日は別に扱う。

注文イベントの補正 CSV は Cloud Storage から BigQuery のロードジョブで `landing.order_corrections` に投入する。バケットとデータセットは同じロケーションに置く。明細補正の GoogleSQL ジョブは、`sales.fact_order_line` の更新と影響する注文日の記録を同じトランザクションで行う。その後、BigQuery Data Transfer Service のスケジュールされたクエリが、コミット済みの対象日だけを読み直す。

集約ジョブは対象日の行を置き換え、対象の注文日、明細の基準時刻、完了時刻を更新履歴に記録する。明細更新用と集約用のジョブには、それぞれ必要なテーブル権限を付与する。分析者は BigQuery Studio から公開ビューを問い、運用者はジョブ履歴と更新履歴を照合する。

- [Cloud Storage からの CSV ロード](https://docs.cloud.google.com/bigquery/docs/loading-data-cloud-storage-csv)
- [BigQuery のスケジュールされたクエリ](https://docs.cloud.google.com/bigquery/docs/scheduling-queries)
- [BigQuery の複数ステートメント トランザクション](https://docs.cloud.google.com/bigquery/docs/transactions)
- [BigQuery の JOBS ビュー](https://docs.cloud.google.com/bigquery/docs/information-schema-jobs)

出典 [Kimball Group の集約ファクトと加法性](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)、[dbt Semantic Layer の構成](https://docs.getdbt.com/docs/use-dbt-semantic-layer/sl-architecture)、[BigQuery パーティション表](https://docs.cloud.google.com/bigquery/docs/creating-partitioned-tables)、[BigQuery スケジュールされたクエリ](https://docs.cloud.google.com/bigquery/docs/scheduling-queries)、[BigQuery 論理ビュー](https://docs.cloud.google.com/bigquery/docs/views-intro)

この構成は公式機能を組み合わせた例で、実環境での SQL、ジョブの順序制御、権限、重複排除、障害復旧は未検証。Google が BigQuery と Cloud Storage のサービス基盤を運用し、利用者はデータ、SQL、スケジュール、サービスアカウントと IAM 権限を設定する。内部の実行サーバーは利用者が直接操作する対象として描いていない。ジョブ間の完了順序はスケジュールだけで保証されないため、前段の成功確認や再実行方針を別途設計する。バケットとデータセットのロケーションの互換性を確認する。
