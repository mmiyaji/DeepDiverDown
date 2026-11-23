# Iceberg REST Catalog の基本アーキテクチャ

## 1. クライアントとカタログ API

SQL エンジンは REST Catalog の共通 API で namespace やテーブルを操作する。クライアントごとに異なるカタログ実装へ直接結合せず、HTTP API の契約を利用する。出典 [REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)

## 2. テーブル解決

エンジンがテーブルを要求すると、Catalog Server はテーブル識別子を解決し、メタデータの場所や必要な設定を返す。これにより複数言語・複数エンジンから同じカタログへ接続できる。出典 [REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)

## 3. ストレージ上のメタデータとデータ

エンジンはカタログから得たメタデータの場所を使い、オブジェクトストレージの Iceberg メタデータ、Manifest、データファイルを読む。Catalog API はデータそのものを中継するものではない。出典 [REST Catalog](https://iceberg.apache.org/docs/latest/rest-catalog/)

## 4. Change-based commit

REST Catalog は変更ベースのコミットを使い、サーバー側で競合解消やリトライを扱える。ルートメタデータの更新をカタログサービスが管理することで、クライアント間の互換性と信頼性を高める。出典 [REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)

## 5. セキュリティと拡張

仕様は credential vending や remote signing による安全なテーブル共有、lazy snapshot loading や multi-table commit などの拡張を想定する。採用する機能や認証方式はサーバー実装に依存する。出典 [REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)

## 6. シナリオの見方

「エンジンが注文テーブルを読む」では、エンジンが REST Catalog へ問い合わせ、返されたメタデータ位置からストレージを読む。更新時は change-based commit をカタログへ送る。`catalog-read-commit` のリンクを順番に選択すると流れを追える。

## 7. 実装例：Trino・Polaris・RustFS

Polaris の公式 Trino ガイドに沿って、Trino Iceberg コネクタから REST API と S3 互換ストレージへ接続する例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| SQL エンジン | Trino Iceberg コネクタ | SQL 読み書きを Iceberg Catalog 操作に変換する。 |
| REST Catalog API・Catalog Server・Change-based Commit | Polaris Server（Iceberg REST） | テーブル解決、REST 操作、コミット要求を処理する。 |
| Iceberg Metadata | RustFS 上の Iceberg メタデータ | スナップショット情報を含むテーブルメタデータを置く。 |
| Manifest / Data Files | RustFS の Manifest・データファイル | 同じストレージ上のテーブルファイル。 |
| カタログの状態 | Polaris のインメモリ metastore | コンテナのプロセス内で保持する試行用の構成。 |
| 実装で追加 | polaris.properties | REST URI とストレージエンドポイントを持つ。 |

`catalog/polaris.properties` で `iceberg.catalog.type=rest` を選び、Polaris REST URI と RustFS の S3 エンドポイントを設定する。管理 API を使う初期設定と Trino の REST 接続は別の役割。

カタログ状態をサーバー再起動後も保持する構成では、Polaris の永続 metastore に PostgreSQL を設定できる。[Apache Polaris — Configuring Polaris for Production](https://polaris.apache.org/releases/1.8.0/configuration/configuring-polaris-for-production/)

[Apache Iceberg REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)、[Getting Started with Apache Polaris and Trino](https://polaris.apache.org/guides/trino/)、[Trino Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)

公式 Trino ガイドの Compose はローカルホストで Polaris、Trino、RustFS と設定用コンテナを起動する。メモリー上の metastore は再起動時に状態が失われる検証用の設定である。RustFS の個別アイコンはカタログ未登録のため汎用記号で示す。

## 8. 実装例：AWS の EMR on EC2・Glue Iceberg REST・S3

EMR 7.5.0 以降でサポートされる Iceberg REST 接続を使い、同一アカウントの Glue Data Catalog に S3 上の Iceberg v2 テーブルを登録する例。Spark ジョブを EMR の EC2/YARN 上で実行し、`SparkCatalog` の接続方式に `rest` を指定する。接続先はリージョン固有の Glue の `/iceberg` エンドポイントで、カタログ ID と SigV4 の署名名 `glue` を設定する。

| 機能配置 | AWS での担い手 |
|---|---|
| SQL エンジンと REST クライアント | Amazon EMR の Spark と Iceberg Runtime |
| REST API・名前解決・コミット | AWS Glue Data Catalog の Iceberg REST エンドポイント |
| テーブル定義・Manifest・データファイル | Amazon S3 の Iceberg テーブルプレフィックス |

Glue は `LoadTable` に表のメタデータと位置を返し、Spark が Manifest と対象データを S3 から読む。書き込みでは Spark がデータファイルを S3 に置き、更新事項と事前条件を `UpdateTable` で Glue に送る。Spark が使う IAM 権限と、テーブルのアクセス方式に応じた S3 の権限を設定する。

- [Amazon EMR Release Guide — Use AWS Glue Data Catalog with Spark](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-spark-glue.html)
- [Amazon EMR Release Guide — Use an Iceberg cluster with Spark](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-iceberg-use-spark-cluster.html)
- [AWS Glue — Connecting using the Iceberg REST endpoint](https://docs.aws.amazon.com/glue/latest/dg/connect-glu-iceberg-rest.html)
- [Apache Iceberg REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)

AWS は EMR、EC2、Glue、S3 の基盤を運用し、利用者はクラスタ、ゲスト OS、ジョブ、カタログの内容、データと権限を管理する。Glue の REST API は利用者が IAM 認証の上で操作できるが、内部基盤を直接操作するものではない。公式資料を組み合わせた構成で、実動作は未検証。[AWS 共有責任](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
