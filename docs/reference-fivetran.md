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

## 6. 実装例：RDS PostgreSQL → Fivetran SaaS → Snowflake

Fivetran の SaaS 接続で Amazon RDS for PostgreSQL を初回同期し、利用条件を満たす環境で論理レプリケーションによる増分同期を行う例。ロード後に dbt 変換を実行する。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 基幹 DB | Amazon RDS for PostgreSQL の業務テーブル | 同期対象の注文テーブルと変更を提供する。 |
| 取り込み接続、履歴の初回同期、更新分の同期、同期の進捗位置 | Fivetran PostgreSQL 接続 | 初回同期と増分同期を担当し、接続単位の進捗を管理する。 |
| 分析用ウェアハウス、ロード後の SQL 変換 | Snowflake RAW テーブルと実行 Warehouse | 同期先を raw スキーマとし、変換 SQL はターゲット側で処理する。 |

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


### サービスごとの配置

RDS for PostgreSQL の論理レプリケーションを設定し、Fivetran SaaS の PostgreSQL 接続から変更を読み取る。Fivetran は Snowflake へのロード用 Warehouse と権限を使い、同期後の dbt 変換も Snowflake の Warehouse 上で実行する。Fivetran の処理実体を RDS や Snowflake のプロセスとして扱わない。

RDS の論理レプリケーション、publication、スロット、接続経路とソース権限を個別に構成し、同期の遅延時に WAL が保持される影響を監視する。Snowflake の接続ユーザー、ロール、Warehouse、ロード先の権限と Fivetran の dbt 変換設定は別途必要。

[Fivetran PostgreSQL setup guide](https://fivetran.com/docs/connectors/databases/postgresql/setup-guide)、[Fivetran Snowflake destination setup](https://fivetran.com/docs/destinations/snowflake/setup-guide)。

Fivetran が dbt の実行サービスをホストし、Git のプロジェクトから生成した SQL は Snowflake Warehouse で実行する。AWS は RDS 基盤を運用し、利用者が DB 設定・レプリケーション・権限を管理する。Fivetran の同期・dbt 実行基盤と Snowflake のサービス基盤は各提供元が運用し、利用者は接続・変換設定や Snowflake の Warehouse・データ・権限を管理する。内部ホストの直接操作は想定しない。接続方式と Git の提供元は未指定で、この構成は各公式資料を組み合わせた例であり実動作は未検証。
