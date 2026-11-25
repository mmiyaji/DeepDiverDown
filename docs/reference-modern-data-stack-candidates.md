# モダンデータスタックのリファレンス候補

公開済みの教材は [README のリファレンス一覧](../README.md#アーキテクチャリファレンス) から開けます。この一覧の全項目をリファレンスに収録しました。

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
| [Airbyte](reference-airbyte.md) | Source Connector、Destination Connector、同期状態を使った増分コピーの再開 | [Airbyte Protocol](https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol) |
| [Fivetran](reference-fivetran.md) | SaaS や基幹DBの初回同期から、増分同期とウェアハウスへのロードまで | [Fivetran Docs](https://fivetran.com/docs/getting-started) |
| dbt | 分析基盤にロード済みのデータを、依存関係付き SQL モデルで staging から mart へ変換し、テストする | [dbt Introduction](https://docs.getdbt.com/docs/introduction) |
| Apache Airflow | 取り込み、変換、品質チェックの DAG をスケジューリングし、タスク失敗後に再試行する | [Airflow Architecture](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html) |
| AWS Glue | カタログでデータを発見し、ジョブがデータを読み、変換してストレージへ書く | [AWS Glue](https://docs.aws.amazon.com/glue/latest/dg/what-is-glue.html) |
| [Azure Data Factory](reference-azure-data-factory.md) | パイプラインがコピー処理を起動し、取り込み先にデータを配置する | [Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/introduction) |
| [Google Cloud Dataflow](reference-google-cloud-dataflow.md) | Apache Beam のパイプラインを実行し、入力から集計・出力まで追う | [Dataflow Overview](https://cloud.google.com/dataflow/docs/overview) |

## ストリーム処理

| 候補 | 図解するシナリオ | 公式資料 |
|---|---|---|
| Spark Structured Streaming | Kafka から読み、マイクロバッチでウィンドウ集計し、出力後にチェックポイントから再開する | [Structured Streaming](https://spark.apache.org/docs/latest/streaming/index.html) |
| Spark Streaming（DStreams） | 旧 API の StreamingContext が入力を RDD の列として処理する。既存構成の読解と Structured Streaming との比較に使う | [Spark Streaming](https://spark.apache.org/docs/latest/streaming-programming-guide.html) |
| Apache Flink | イベント時刻とウォーターマークで集計ウィンドウを進め、障害後にチェックポイントから演算子の状態を復元する | [Flink・Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/) |
| Kafka Streams | アプリケーション内の処理トポロジーが Kafka Topic を読み、状態ストアを更新し、changelog から状態を復元する | [Kafka Streams Architecture](https://kafka.apache.org/44/streams/architecture/) |

Kafka Connect は Kafka と外部システムの間でデータを運ぶ。Kafka Streams はアプリケーション側でデータを変換・集計する。Debezium はデータベースの変更を捕捉し、Kafka Connect を使う構成を取れる。 [Kafka Connect](https://kafka.apache.org/44/kafka-connect/overview/)・[Kafka Streams](https://kafka.apache.org/44/streams/architecture/)・[Debezium](https://debezium.io/documentation/reference/stable/architecture.html)

## クラウド分析基盤・SQL エンジン

| 候補 | 図解するシナリオ | 公式資料 |
|---|---|---|
| Snowflake | ストレージ・仮想ウェアハウス・クラウドサービスの役割を分け、取り込みと BI を別ウェアハウスで実行する | [Snowflake Architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts) |
| Databricks | レイクハウス基盤で取り込んだデータを Spark などで整備し、Unity Catalog の管理下で Databricks SQL から読む | [Databricks・参照アーキテクチャ](https://docs.databricks.com/aws/en/lakehouse-architecture/reference) |
| [Google BigQuery](reference-bigquery.md) | ストレージ層と計算層を分け、クエリの Stage、Slot、分散 Shuffle を追う | [BigQuery Overview](https://cloud.google.com/bigquery/docs/introduction)・[Query Plan](https://cloud.google.com/bigquery/docs/query-plan-explanation) |
| [Amazon Redshift](reference-redshift.md) | プロビジョンド構成で Leader Node が計画を作り、Compute Node に分散して実行する | [Redshift Architecture](https://docs.aws.amazon.com/redshift/latest/dg/c_high_level_system_architecture.html) |
| [Microsoft Fabric](reference-microsoft-fabric.md) | OneLake を基盤としてデータを整備し、Lakehouse または Warehouse から分析する | [Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview) |
| [Trino](reference-trino.md) | Coordinator がクエリを計画し、Worker が Connector を通じてデータを分散読み出しする | [Trino Concepts](https://trino.io/docs/current/overview/concepts.html) |

## 運用・ガバナンス

| 候補 | 図解するシナリオ | 公式資料 |
|---|---|---|
| データリネージと OpenLineage | 取り込みから BI までを Dataset・Job・Run でつなぎ、上流の変更が影響する範囲を特定する | [OpenLineage Object Model](https://openlineage.io/docs/spec/object-model/) |

## 追加順の案

1. **Kafka からつなぐ**：Kafka Connect → Debezium → Spark Structured Streaming → Flink → Kafka Streams。共通の受注イベントで、取り込み・変換・状態復元を比較する。
2. **保存と分析まで広げる**：メダリオンアーキテクチャ → Iceberg・Delta Lake・Hudi → dbt → Snowflake・Databricks。同じ受注データが保存され、分析用に整備される流れを追う。
3. **組織間での利用を扱う**：データクリーンルーム → リネージ。誰が何を実行でき、どの結果まで受け取れるかを図解する。

## 追加調査と対応リファレンス

同じ注文・受注データを使い、製品の違いと障害時の境界を比較できる題材です。共通条件の例は、顧客 42 の 2026年1月25日以上・2月1日未満の注文です。ClickHouse と DuckDB はこの条件を用い、各エンジンの区画や実行計画に着目します。

| 調査テーマ | 対応リファレンス |
|---|---|
| ClickHouse の疎インデックスとマージ | [ClickHouse](reference-clickhouse.md) |
| DuckDB の Parquet プッシュダウン | [DuckDB](reference-duckdb.md) |
| Apache Paimon の更新と変更ログ | [Apache Paimon](reference-apache-paimon.md) |
| Iceberg カタログの権限・更新・公開 | [Apache Polaris](reference-apache-polaris.md)・[Project Nessie](reference-project-nessie.md) |
| 分散トレースとサンプリング | [OpenTelemetry](reference-opentelemetry.md) |
| Raft の選出とクォーラム | [etcd](reference-etcd-raft.md) |
| GitOps の同期と構成のずれ | [Argo CD](reference-argo-cd.md) |
| PostgreSQL の WAL と論理デコーディング | [PostgreSQL](reference-postgresql-logical-decoding.md) |
| Kubernetes の通信とネットワークポリシー | [Cilium と Hubble](reference-cilium-hubble.md) |
| メタデータ、列リネージ、データ契約 | [DataHub](reference-datahub.md)・[OpenMetadata](reference-openmetadata.md) |
| 設定の検証と CI の判定 | [OPA と Conftest](reference-opa-conftest.md) |
| Kafka の Avro スキーマ互換性 | [Apicurio Registry](reference-apicurio-registry.md) |
| 履歴再生と外部処理の再試行 | [Temporal](reference-temporal.md) |

[カタログの責務](reference-data-catalog-architecture.md)、[DWH 設計パターン](reference-dwh-design-patterns.md)、[Snowflake](reference-snowflake.md)、[Databricks](reference-databricks.md)から各分野の詳細図を辿れます。

## 追加候補・AI エージェントとデータ基盤（2026年11月調査）

以下は追加調査した**図解候補**です。上の公開済みリファレンスと合わせて検討します。

| テーマ・技術 | 図解するシナリオ | 確認する点・公式資料 |
|---|---|---|
| セマンティック層・dbt MetricFlow | 売上指標と期間・顧客の軸を定義し、BI と AI が同じ指標定義から SQL を組み立てる | 指標の粒度、結合経路、権限と利用するインターフェースの提供条件を確認する。[MetricFlow](https://docs.getdbt.com/docs/build/about-metricflow)・[Semantic Layer](https://docs.getdbt.com/docs/use-dbt-semantic-layer/dbt-sl) |
| AI エージェントと MCP | 利用者の質問を受けたエージェントが、認可されたカタログ・指標・検索ツールを発見し、結果を根拠付きで返す | MCP はツール接続のプロトコル。接続先ごとの認可、入力検証、利用者の識別を設計する。[MCP 仕様](https://modelcontextprotocol.io/specification/2026-07-28)・[MCP 認可](https://apps.extensions.modelcontextprotocol.io/api/documents/authorization.html) |
| [エージェント向け文書検索・Databricks AI Search](reference-databricks-ai-search.md) | 注文規約を索引化し、質問に対応する箇所を検索ツールから取り出して回答に添える | 索引の更新、検索結果のアクセス権、回答に使った文書と版の記録を確認する。[Databricks の検索ツール](https://docs.databricks.com/gcp/en/agents/custom-agents/unstructured-retrieval-tools) |
| 構造化データと文書の複合分析・Snowflake Cortex Agents | 注文指標は分析用データ、返品理由は文書検索から取得し、根拠を照合して答える | 検索結果の対象範囲と集計結果の母集団を確認する。Snowflake の Analytical Search は資料上プレビュー機能。[Cortex Search](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-agents)・[Analytical Search](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-analytical-search) |
| 特徴量ストア・Feast | 注文履歴から学習用の過去特徴量を作り、推論時にオンライン特徴量を参照する | 学習時点と推論時点、更新遅延、オンラインストアの運用を確認する。[Feast の推論構成](https://docs.feast.dev/getting-started/architecture/model-inference) |
| AI エージェントの観測・OpenTelemetry | 質問、モデル呼び出し、検索、ツール呼び出しをトレースで追い、遅延や失敗を分析する | 記録内容に機微情報が含まれる可能性と、GenAI 向け規約の更新を確認する。[エージェントの観測](https://opentelemetry.io/blog/2025/ai-agent-observability/)・[GenAI 属性](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/) |

### システム構成の例

利用者の「先月の売上と返品増加の理由」という質問に答える構成を想定します。

1. データ基盤が注文・返品を取り込み、品質検査と変換を経て分析用テーブルと指標定義を公開する。
2. エージェントは利用者の認可を確認し、指標ツールで売上・返品率を取得する。文書検索ツールで返品理由の関連資料を取得する。
3. 指標の定義、対象期間、検索した資料の参照先を添えて回答する。ツール呼び出しと実行結果は観測基盤で追跡する。
4. 設定変更や外部への書き込みを行う場合は、実行主体と権限を確認し、処理の再試行と承認を設計する。

指標の取得、文書検索、外部操作はそれぞれ異なる権限と実行結果を持つ。回答の評価では、数値の一致、出典の妥当性、アクセス制御、ツールの失敗時の挙動を確認する。

### 追加する図の優先候補

1. **[指標と文書を使う分析エージェント](reference-analytics-agent.md)** — セマンティック層、認可付きツール、SQL 実行、出典付き回答を一続きで示す。
2. **文書検索を組み合わせたエージェント** — 索引の更新、検索、権限、回答の根拠を示す。
3. **エージェントの運用** — トレース、評価、再試行、人による承認と外部操作の境界を示す。
4. **オンライン推論と特徴量** — 特徴量の生成からオンライン取得、モデル推論までを既存の MLflow リファレンスとつなぐ。

## エージェント運用とオンライン推論の追加調査（2026年11月）

### エージェントの停止・再開と評価

| 観点 | 調査結果 | 図で追う例 |
|---|---|---|
| 状態と再開 | LangGraph はチェックポイントを使って処理の状態を保存し、割り込み後に入力を受けて再開できる。再開時のノード処理と外部操作の重複は実装側で考慮する。[LangGraph](https://docs.langchain.com/oss/javascript/langgraph/thinking-in-langgraph) | 問い合わせ分類 → 指標取得 → 外部更新の承認待ち → 承認後に再開 |
| 実行の観測 | OpenTelemetry の GenAI 向け規約を使い、エージェント、モデル、ツール呼び出しをトレースで追える。規約と計装の対応状況は採用バージョンごとに確認する。[OpenTelemetry](https://opentelemetry.io/blog/2026/genai-observability/) | 失敗した検索の再試行をたどり、処理時間と呼び出し回数を確認 |
| 回答と行動の評価 | MLflow は評価用データ、scorer、トレースを使い、最終回答だけでなくツール利用などの途中の振る舞いも評価できる。[MLflow](https://mlflow.org/docs/latest/genai/eval-monitor/running-evaluation/agents/) | 正答・出典・認可されたツールの利用をテストケースで検証 |

構成例では、利用者の要求を受けるアプリ、エージェントの状態保存、ツール、承認画面、観測基盤、評価データを分けて描く。外部更新の承認では、更新対象と引数、承認結果、実行結果をひも付ける。再試行できる外部操作には重複防止の識別子を設け、承認前後で対象や権限が変わった場合の再確認を扱う。

### 特徴量ストアとオンライン推論

Feast の構成例では、バッチやストリームで作った特徴量を定義・登録し、学習時にはオフライン側の履歴から対象時点に対応する値を取得する。オンラインストアにはエンティティごとの最新値を反映し、推論アプリが特徴量を取得してモデルへ渡す。[Feast の構成要素](https://docs.feast.dev/master/getting-started/components/overview)・[特徴量の提供と推論](https://docs.feast.dev/getting-started/architecture/model-inference)

注文遅延の予測を題材にする場合、注文履歴の整備 → 学習時点に対応した特徴量の取得 → モデルの学習・登録 → オンラインストアへの反映 → 注文時の特徴量取得と推論を追う。特徴量の欠損、更新遅延、学習時と推論時の定義の一致、履歴への未来情報の混入を評価する。既存の [Databricks MLflow の学習・配備](reference-databricks-mlflow-serving.md) と接続し、モデルの登録・配備と特徴量の提供を見比べられる。

### 図解候補の設計

1. **エージェントの承認・再開** — 保存した状態、承認、外部ツール、再試行を分ける。LangGraph を使う配置例と、実行トレースの評価例を添える。
2. **オンライン特徴量と推論** — 履歴データ、特徴量の定義、学習データ、オンラインストア、推論サービスを分ける。Feast の配置例と MLflow によるモデル登録への接続を示す。
