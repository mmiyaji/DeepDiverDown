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

dbt platform が Semantic Layer のサービス基盤を提供し、利用者が指標定義、接続資格情報とアクセス権を設定する。データプラットフォームは別の提供元・実行場所となり、この例では未選定。資料を組み合わせた未検証の例である。

MetricFlow の定義・SQL 生成はローカルで利用できる。dbt が提供するサービス層と API はプラン条件が異なるため、最新の公式資料を確認する。

資料 [dbt Semantic Layer の構成](https://docs.getdbt.com/docs/use-dbt-semantic-layer/sl-architecture)、[MetricFlow](https://docs.getdbt.com/docs/build/about-metricflow)。


## 4. 実装例：dbt Semantic Layer と Amazon Redshift

dbt の SaaS 上で指標定義をデプロイし、GraphQL API から得た指標の問い合わせを Amazon Redshift で実行する。

| 機能 | 担い手 |
| --- | --- |
| 入力とモデルの保管 | S3 の受注原本を Redshift にロードし、dbt のデプロイジョブで本番モデルを作る。 |
| 指標の要求・定義 | BI アプリが dbt SaaS の GraphQL API に問い合わせる。指標定義は dbt の本番環境にデプロイする。 |
| 計画と実行 | SaaS 内の MetricFlow が SQL を生成し、Gateway が Redshift へ送る。 |

dbt platform と顧客 AWS アカウントは別の領域である。dbt と AWS は各サービスの基盤を運用し、利用者は指標定義、ジョブ、接続、Redshift データと権限を設定する。公開されない SaaS 内部の実行ホストは仮定しない。複数の公式資料を組み合わせた未検証の代表例で、対応バージョン、契約、資格情報とネットワークを導入時に検証する。

この例は SaaS の Semantic Layer を利用できる契約と本番環境を前提とする。Redshift で本番モデルを書き込む資格情報と、Semantic Layer でモデルを読み取る資格情報を分ける。プロジェクト用サービストークンを読み取り資格情報に割り当て、元データへのアクセスは Redshift のロールと権限で制限する。dbt SaaS が接続できるネットワークを構成し、プライベート接続の可否は契約とデプロイ方式に合わせて確認する。

公式資料

- [dbt Semantic Layer の構成](https://docs.getdbt.com/docs/use-dbt-semantic-layer/sl-architecture)
- [dbt Semantic Layer の対応 DB と資格情報](https://docs.getdbt.com/docs/use-dbt-semantic-layer/setup-sl)
- [dbt のデプロイジョブ](https://docs.getdbt.com/docs/deploy/deploy-jobs)
- [Redshift のデータ読み込み](https://docs.aws.amazon.com/redshift/latest/dg/t_Loading-data-from-S3.html)
