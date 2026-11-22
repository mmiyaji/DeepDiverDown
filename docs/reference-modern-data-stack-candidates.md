# モダンデータスタックのリファレンス候補

既存の Spark（バッチ）と Kafka（分散ログ）につなげられる教材候補。各行のシナリオは、構成図で追う処理の例を示す。

## 構成概念

| 候補 | 図解するシナリオ | 公式資料 |
|---|---|---|
| メダリオンアーキテクチャ | 注文データを Bronze に保持し、Silver で正規化・重複排除し、Gold の集計を BI で読む | [Databricks・メダリオン](https://developers.databricks.com/perspectives/what-is-the-medallion-architecture-in-a-modern-data-lakehouse) |
| データレイクハウス | オブジェクトストレージ、テーブル形式、カタログ、計算エンジンを分け、同じテーブルを複数エンジンから読む | [Databricks・参照アーキテクチャ](https://docs.databricks.com/aws/en/lakehouse-architecture/reference) |
| データクリーンルーム | 2社で分析条件を合意し、許可された結合・集計を実行し、制約付きの結果を受け取る | [AWS Clean Rooms](https://docs.aws.amazon.com/clean-rooms/latest/userguide/what-is.html)・[Snowflake](https://docs.snowflake.com/en/user-guide/cleanrooms/getting-started)・[Databricks](https://docs.databricks.com/gcp/en/clean-rooms/) |
| ETL と ELT | 同じ受注データを、変換してからロードする経路と、ロード後に分析基盤で変換する経路で比較する | [AWS Glue](https://docs.aws.amazon.com/glue/latest/dg/what-is-glue.html)・[dbt](https://docs.getdbt.com/docs/introduction) |

## ストレージ・テーブル形式・カタログ

| 候補 | 図解するシナリオ | 公式資料 |
|---|---|---|
| Apache Iceberg | コミットでスナップショットを切り替え、メタデータから manifest とデータファイルをたどる | [Iceberg 仕様](https://iceberg.apache.org/spec/) |
| Delta Lake | データファイルを書き、トランザクションログに変更を記録し、ログとチェックポイントから表の状態を復元する | [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md) |
| Apache Hudi | CDC の更新を取り込み、Copy-on-Write と Merge-on-Read の書き込み・読み出しを比較する | [Hudi Concepts](https://hudi.apache.org/docs/concepts/) |
| Iceberg REST Catalog | SQL エンジンがカタログでテーブルを解決し、ストレージからメタデータやデータを読む | [REST Catalog 仕様](https://iceberg.apache.org/rest-catalog-spec/) |

## 取り込み・ETL・ELT・オーケストレーション

| 候補 | 図解するシナリオ | 公式資料 |
|---|---|---|
| Kafka Connect | Source Connector が外部システムから Topic に送り、Sink Connector が下流へ届ける。分散 Worker と Task の分担、再開位置も追う | [Kafka Connect Overview](https://kafka.apache.org/44/kafka-connect/overview/) |
| Debezium | PostgreSQL の初期スナップショットから、変更ログに基づく Kafka への CDC 引き継ぎを追う | [Debezium Architecture](https://debezium.io/documentation/reference/stable/architecture.html) |
| Airbyte | Source Connector、Destination Connector、同期状態を使った増分コピーの再開 | [Airbyte Protocol](https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol) |
| Fivetran | SaaS や基幹DBの初回同期から、増分同期とウェアハウスへのロードまで | [Fivetran Docs](https://fivetran.com/docs/getting-started) |
| dbt | 分析基盤にロード済みのデータを、依存関係付き SQL モデルで staging から mart へ変換し、テストする | [dbt Introduction](https://docs.getdbt.com/docs/introduction) |
| Apache Airflow | 取り込み、変換、品質チェックの DAG をスケジューリングし、タスク失敗後に再試行する | [Airflow Architecture](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html) |
| AWS Glue | カタログでデータを発見し、ジョブがデータを読み、変換してストレージへ書く | [AWS Glue](https://docs.aws.amazon.com/glue/latest/dg/what-is-glue.html) |
| Azure Data Factory | パイプラインがコピー処理を起動し、取り込み先にデータを配置する | [Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/introduction) |
| Google Cloud Dataflow | Apache Beam のパイプラインを実行し、入力から集計・出力まで追う | [Dataflow Overview](https://cloud.google.com/dataflow/docs/overview) |

## ストリーム処理

| 候補 | 図解するシナリオ | 公式資料 |
|---|---|---|
| Spark Structured Streaming | Kafka から読み、マイクロバッチでウィンドウ集計し、出力後にチェックポイントから再開する | [Structured Streaming](https://spark.apache.org/docs/latest/streaming/index.html) |
| Spark Streaming（DStreams） | 旧 API の StreamingContext が入力を RDD の列として処理する。既存構成の読解と Structured Streaming との比較に使う | [Spark Streaming](https://spark.apache.org/docs/latest/streaming-programming-guide.html) |
| Apache Flink | イベント時刻とウォーターマークで集計窓を進め、障害後にチェックポイントから演算子の状態を復元する | [Flink・Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/) |
| Kafka Streams | アプリケーション内の処理トポロジーが Kafka Topic を読み、状態ストアを更新し、changelog から状態を復元する | [Kafka Streams Architecture](https://kafka.apache.org/44/streams/architecture/) |

Kafka Connect は Kafka と外部システムの間でデータを運ぶ。Kafka Streams はアプリケーション側でデータを変換・集計する。Debezium はデータベースの変更を捕捉し、Kafka Connect を使う構成を取れる。 [Kafka Connect](https://kafka.apache.org/44/kafka-connect/overview/)・[Kafka Streams](https://kafka.apache.org/44/streams/architecture/)・[Debezium](https://debezium.io/documentation/reference/stable/architecture.html)

## クラウド分析基盤・SQL エンジン

| 候補 | 図解するシナリオ | 公式資料 |
|---|---|---|
| Snowflake | ストレージ・仮想ウェアハウス・クラウドサービスの役割を分け、取り込みと BI を別ウェアハウスで実行する | [Snowflake Architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts) |
| Databricks | レイクハウス基盤で取り込んだデータを Spark などで整備し、Unity Catalog の管理下で Databricks SQL から読む | [Databricks・参照アーキテクチャ](https://docs.databricks.com/aws/en/lakehouse-architecture/reference) |
| Google BigQuery | ストレージ層と計算層を分け、クエリの Stage、Slot、分散 Shuffle を追う | [BigQuery Overview](https://cloud.google.com/bigquery/docs/introduction)・[Query Plan](https://cloud.google.com/bigquery/docs/query-plan-explanation) |
| Amazon Redshift | プロビジョンド構成で Leader Node が計画を作り、Compute Node に分散して実行する | [Redshift Architecture](https://docs.aws.amazon.com/redshift/latest/dg/c_high_level_system_architecture.html) |
| Microsoft Fabric | OneLake を基盤としてデータを整備し、Lakehouse または Warehouse から分析する | [Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview) |
| Trino | Coordinator がクエリを計画し、Worker が Connector を通じてデータを分散読み出しする | [Trino Concepts](https://trino.io/docs/current/overview/concepts.html) |

## 運用・ガバナンス

| 候補 | 図解するシナリオ | 公式資料 |
|---|---|---|
| データリネージと OpenLineage | 取り込みから BI までを Dataset・Job・Run でつなぎ、上流の変更が影響する範囲を特定する | [OpenLineage Object Model](https://openlineage.io/docs/spec/object-model/) |

## 追加順の案

1. **Kafka からつなぐ**：Kafka Connect → Debezium → Spark Structured Streaming → Flink → Kafka Streams。共通の受注イベントで、取り込み・変換・状態復元を比較する。
2. **保存と分析まで広げる**：メダリオンアーキテクチャ → Iceberg・Delta Lake・Hudi → dbt → Snowflake・Databricks。同じ受注データが保存され、分析用に整備される流れを追う。
3. **組織間での利用を扱う**：データクリーンルーム → リネージ。誰が何を実行でき、どの結果まで受け取れるかを図解する。
