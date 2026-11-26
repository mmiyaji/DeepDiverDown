# Unity Catalog OSS の統一カタログと外部エンジン接続

## 1. 管理対象とメタデータ

Unity Catalog OSS は、カタログ、スキーマ、テーブル、ボリューム、関数、モデルを 1 つのサーバーで管理するオープンなカタログ。LF AI & Data のプロジェクト。メタデータは DB に保存し、PostgreSQL を使う手順が公式資料にある。サーバー 1 台につきメタストアは 1 つ。

[Unity Catalog OSS Docs](https://unitycatalog.io/docs/)

## 2. REST API

公式資料は、Unity Catalog REST API（カタログ・テーブル・ボリュームなど）、Unity Control API（ユーザーとトークン）、UC Delta API、Iceberg REST Catalog API を挙げる。Iceberg REST クライアントから接続する手順がある。書き込みの対応範囲は未確認。

[Unity Catalog OSS Docs](https://unitycatalog.io/docs/)

## 3. エンジンからの接続

Spark はコネクタ `io.unitycatalog.spark.UCSingleCatalog` で UC のカタログを Spark のカタログとして登録する。URI と認証方式（`static` のトークンまたは `oauth`）を設定する。Spark 連携のページが挙げる形式は Delta。DuckDB、Python、pandas、Polars、Java クライアントも連携先に挙がる。

[Unity Catalog Spark 連携](https://unitycatalog.io/docs/integrations/unity-catalog-spark/)

## 4. 認証と権限

ユーザーはメールアドレスで識別し、SCIM 2.0 で登録する。外部 IdP のトークンを `/auth/tokens` で UC のトークンと交換する。認可は `server.authorization=enable` で有効になり、無効なら全リクエストを許可する。オブジェクトには所有者がいて、他の主体には `SELECT`、`MODIFY`、`READ VOLUME` などを個別に付与する。親の `USE CATALOG`・`USE SCHEMA` も必要で、`OWNER` 以外の権限は下位に継承される。グループとサービスプリンシパルはない。

[Unity Catalog OSS 認証・認可](https://unitycatalog.io/docs/server/auth/)

## 5. 一時認証情報

Spark コネクタはテーブルの読み書き時に、サーバーへ短期のストレージ認証情報を要求する。更新（`renewCredential.enabled`）は既定で有効。カタログはストレージへの直接アクセスを仲介しない。統制するには、利用者に直接のストレージ権限を与えず、サーバー発行の認証情報だけを使わせる。

[Unity Catalog Spark 連携](https://unitycatalog.io/docs/integrations/unity-catalog-spark/)、[Unity Catalog OSS 認証・認可](https://unitycatalog.io/docs/server/auth/)

## 6. シナリオの見方

「Spark でテーブルを読む」は、権限付与から、認可、場所の解決、認証情報の取得、ストレージの直接読み取りまでを追う。「Iceberg REST クライアントで接続する」は、テーブル解決の経路だけを示す。例の名前は説明用。

## 7. 実装例：自前サーバーと AWS S3

自前のサーバーで UC サーバー、Spark、PostgreSQL を動かし、S3 のファイルを一時認証情報で読む構成例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| 管理者 | `bin/uc` CLI | ユーザーと権限を管理する。 |
| エンジン | Spark と UC コネクタ | URI とトークンを設定する。 |
| 認証・REST API・認可・オブジェクト・認証情報発行 | UC サーバー | 自前のサーバーで運用する。 |
| メタデータ DB | PostgreSQL | 自前で運用する。 |
| ストレージ | Amazon S3 | ファイルを置く。 |
| 実装で追加 | AWS STS | S3 用の短期認証情報の発行元。 |

STS を発行元とする点は想定で、公式資料では確認していない。設定の詳細と実動作は未検証。

## 前提と未確認

- 2026 年 11 月時点の資料に基づく。コネクタの版は Spark 4.1 向けに `0.7.0` が例示されている。サーバー本体の最新版は未確認。
- Iceberg REST のエンドポイント、書き込み範囲、認証情報の発行に対応するクラウドの範囲は、該当ページを取得できず未確認。
- Databricks 版との機能差は未確認。OSS 側にはグループ、サービスプリンシパル、`ALL PRIVILEGES`、`MANAGE`、`BROWSE` がないと公式資料にある。
