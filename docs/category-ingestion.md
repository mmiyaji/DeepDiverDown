# データ取り込みの違い

| 観点 | Kafka Connect | Debezium | Airbyte | Fivetran |
| --- | --- | --- | --- | --- |
| 特徴 | Kafka の **コネクター実行基盤** | DB の変更を送る **CDC コネクター** | **Source と Destination** を組み合わせて同期 | 接続設定を管理する **SaaS** |
| 読み取り | Source ごとの **コネクター** | DB の **変更ログ** と初期スナップショット | コネクターにより **CDC・カーソル・全件** | コネクターにより **変更ログ・カーソル・全件** |
| 再開位置 | Source の **オフセット**、Sink の Consumer Group | コネクターの **ソースオフセット** | Destination が確認した **State** | 接続の **チェックポイント** |
| 届ける先 | **Kafka と外部システム** の間 | 例では Kafka の **変更イベント** | Destination 対応の **DB・ウェアハウス等** | 対応する **ウェアハウス・DB 等** |
| 動かし方 | 自前 Worker または **MSK Connect** 等 | 例では **Kafka Connect 上** で実行 | **自己管理** または Airbyte Cloud | **Fivetran Cloud** または対応する配置方式 |
| 設定と拡張 | コネクターの **プラグイン** を配置 | DB ごとの **Source Connector** を設定 | **Connector Builder** や CDK で拡張 | 提供される **コネクターと接続** を設定 |

Kafka Connect はコネクターを動かす基盤です。Debezium はその上で使える CDC コネクターであり、同じ構成に組み合わせられます。PostgreSQL は変更元データベース、Snowflake は取り込み先として登場するため、この表の列とは役割が異なります。[Snowflake の取り込みと増分処理](index.html#/m/snowflake-ingestion-cdc/struct) では、受信後の処理を追います。

## 選び方

- Kafka と外部システムの読み書きをコネクターで分担する → **Kafka Connect**
- PostgreSQL の変更ログを Kafka のイベントとして扱う → **Debezium**
- HTTP API の読み取りを宣言で作り、複数の宛先へ同期する → **Airbyte**
- SaaS で接続と同期を管理し、ロード後に dbt を実行する → **Fivetran**

対応するソース・宛先、CDC の可否、重複の扱い、利用できる配置方式は、コネクターと契約・設定で確認します。

## 公式資料

- [Kafka Connect User Guide](https://kafka.apache.org/44/kafka-connect/user-guide/)
- [Debezium Architecture](https://debezium.io/documentation/reference/3.7/architecture.html)
- [Debezium PostgreSQL Connector](https://debezium.io/documentation/reference/3.7/connectors/postgresql.html)
- [Airbyte Protocol](https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol)
- [Airbyte Sync Modes](https://docs.airbyte.com/platform/using-airbyte/core-concepts/sync-modes)
- [Fivetran Sync Overview](https://fivetran.com/docs/core-concepts/syncoverview)
- [Fivetran Transformations for dbt](https://fivetran.com/docs/transformations/dbt)
