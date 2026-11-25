# Fivetran の基本アーキテクチャ

## 1. Source・Connection・Destination
Fivetran では Source を接続し、Destination を選び、Connection を保存してデータパイプラインを作る。図では基幹 DB の受注テーブルを Connector が読み、クラウドデータウェアハウスへロードする。

出典 [Get Started with Fivetran](https://fivetran.com/docs/getting-started/quickstart)

## 2. Initial sync
最初の履歴同期は Initial sync と呼ばれ、選択したテーブルの履歴を抽出・処理し、Destination へロードする。Source と Destination を Save & Test した後に開始する。

出典 [Get Started with Fivetran](https://fivetran.com/docs/getting-started/quickstart)・[Sync Overview](https://fivetran.com/docs/core-concepts/syncoverview)

## 3. Incremental sync と cursor
Initial sync が成功した後は Incremental sync になり、追加・変更データだけを定期的に抽出・処理・ロードする。同期の進捗を cursor で記録し、増分取得できないテーブルは再インポートになることがある。

出典 [Sync Overview](https://fivetran.com/docs/core-concepts/syncoverview)・[Glossary](https://fivetran.com/docs/getting-started/glossary)

## 4. Destination へのロード
Connector は処理したデータを Destination にロードする。Destination はクラウドデータウェアハウス、データベース、オンラインデータプラットフォームなどを選べる。

出典 [Get Started with Fivetran](https://fivetran.com/docs/getting-started/quickstart)・[Supported Destinations](https://fivetran.com/docs/destinations)

## 5. 変換と失敗時の扱い
変換はロード後に Destination 上で実行できる。同期失敗時は接続状態と同期履歴、Destination に反映済みの範囲を確認して復旧する。初回同期では抽出中にも段階的にロードされるため、失敗時に Destination が未変更とは仮定しない。整合性修復の再同期は通常の増分同期とは区別する。

出典 [Get Started with Fivetran](https://fivetran.com/docs/getting-started/quickstart)・[FAQ](https://fivetran.com/docs/getting-started/faq)・[Glossary](https://fivetran.com/docs/getting-started/glossary)

## 6. 実装例：RDS for PostgreSQL から Snowflake へ

Amazon RDS for PostgreSQL の注文テーブルを Fivetran SaaS で Snowflake に同期する。初回は既存行を読み、増分は publication と `pgoutput` の論理レプリケーションスロットを使う。同期後は、GitHub.com の dbt プロジェクトを使って Snowflake に注文マートを作る。

| 機能 | 担い手 |
| --- | --- |
| 基幹 DB と変更の取得元 | Amazon RDS for PostgreSQL の注文テーブルと WAL |
| 取り込み接続、初回・増分同期、進捗 | Fivetran SaaS の PostgreSQL 接続 |
| 同期データ | Snowflake の RAW テーブル |
| dbt のモデル定義 | GitHub.com のリポジトリ |
| dbt ジョブの起動とコマンド実行 | Fivetran のホスト型 dbt ジョブ |
| SQL の実行と変換結果 | Snowflake Warehouse と注文マート |

AWS アカウントに RDS と論理レプリケーション設定を置く。利用者は `rds.logical_replication` を有効にし、同期ユーザー、選択テーブルの読み取り権限、`rds_replication`、publication とスロットを設定する。この例では RDS に直接接続する。TLS を有効にし、Fivetran の送信元に接続を許可する。同期が長く止まった場合はスロットによる WAL 保持を監視する。[PostgreSQL Connector Setup Guide](https://fivetran.com/docs/connectors/databases/postgresql/setup-guide) [Amazon RDS の論理レプリケーション](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.FeatureSupport.LogicalReplication.html)

Fivetran の SaaS 上で接続と dbt ジョブが動く。Snowflake アカウントには RAW テーブル、Warehouse、注文マート、接続用の専用ユーザーとロールを置く。Snowflake に公開鍵、Fivetran に対応する秘密鍵を設定する。利用者はロード先と変換先の権限、Warehouse を管理する。[Snowflake Destination Setup Guide](https://fivetran.com/docs/destinations/snowflake/setup-guide) [Transformations for dbt](https://fivetran.com/docs/transformations/dbt)

dbt プロジェクトは GitHub.com の対象リポジトリに置く。Fivetran は読み取り専用 Deploy key を使い、SSH で取得する。利用者がリポジトリへのアクセスとコードを管理し、GitHub がサービス基盤を運用する。注文データを GitHub へ送る経路はこの例に含めない。[Transformations for dbt Setup Guide](https://fivetran.com/docs/transformations/dbt/setup-guide) [GitHub の Deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)

AWS、Fivetran、Snowflake はそれぞれのサービス基盤を運用する。Fivetran と Snowflake の内部ホスト、各サービスの選定リージョン、実動作は未確認である。図は公式資料を組み合わせた例である。

Fivetran と GitHub の公式サービスアイコンは未確認のため、図では汎用記号を使う。
