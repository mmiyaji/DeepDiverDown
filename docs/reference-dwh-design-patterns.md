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
