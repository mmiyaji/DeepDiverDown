# Fivetran：初回同期と PostgreSQL の WAL

## 1. 初回同期

接続の設定とテスト後に、選択したテーブルの履歴を取り込む。Destination へのロードは抽出と並行して進むことがあるため、失敗時は同期先への反映を確かめる。ここでは主キーを持つ注文テーブルを使う。[Sync Overview](https://fivetran.com/docs/core-concepts/syncoverview)

## 2. WAL からの増分同期

PostgreSQL の論理レプリケーションは WAL を論理デコードし、Fivetran は `pgoutput` プラグインで変更を読む。Publication は対象テーブルを決める。論理レプリケーションスロットは、消費側が読み残した変更に必要な WAL をソースが保持するために使う。RDS のスロットを放置すると WAL が蓄積し、空き容量を消費する。[PostgreSQL Connector](https://fivetran.com/docs/connectors/databases/postgresql) [Amazon RDS の論理レプリケーション](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.FeatureSupport.LogicalReplication.html)

## 3. 次の同期と削除

Fivetran は cursor を使い、次の同期の読み始めを決める。PostgreSQL の論理スロットは WAL の保持に関わる。Fivetran の cursor とスロットの位置の具体的な対応は未確認である。同期先で主キーを使って挿入・更新を反映し、論理レプリケーションで捉えた削除は通常の同期モードでは `_fivetran_deleted = TRUE` で示す。[Fivetran Glossary](https://fivetran.com/docs/getting-started/glossary#cursor) [PostgreSQL Connector](https://fivetran.com/docs/connectors/databases/postgresql)

## 4. 失敗時に確認する箇所

Fivetran 側は同期履歴とエラーを調べる。RDS 側はスロットと WAL 保持量、Snowflake 側は同期先の反映済み行を確認する。増分同期と再同期は別の操作である。例えば PostgreSQL で列を既定値付きで追加しても、論理レプリケーションが既存行の変更として扱わない場合は、そのテーブルの再同期が必要になる。cursor の保管先、コミット順序、再試行境界、実運用の監視しきい値は未確認である。[PostgreSQL Connector](https://fivetran.com/docs/connectors/databases/postgresql) [Amazon RDS の論理レプリケーション](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.FeatureSupport.LogicalReplication.html)

## 5. 実装例：RDS の変更を Snowflake に反映

| 機能 | 担い手 |
| --- | --- |
| 初回の履歴 | Amazon RDS for PostgreSQL の注文テーブル |
| 変更の公開・保持 | PostgreSQL の publication、WAL、`pgoutput` の論理レプリケーションスロット |
| 初回・増分同期と進捗 | Fivetran SaaS の PostgreSQL 接続 |
| ロード | Snowflake Warehouse と専用サービスユーザー |
| 同期した行 | Snowflake の同期先テーブル |

利用者は RDS 主インスタンスのパラメーターグループで `rds.logical_replication` を有効にする。Fivetran 用ユーザーにテーブルの読み取りと `rds_replication` を付与する。この例は直接接続を選び、RDS の TLS と接続元の許可範囲を設定する。Snowflake には専用サービスユーザーの公開鍵、ロール、Warehouse、書き込み先の権限を設定する。Fivetran の設定には対応する秘密鍵を登録する。

AWS は RDS の基盤、Fivetran は同期処理、Snowflake は Warehouse とストレージのサービス基盤を運用する。利用者は接続の設定、同期対象、権限とデータを管理する。図は公式資料を組み合わせた例である。選定リージョンと実動作は未確認である。

- [PostgreSQL Connector Setup Guide](https://fivetran.com/docs/connectors/databases/postgresql/setup-guide)
- [Amazon RDS for PostgreSQL の論理レプリケーション](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.FeatureSupport.LogicalReplication.html)
- [Snowflake Destination Setup Guide](https://fivetran.com/docs/destinations/snowflake/setup-guide)
