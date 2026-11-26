# Amazon Redshift：Spectrum と Iceberg レイクハウス

## 1. 範囲
Redshift から S3 のデータレイクを読む経路（外部スキーマ、Glue Data Catalog、Spectrum）、Iceberg 表の扱い、zero-ETL による運用 DB の取り込みを扱う。2026 年 11 月時点の公式資料に基づく。

## 2. Spectrum と外部スキーマ
Redshift Spectrum は、データを Redshift の表にロードせずに S3 上のファイルを問い合わせる。処理の多くは Spectrum 層で行われ、データは S3 に残る。複数のクラスターが同じデータを複製せずに同時に問い合わせられる。外部スキーマは Data Catalog のデータベースと IAM ロールを指定して作り、Lake Formation の権限と組み合わせられる。

出典 [Amazon Redshift Spectrum](https://docs.aws.amazon.com/redshift/latest/dg/c-using-spectrum.html)

## 3. Iceberg 表
Glue Data Catalog に登録した Iceberg 表（v1・v2・v3）を問い合わせられる。RA3 は Spectrum を使い、RG インスタンスと Redshift Serverless は自身のコンピュートで処理する（追加の Spectrum 料金なし）。Athena や EMR など ACID 対応のエンジンが更新する表を、Redshift が同時に読める。Redshift は Iceberg メタデータの統計を使ってファイルの読み取りを減らす。Glue での列統計の生成が性能に推奨される。新しいパーティションは自動検出される。ローカル表への取り込みは INSERT INTO または CREATE TABLE AS で行い、COPY は使えない。Lake Formation のきめ細かい制御、マテリアライズドビュー、時刻指定の読み取り（AS OF TIMESTAMP）に対応する。資料には Iceberg 表への書き込みの項（トランザクション、フェデレーテッド ID の制約）もあるが、提供段階は確認していない（未確認）。SageMaker Lakehouse 経由の接続も、今回取得した資料では確認していない（未確認）。

出典 [Using Apache Iceberg tables with Amazon Redshift](https://docs.aws.amazon.com/redshift/latest/dg/querying-iceberg.html)

## 4. zero-ETL
zero-ETL 統合は、ソースから Redshift のクラスターまたは Serverless ワークグループへ、初回ロードの後に変更を複製する。資料が現在のサポートとして挙げるソースは、Aurora MySQL・PostgreSQL、DynamoDB、RDS for MySQL・Oracle・PostgreSQL、Oracle Database@AWS、Salesforce・SAP・ServiceNow などのアプリケーション、自己管理の MySQL・PostgreSQL・SQL Server・Oracle。ソースごとの Preview・GA の区別は、取得した資料に書かれておらず未確認。

出典 [Zero-ETL integrations](https://docs.aws.amazon.com/redshift/latest/mgmt/zero-etl-using.html)

## 5. 実装例 RA3 クラスターから Iceberg 表を参照し、Aurora を zero-ETL で取り込む

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| コンピュート | RA3 クラスター | ローカル表と外部表の結合 |
| 外部スキーマ | CREATE EXTERNAL SCHEMA | Data Catalog のデータベースと IAM ロール |
| カタログ・権限 | Glue Data Catalog、Lake Formation | 表の定義と権限 |
| データレイクのスキャン | Redshift Spectrum | RA3 の場合 |
| Iceberg 表 | S3 のメタデータとデータファイル | Athena が更新 |
| 運用 DB の取り込み | Aurora と zero-ETL 統合 | 宛先データベース |

公式資料を組み合わせた代表構成であり、実在の導入事例や動作検証済みの構成ではない。性能と料金は未検証。

出典 [Amazon Redshift Spectrum](https://docs.aws.amazon.com/redshift/latest/dg/c-using-spectrum.html)、[Using Apache Iceberg tables with Amazon Redshift](https://docs.aws.amazon.com/redshift/latest/dg/querying-iceberg.html)、[Zero-ETL integrations](https://docs.aws.amazon.com/redshift/latest/mgmt/zero-etl-using.html)
