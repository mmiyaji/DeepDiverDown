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
変換はロード後に Destination 上で実行できる。同期失敗時は Destination に追加・更新を行わず、接続状態やエラーを確認して復旧する。整合性修復の再同期は通常の増分同期とは区別する。

出典 [Get Started with Fivetran](https://fivetran.com/docs/getting-started/quickstart)・[FAQ](https://fivetran.com/docs/getting-started/faq)・[Glossary](https://fivetran.com/docs/getting-started/glossary)

## 6. 実装例：Fivetran の PostgreSQL → Snowflake 同期

Fivetran のマネージド接続で PostgreSQL を初回同期し、利用条件を満たす環境で論理レプリケーションによる増分同期を行う例。ロード後に dbt 変換を実行する。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 基幹 DB | PostgreSQL の業務テーブル | 同期対象の注文テーブルと変更を提供する。 |
| 取り込み接続、履歴の初回同期、更新分の同期、同期の進捗位置 | Fivetran PostgreSQL 接続 | 初回同期と増分同期を担当し、接続単位の進捗を管理する。 |
| 分析用ウェアハウス、ロード後の SQL 変換 | Snowflake のロード先と変換結果 | 同期先を raw スキーマとし、変換 SQL はターゲット側で処理する。 |

実装で加わる部品を以下に示す。

- PostgreSQL の論理レプリケーション設定。同期テーブルを公開し、コネクターが対象の変更を受け取れるようにする。
- Git の dbt プロジェクト。同期後に変換を実行する場合のモデル定義を保持する。

公式資料

- [Get Started with Fivetran](https://fivetran.com/docs/getting-started/quickstart)
- [Sync Overview](https://fivetran.com/docs/core-concepts/syncoverview)
- [Fivetran Glossary](https://fivetran.com/docs/getting-started/glossary)
- [Supported Destinations](https://fivetran.com/docs/destinations)
- [Fivetran PostgreSQL Connector](https://fivetran.com/docs/connectors/databases/postgresql)
- [Fivetran Snowflake destination](https://fivetran.com/docs/destinations/snowflake)
- [Fivetran Transformations for dbt](https://fivetran.com/docs/transformations/dbt)
