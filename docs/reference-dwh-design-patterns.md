# DWH 設計パターンの選び方

## 1. 同じ題材で比較する

注文・商品・顧客・返品を共通題材にする。層構成、企業内での統合方法、マートのデータモデル、問い合わせ時の物理化は組み合わせられる。初めに欲しい指標とファクトの粒度、履歴の要否を明示する。詳細図は各部品から開ける。

## 2. 整備・統合の選び方

| 目的 | パターン | 評価する点 |
|---|---|---|
| 原本を残して段階的に品質を上げる | [メダリオン](reference-medallion.md) | どの層から再処理できるか |
| 共通の企業データを統合してマートを派生 | [Inmon CIF](reference-dwh-inmon-cif.md) | 統合 EDW と用途別マートの責務 |
| 複数ソースのキーと履歴を残す | [Data Vault](reference-dwh-data-vault.md) | Hub・Link・Satellite と下流の業務ルール |
| 共通の分析軸で業務領域を増やす | [Kimball バス](reference-dwh-kimball-bus.md) | 共有ディメンションとドリルアクロス |

## 3. 分析モデルの選び方

| 目的 | パターン | 評価する点 |
|---|---|---|
| 1件の事実を説明属性で集計する | [スタースキーマ](reference-dwh-star-schema.md) | 粒度とファクト・ディメンションの関係 |
| 次元階層の管理を明示する | [スノーフレークスキーマ](reference-dwh-snowflake-schema.md) | 変更の管理場所と結合の深さ |
| 当時の属性に基づく集計を再現する | [SCD](reference-dwh-slowly-changing-dimensions.md) | Type 1／Type 2 と発生時点のキー |
| 業務イベント・日次状態・工程を記録する | [ファクトテーブルの型](reference-dwh-fact-table-types.md) | トランザクション・定期・累積 |
| 定型の帳票で結合を減らす | [ワイドテーブル](reference-dwh-wide-table.md) | 平坦化やネストを選んだ場合の粒度・行数 |

## 4. 配信と再計算

[集約テーブルとセマンティックレイヤー](reference-dwh-aggregate-tables.md)で、共通指標の定義と高速化のための物理集約を検討する。鮮度、重複、明細へのフォールバック、遅延時の再集計を一緒に確認する。

## 図で確認するシナリオ

- **受注の共通指標を BI に届ける** — 整備の層を決め、受注と返品で共通に使う日付・商品を整理する。 → ファクトの粒度と、当時の属性が必要な指標を決める。 → 利用頻度の高い指標を公開し、どの粒度まで事前集約で答えられるか確認する。
- **複数ソースの統合とマートを比較** — 同じ受注データを統合 EDW と履歴中心の Vault で扱う場合の違いを見る。 → 分析用マートに必要な業務ルールと粒度を整理する。 → 用途に合わせ、階層の分離や定型配信のワイドテーブルを検討する。

## 公式資料

- [Kimball Group の次元モデリング技法](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)
- [Databricks のメダリオン](https://docs.databricks.com/aws/en/lakehouse/medallion)
- [Bill Inmon の CIF と Data Warehousing 2.0](https://www.embarcadero.com/images/dm/technical-papers/bill-inmon-data-warehousing-2-0-whitepaper.pdf)
- [Data Vault Alliance](https://datavaultalliance.com/engineering/data-vault-2-0-an-introduction/)
- [BigQuery のネストと繰り返し列](https://docs.cloud.google.com/bigquery/docs/best-practices-performance-nested)
- [dbt Semantic Layer](https://docs.getdbt.com/docs/use-dbt-semantic-layer/sl-architecture)

## 5. 実装例 BigQuery の DWH 設計比較環境

合成の注文 CSV と明細を共通入力にし、試すパターンごとに別データセットへ SQL の成果物を作る比較環境。表の構成は比較候補で、すべてを一つの本番経路として使う想定ではない。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 注文・商品・顧客・返品 | BigQuery lab_input データセット | 比較に使う注文・商品・顧客・返品の表を登録する。 |
| メダリオン | lab_layers データセット | 原本、検証済み、業務集計のテーブルを段階別に分ける。 |
| Inmon CIF | lab_cif データセット | 統合した正規化表から営業と経理の公開ビューを作る。 |
| Data Vault | lab_vault データセット | Hub・Link・Satellite と業務派生・公開ビューを作る。 |
| Kimball バス・スタースキーマ | lab_dimensional のディメンション・ファクト | 注文と返品から共通ディメンションを再利用し、受注明細のスタースキーマも確認する。 |
| スノーフレーク | lab_hierarchy の商品とカテゴリ表 | スタースキーマに対し、カテゴリを分離した構成を比較する。 |
| SCD | lab_history の顧客履歴表 | 有効期間と代理キーにより時点で顧客属性を参照する。 |
| ファクトテーブルの型 | lab_grain のイベント・日次・進捗表 | 用途ごとに異なる事実の粒度を作って比較する。 |
| ワイドテーブル | lab_wide の平坦表・ネスト表 | 明細行と注文行の件数・重複集計を比較する。 |
| 事前集約と指標定義 | lab_rollup の日次集約と公開ビュー | 注文明細の結果に対し、日次集約を使う場合の結果を照合する。 |
| BI／業務レポート | 比較用の BigQuery SQL 結果 | 同じ入力範囲と集計指標の結果を記録する。 |

比較候補ごとに別データセットで用意し、同じ入力と注文日で事実の粒度や金額を確認する。個別の候補で出荷履歴や事前集約が必要ならその設計を追加する。この比較で使う BigQuery 固有の設定は、各パターンの論理構造と区別する。

Google Cloud プロジェクト内の同じロケーションに Cloud Storage のバケットと BigQuery データセットを作る。合成 CSV をロードジョブで `lab_input` のネイティブテーブルに取り込み、BigQuery の GoogleSQL ジョブで比較用の表、ビュー、照合結果を作る。繰り返し実行には BigQuery Data Transfer Service のスケジュールされたクエリを用い、共通入力を読み、比較用データセットに書き込めるサービスアカウントを指定する。比較結果は BigQuery Studio で確認する。

- [Cloud Storage から BigQuery に CSV をロード](https://docs.cloud.google.com/bigquery/docs/loading-data-cloud-storage-csv)
- [BigQuery でスケジュールされたクエリ](https://docs.cloud.google.com/bigquery/docs/scheduling-queries)

出典 [Kimball Group の次元モデリング技法](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)、[Databricks のメダリオン](https://docs.databricks.com/aws/en/lakehouse/medallion)、[Bill Inmon の CIF と Data Warehousing 2.0](https://www.embarcadero.com/images/dm/technical-papers/bill-inmon-data-warehousing-2-0-whitepaper.pdf)、[Data Vault Alliance](https://datavaultalliance.com/engineering/data-vault-2-0-an-introduction/)、[BigQuery のネストと繰り返し列](https://docs.cloud.google.com/bigquery/docs/best-practices-performance-nested)、[dbt Semantic Layer](https://docs.getdbt.com/docs/use-dbt-semantic-layer/sl-architecture)、[BigQuery データセットの作成](https://docs.cloud.google.com/bigquery/docs/datasets)、[BigQuery 論理ビュー](https://docs.cloud.google.com/bigquery/docs/views-intro)

BigQuery と Cloud Storage は Google が基盤を運用するマネージドサービスで、利用者はプロジェクト、データセット、SQL、スケジュール、サービスアカウントと IAM 権限を設定する。SQL ジョブの内部実行ノードを利用者が直接操作するものではない。各データセットは比較のための論理データで、個別の BigQuery サービスではない。公式資料を組み合わせた例であり、比較 SQL と結果の実動作は未検証。[BigQuery overview](https://docs.cloud.google.com/bigquery/docs/introduction)
