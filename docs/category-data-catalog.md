# データカタログの違い

OSS・自前運用型

| 観点 | Apache Polaris | Project Nessie | DataHub | OpenMetadata | Apache Gravitino |
| --- | --- | --- | --- | --- | --- |
| 特徴 | **Iceberg REST** を実装した技術カタログ | カタログ全体を **ブランチ・タグ** で版管理 | **Aspect と URN** で資産を持つメタデータ基盤 | **API と 1 つの DB** に集約したメタデータ基盤 | 複数カタログを束ねる **フェデレーション**（メタレイク） |
| 管理する対象 | Iceberg の namespace・テーブル | 複数の Iceberg テーブル・ビューの **同時点の状態** | Dataset・ダッシュボード・ストリームなど **ソース横断の資産** | テーブル・パイプライン・ダッシュボードなど **ソース横断の資産** | テーブル、Kafka トピック、ファイルセット、モデル |
| メタデータの取り込み方 | エンジンが REST でテーブルを作成・コミット | エンジンがコミットで更新（Iceberg REST は **実験的** と記載） | コネクタが MCP を GMS へ送る（HTTP か Kafka） | 取り込みワークフローが API へ登録 | 既存システムのカタログを登録し、その場で参照する（移さない） |
| アクセス制御の仕組み | Principal → Principal Role → **Catalog Role**。S3 は一時認証情報を払い出し | 既存解説に記載なし（未確認） | **メタデータポリシー**（対象・操作・主体）。実データは接続先の権限 | **ロールとポリシー**（所有者・タグを条件にできる）。実データは接続先の権限 | ユーザー・グループ・ロール・権限。既定は組み込みの JcasbinAuthorizer。Ranger などへ委譲する構成もある |
| リネージ | 対象外（既存解説に記載なし） | 対象外（既存解説に記載なし） | 取り込んだ関係を **上流・下流** でたどる。列単位は取り込み経路に依存 | **テーブル・列リネージ**。不足分は手で登録できる | 未確認（概要の資料に記載なし） |
| 外部エンジンとの接続 | Spark など **Iceberg REST 対応エンジン** | Spark など。クライアントが URI で **ブランチ・タグ** を選ぶ | 外部エンジンの接続口ではない | 外部エンジンの接続口ではない | Trino・Spark・Flink・Daft のコネクタと **Iceberg REST** サービス |
| 得意な用途 | 複数エンジンから同じ Iceberg を **権限つき** で読み書き | 複数表を **まとめて検証してから公開** | 影響調査・所有者の把握・契約の検証 | 用語集・分類タグ・契約を含む **データ管理** | Hive・RDB・Kafka・ファイルなど、種類の異なるメタデータの一元管理 |
| 注意点 | 認可は **IAM ロールの設定** も確認が要る | REST 応答のスナップショットは **選んだ参照の 1 つ** | 契約の自動検証は **DataHub Cloud の条件** に依存 | 契約で検証できる項目は **資産種別と構成** に依存 | Iceberg REST の配置形態・認可・一時認証情報は **未確認**。列単位の制御はなく、権限の反映にポーリング間隔（既定 3 秒）の遅れがある。参照資料は main ブランチ（2.0.0-SNAPSHOT） |

マネージド・クラウド型

| 観点 | AWS Glue Data Catalog と Lake Formation | Amazon DataZone | Microsoft Purview | Fabric OneLake catalog | Google Cloud Knowledge Catalog | Snowflake Horizon Catalog | Databricks Unity Catalog |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 特徴 | AWS の標準カタログに **Lake Formation の権限と一時認証情報** を重ねる | **公開と購読** でデータを流通させる | **Data Map と Unified Catalog** の二層 | Fabric の **Explore・Govern・Secure** の入口 | **Entry と Aspect** で GCP 資産を管理 | **分類・タグ・マスキング・監査** を同じ製品で扱う | **catalog.schema.table** の 3 階層で権限を管理 |
| 管理する対象 | データベース・テーブル（Iceberg・Hudi・Delta Lake を含む）と S3 の保存場所のメタデータ | ドメインとプロジェクトの資産（Glue・Redshift など） | スキャンで登録した資産と **データ製品** | Fabric のアイテム | BigQuery など GCP の Entry と **データ製品** | Snowflake 内のオブジェクト | メタストアのカタログ・スキーマ・表・ボリューム |
| メタデータの取り込み方 | クローラー、手動定義、Glue ETL。外部エンジンは Iceberg REST で作成・更新できる | Glue Data Catalog などからインベントリへ取り込み | データソースを **登録してスキャン** | Fabric 内のアイテムを対象（外部ソースは未確認） | GCP サービスは **自動登録**。外部はコネクタ | 管理対象のオブジェクトが対象（外部の取り込みは未確認） | Databricks 内の資産が対象（外部の取り込みは未確認） |
| アクセス制御の仕組み | Lake Formation の許可（表・列・行・セル）。S3 ロケーションを登録し、一時認証情報で S3 アクセスを仲介 | 購読の承認後、**Lake Formation** などに権限を反映 | 申請の承認後に権限付与者がソース側を設定 | ワークスペースロールと **OneLake セキュリティロール** | カタログは **IAM**。データ製品は **Google グループ** 経由 | ロール、**マスキングポリシー**、行アクセスポリシー | **USE CATALOG・SELECT** の権限と ワークスペース・バインディング、行フィルタ・列マスク |
| リネージ | Data Catalog が変換の記録を持つ（詳細は未確認） | Glue・Redshift 連携と **OpenLineage** 互換イベント | ソースごと。Data Factory の入出力を追加 | アイテム詳細で上流・下流を確認 | 対応サービスから収集 | **ACCESS_HISTORY** で直接・間接の参照を確認 | 対応する実行経路で表・列・ノートブックまで表示 |
| 外部エンジンとの接続 | **Iceberg REST**（SigV4・OAuth Bearer）。第三者のエンジンは一時認証情報の払い出しを受ける | Athena など **AWS 側の環境**（Iceberg REST は未確認） | 対象外（既存解説に記載なし） | 認可済みの外部エンジンと **Table Read API**（行・列フィルタは公開プレビュー） | Lakehouse runtime catalog の Iceberg を取得（接続の詳細は未確認） | **Horizon Iceberg REST** と vended credentials | **一時認証情報** で管理表へ（行フィルタ・列マスクの表は対象外） |
| 得意な用途 | Athena・EMR・Redshift Spectrum・Glue ETL が S3 のデータレイクを同じ権限で読む構成 | 部門をまたぐ **申請ベースの共有** | 既存 Purview 環境の理解と移行 | Fabric 内の発見・認定・権限確認 | BigQuery 中心の発見と **利用申請** | Snowflake 内の **分類から保護、監査** | Databricks の権限設計と **外部エンジンへの開放** |
| 注意点 | エンジンごとに対応範囲が違う（Athena Spark と EMR on EKS は未対応、Iceberg の書き込みは全表アクセスが前提）。名前空間は 1 階層のみ | 非管理資産は **EventBridge と外部処理** で権限を設定 | 新規アカウントの受付は **終了**（2027 年 11 月 12 日まで保守） | Govern の GA は 2026 年 9 月。**移行範囲はソースと機能ごと** に確認 | 旧 Data Catalog は別サービスで停止が始まっている | 外部エンジンの書き込みに **機能制限** が多い。S3 互換は状況が食い違う | 管理 Delta の外部書き込みには **catalog commits** が要る |

提供段階と制限は 2026 年 11 月時点の公式資料に基づきます。確認できなかった点は「未確認」と書いています。

## 選び方

- 複数のエンジンから同じ Iceberg テーブルを、権限つきで読み書きする → **Apache Polaris**
- 複数の表を作業ブランチで更新・検証してから公開する → **Project Nessie**
- 多数のソースを横断し、所有者とリネージで影響範囲を調べる → **DataHub**
- 用語集・分類タグ・データ契約まで 1 つの DB で管理する → **OpenMetadata**
- AWS のドメイン間で、申請と承認でデータを共有する → **Amazon DataZone**
- Fabric のアイテムを発見し、認定と権限を確認する → **Fabric OneLake catalog**
- BigQuery 資産をデータ製品にまとめ、利用申請を受ける → **Google Cloud Knowledge Catalog**
- Snowflake の列を分類し、マスキングと監査につなぐ → **Snowflake Horizon Catalog**
- Databricks の権限を一元管理し、外部エンジンへ一時認証情報で開く → **Databricks Unity Catalog**
- 既存の Purview 環境を運用している → **Microsoft Purview**（新規導入は終了）

## 公式資料

- [Apache Polaris](https://polaris.apache.org/releases/1.9.0/)
- [Project Nessie](https://projectnessie.org/guides/iceberg-rest/)
- [DataHub Architecture](https://docs.datahub.com/docs/architecture/architecture/)
- [OpenMetadata Data Governance](https://docs.open-metadata.org/v1.12.x/how-to-guides/data-governance)
- [Amazon DataZone](https://docs.aws.amazon.com/datazone/latest/userguide/sagemaker-datazone.html)
- [Microsoft Purview Data Governance](https://learn.microsoft.com/en-us/purview/data-governance-overview)
- [OneLake catalog](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)
- [Google Cloud Knowledge Catalog](https://docs.cloud.google.com/knowledge-catalog/docs/metadata-overview)
- [Snowflake Horizon Catalog](https://docs.snowflake.com/en/user-guide/snowflake-horizon)
- [Databricks Unity Catalog](https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control)

## 図にしなかったもの

- **Hive Metastore**：Hive のテーブルとパーティションのメタデータを持ち、クライアントは Thrift で接続します。バックエンドは MySQL・PostgreSQL などです。公式の管理ガイドに Iceberg の記載はなく、Iceberg との関係は未確認です。
- **AWS Glue Data Catalog**：AWS の技術カタログで、`https://glue.<region>.amazonaws.com/iceberg` の Iceberg REST エンドポイントを持ち、認証は SigV4 か OAuth 2.0 です。OAuth では Lake Formation の権限が各要求で評価されます。Glue の図は既にあり、カタログとしての比較は未実施です。
- **AWS Lake Formation**：Glue Data Catalog の権限を管理します。上記の公式資料で確認できたのは、権限の評価と一時認証情報の範囲に使われる点までです。単独の機能一覧は未確認です。
- **Apache Gravitino**：ファイルストア、Hive・MySQL・PostgreSQL などのリレーショナル DB、イベントストリームのメタデータを束ねる「federated metadata lake」と公式に説明されています。Iceberg REST の提供と Apache 内の段階は、取得したページでは未確認です。
- **Apache Atlas**：Hadoop 向けのデータガバナンスとメタデータの枠組みです。リネージ・分類・Ranger 連携は、取得したページでは未確認です。
- **Unity Catalog OSS**：LF AI & Data の sandbox プロジェクトで、Delta Lake・Iceberg・Hudi（UniForm）などを扱い、Iceberg REST と Hive メタストア API に互換とされています。Databricks 版との機能差は未確認です。
- **Atlan**：商用の「Agentic Data Catalog」で、80 以上のソースへのコネクタ、リネージ、MCP サーバーを持ちます。権限制御の仕組みは未確認です。
- **Collibra**：商用のデータカタログで、ビジネス用語集と技術メタデータの対応づけ、リネージ、データ品質の認証を持ちます。ソースの対応範囲は未確認です。
