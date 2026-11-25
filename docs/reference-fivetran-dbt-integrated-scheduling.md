# Fivetran：ロード後の dbt と連動スケジュール

## 1. 取り込みと変換の入力

取り込み接続が同期先の RAW テーブルを更新する。dbt モデルはそのテーブルを参照し、SQL による変換を同期後に実行する。例では注文テーブルを読み、分析用の注文マートを作る。[Transformations for dbt](https://fivetran.com/docs/transformations/dbt)

## 2. Git のプロジェクトとジョブ

dbt プロジェクトは Git に置く。Fivetran はプロジェクトを取り込み、設定したジョブの dbt コマンドを実行する。GitHub.com を使う例では、Fivetran の公開鍵を対象リポジトリの読み取り専用 Deploy key として登録する。Git の鍵はモデル定義を取得するために使い、Snowflake への認証は Destination の設定で扱う。[Fivetran の設定ガイド](https://fivetran.com/docs/transformations/dbt/setup-guide) [GitHub の Deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)

## 3. Integrated scheduling

同じ Destination に属する接続や変換を上流として関連付ける。関連する同期が成功した後に dbt ジョブを実行する。上流の同期が失敗したときは、その下流の連動変換は実行しない。同じパイプラインでは同期と変換を順に実行するため、長時間の変換は次の同期を待たせることがある。[Transformation Scheduling](https://fivetran.com/docs/transformations/transformation-scheduling) [Transformations for dbt](https://fivetran.com/docs/transformations/dbt)

## 4. SQL の実行場所

Fivetran が dbt CLI を実行する。生成された SQL は Snowflake Warehouse で実行され、RAW テーブルを読み、設定したスキーマにモデルの出力を作る。GitHub.com は dbt の定義を保管する。図では、ジョブの実行環境に SQL 処理や注文データの保存を割り当てない。[Transformations for dbt](https://fivetran.com/docs/transformations/dbt) [Snowflake Destination Setup Guide](https://fivetran.com/docs/destinations/snowflake/setup-guide)

## 5. 実装例：RDS の注文データを Snowflake で変換

| 機能 | 担い手 |
| --- | --- |
| 取り込み元 | Amazon RDS for PostgreSQL の注文テーブル |
| 取り込み接続と実行順 | Fivetran の PostgreSQL 接続と Integrated scheduling |
| プロジェクトの保存 | GitHub.com の対象リポジトリ |
| dbt コマンドの実行 | Fivetran のホスト型 dbt ジョブ |
| SQL の実行と結果の保存 | Snowflake Warehouse、RAW テーブル、注文マート |

RDS は TLS と Fivetran 用ユーザーで接続する。Snowflake にはキーペアで認証する専用サービスユーザーを作る。変換には Warehouse の利用、入力スキーマの読み取り、出力スキーマのオブジェクト作成に必要な権限を与える。GitHub.com では対象リポジトリの Deploy key を扱う。

AWS は RDS の基盤を、Fivetran は接続処理と dbt の実行基盤を、GitHub はホスト型リポジトリを、Snowflake は Warehouse とストレージのサービス基盤を運用する。利用者はコード・接続設定・対象データ・スキーマ・権限を管理する。図は公式資料を組み合わせた例である。選定リージョン、ジョブや Warehouse のサイズ、実動作は未確認である。

- [PostgreSQL Connector Setup Guide](https://fivetran.com/docs/connectors/databases/postgresql/setup-guide)
- [Transformations for dbt Setup Guide](https://fivetran.com/docs/transformations/dbt/setup-guide)
- [Transformation Scheduling](https://fivetran.com/docs/transformations/transformation-scheduling)
- [Snowflake Destination Setup Guide](https://fivetran.com/docs/destinations/snowflake/setup-guide)
