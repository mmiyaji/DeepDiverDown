# OpenMetadata のメタデータ基盤

## 1. 収集、保存、検索

取り込みワークフローは外部ソースからメタデータを取得し、OpenMetadata Server の API に登録する。OpenMetadata Server は MySQL または PostgreSQL にカタログを保存し、検索エンジンへ索引を反映する。構成図では Elasticsearch を使う例を扱う。

[Docker Deployment Architecture](https://docs.open-metadata.org/v1.12.x/deployment/docker)、[System and Components](https://docs.open-metadata.org/v1.12.x/developers/architecture/code-layout)

## 2. 用語集・分類・所有者

用語集は事業上の用語とその定義をそろえる。分類タグは個人情報や重要度など、資産の性質を示す。利用者は所有者やタグなどで検索結果を絞り、候補の説明とスキーマを比較する。

[Data Discovery](https://docs.open-metadata.org/v1.12.x/how-to-guides/data-discovery/discover)、[Data Governance](https://docs.open-metadata.org/v1.12.x/how-to-guides/data-governance)

## 3. テーブル・列リネージ

パイプライン、データベース、ダッシュボードなどの関係を記録し、上流・下流をたどる。列リネージは対応する取り込みで取得するほか、担当者が不足分を手で登録できる。

[Column-Level Lineage](https://docs.open-metadata.org/v1.12.x/how-to-guides/data-lineage/column)

## 4. ロールとポリシー

カタログ内の操作権限には所属やロールと、資産の所有者やタグなどの条件を使える。たとえば個人情報タグの変更をスチュワードに限定する。接続先で実データを読む権限は接続先の認可経路に従う。

[Data Governance](https://docs.open-metadata.org/v1.12.x/how-to-guides/data-governance)、[Roles and Policies](https://docs.open-metadata.org/v1.12.x/how-to-guides/admin-guide/roles-policies/authorization)

## 5. データ契約の定義と検証

対象資産に期待するスキーマ、意味、品質、SLA などを契約に定義する。検証可能な項目は資産種別と構成に依存する。検証を実行し、API または画面で結果を確認する。対応する契約は Open Data Contract Standard（ODCS）形式でも連携できる。

[Creating Data Contracts](https://docs.open-metadata.org/v1.12.x/how-to-guides/data-contracts/spec)、[Data Contracts API](https://docs.open-metadata.org/v1.12.x/api-reference/data-contracts)

## 6. シナリオの見方

「個人情報を含む列の影響を調べる」は `customer_email` のタグ、所有者、下流レポートを調べる例。「公開テーブルの契約を検証する」は、スキーマ要件を記録し、検証結果を確認する例。

## 7. 実装例：OpenMetadata の Docker Compose

OpenMetadata Server、取り込み用 Airflow、PostgreSQL、Elasticsearch を分け、BigQuery の注文テーブルと、それを使う Looker のダッシュボードを収集する例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| データベース・BI | BigQuery | テーブルとリネージ用のクエリログを提供する。 |
| データベース・BI | Looker | ダッシュボード・チャートと LookML Explore を API で取得する。 |
| データ担当者 | データスチュワード | 分類や契約を担当する。 |
| データ利用者 | カタログ利用者 | 資産と依存関係を検索する。 |
| メタデータ・リネージ収集 | OpenMetadata Ingestion コンテナ | BigQuery と Looker のコネクタを別々に実行し、Looker の取り込みで参照するデータベースサービスを指定する。 |
| メタデータ API・検索・リネージ画面・データ契約・検証 | OpenMetadata Server（API・Web） | API と検索画面、契約の取得・検証を提供する。 |
| メタデータ DB | PostgreSQL | カタログのエンティティと関係を保持する。 |
| 検索エンジン | Elasticsearch | カタログを索引化する。 |
| 実装で追加 | Airflow スケジューラー | 収集ワークフローを起動する。 |
| 実装で追加 | GitHub の LookML ファイル | LookML View と元テーブルとの関係を取得するため、対象リポジトリに読み取りアクセスを設定する。 |

BigQuery のリネージ収集範囲はクエリログとコネクタ権限に依存する。Looker から元テーブルをたどる例では、GitHub から LookML を読み、`sql_table_name` またはプレーン SQL の `derived_table` で参照を記述する。LookML の Liquid 変数はこのリネージの対象外。レポートまで個々の列を追えるかは、収集された関係の粒度に依存する。サーバーと取り込みコンテナのバージョンを揃える。

[Docker Deployment Architecture](https://docs.open-metadata.org/v1.12.x/deployment/docker)、[Data Contracts API](https://docs.open-metadata.org/v1.12.x/api-reference/data-contracts)、[OpenMetadata Docker Quickstart](https://docs.open-metadata.org/v1.12.x/quick-start/local-docker-deployment)、[BigQuery コネクタ](https://docs.open-metadata.org/v2.0.x/connectors/database/bigquery)、[Looker コネクタ](https://docs.open-metadata.org/v2.0.x/connectors/dashboard/looker)、[OpenMetadata のリネージ取り込み](https://docs.open-metadata.org/v2.0.x/connectors/ingestion/lineage)
