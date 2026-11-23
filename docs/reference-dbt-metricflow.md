# dbt MetricFlow とセマンティック層

## 1. 対象

売上指標の定義、期間別の問い合わせ、SQL の生成と分析基盤での実行を追う。

## 2. 指標の問い合わせ

指標・次元・エンティティの定義を用い、MetricFlow が要求に対応する SQL と結合経路を組み立てる。生成した SQL を分析エンジンで実行し、結果を呼び出し側に返す。指標の粒度、日付の意味、結合の妥当性を確認する。

## 3. 実装例：dbt Semantic Layer

| 機能 | 実装例 |
|---|---|
| 利用と問い合わせ | BI・分析アプリ、Semantic Layer API |
| 指標の定義と SQL 生成 | dbt のセマンティックモデルと指標、MetricFlow |
| SQL の実行 | dbt Gateway、接続先データプラットフォーム |
| アクセス | 利用者・接続の認可設定 |

MetricFlow の定義・SQL 生成はローカルで利用できる。dbt が提供するサービス層と API はプラン条件が異なるため、最新の公式資料を確認する。

資料 [dbt Semantic Layer の構成](https://docs.getdbt.com/docs/use-dbt-semantic-layer/sl-architecture)、[MetricFlow](https://docs.getdbt.com/docs/build/about-metricflow)。
