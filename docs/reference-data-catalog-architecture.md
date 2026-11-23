# データカタログの責務と連携

## 1. 二つの責務と正本

本モデルはレイクハウスに技術カタログと横断ガバナンスカタログを組み合わせる設計例。技術カタログはエンジンが現在のテーブル状態を確定する場所であり、ガバナンスカタログは収集した技術情報と事業上の文脈から資産を見つける場所になる。製品が両方の入口を持つ場合も、対象資産、正本、実施点を操作ごとに確認する。

[Iceberg REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)、[DataHub Metadata Model](https://docs.datahub.com/docs/metadata-modeling/metadata-model)、[Databricks Unity Catalog](https://docs.databricks.com/aws/en/data-governance/unity-catalog)、[Snowflake Horizon Iceberg REST Catalog](https://docs.snowflake.com/en/user-guide/tables-iceberg-access-using-external-query-engine-snowflake-horizon)

## 2. Iceberg の書き込み

エンジンがストレージにファイルを置き、技術カタログへ更新と事前条件を送る。成功したコミットから新しいテーブル状態が参照できる。技術カタログや認証基盤が払い出す認証情報を使う構成では、ストレージがその情報を検証してファイルアクセスを許可する。

[Iceberg REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)

## 3. 発見・リネージと同期

カタログからテーブル名やスキーマ、ジョブの実行イベントから入出力関係を収集する。OpenLineage の Job、Run、Dataset を対応付ける過程では、名前空間や資産識別子を揃える。更新時刻と取り込み対象を記録し、遅延や未収集の関係が影響調査に及ぼす範囲を確認できるようにする。

[DataHub Metadata Model](https://docs.datahub.com/docs/metadata-modeling/metadata-model)、[OpenLineage Object Model](https://openlineage.io/docs/spec/object-model/)

## 4. 所有者・分類・ポリシー

所有者は資産の変更や利用に関する連絡先、分類は個人情報などの性質、ポリシーは条件ごとの許可・禁止を記述する。資産を検索・編集する権限はカタログで評価し、実データへのアクセスは経路上のエンジンやストレージなどで評価する。タグから実データの制御につなぐ場合は、タグの同期、許可ルールへの変換、認可が行われる箇所を設計する。

[OpenMetadata Authorization](https://docs.open-metadata.org/v1.12.x/how-to-guides/admin-guide/roles-policies/authorization)、[Databricks Unity Catalog](https://docs.databricks.com/aws/en/data-governance/unity-catalog)、[DataZone Discovery and Subscription](https://docs.aws.amazon.com/datazone/latest/userguide/discover-subscribe-consume-data.html)、[Microsoft Purview Data Governance](https://learn.microsoft.com/en-us/azure/purview/overview)

## 5. 契約と検証

データ契約は提供者・利用者が共有するスキーマ、意味、品質、鮮度などの期待値を定義する。公開前のパイプラインで検証し、版、結果、評価時刻を対象資産から追跡できる設計を例示する。パイプラインで検証失敗時に公開を止める場合は、失敗扱いの条件と公開処理への依存を実装する。

[Open Data Contract Standard](https://github.com/bitol-io/open-data-contract-standard)

## 6. 代表例の対応関係

| 入口 | 代表例 | 主な着眼点 |
| --- | --- | --- |
| Iceberg の技術カタログ | Apache Polaris、Project Nessie | REST 操作と権限、またはカタログ全体のバージョン管理 |
| 横断的なメタデータ基盤 | DataHub、OpenMetadata | ソース収集、検索、リネージ、データ契約 |
| マネージドガバナンス | Amazon DataZone、Google Cloud Knowledge Catalog、Microsoft Fabric OneLake catalog | 公開、検索、アクセス申請と接続先での権限反映 |
| プラットフォーム統合 | Snowflake Horizon Catalog、Databricks Unity Catalog | ガバナンス機能と、Iceberg を外部エンジンから利用する入口 |

図の製品ノードは詳細モデルへの入口。各製品が対象にする資産、操作、権限の適用範囲は詳細モデルと公式資料で確認する。

Microsoft Purview は既存の Data Governance 環境を理解する参照例。Microsoft は同サービスの新規アカウント受付を終了し、2027年11月12日までサポートする。ガバナンス機能の集約先は Microsoft Fabric の OneLake catalog。

[Databricks Unity Catalog](https://docs.databricks.com/aws/en/data-governance/unity-catalog)、[Snowflake Horizon Iceberg REST Catalog](https://docs.snowflake.com/en/user-guide/tables-iceberg-access-using-external-query-engine-snowflake-horizon)、[Apache Polaris](https://polaris.apache.org/)、[Nessie Specification](https://projectnessie.org/develop/spec/)、[DataZone Discovery and Subscription](https://docs.aws.amazon.com/datazone/latest/userguide/discover-subscribe-consume-data.html)、[Knowledge Catalog Metadata Model](https://docs.cloud.google.com/knowledge-catalog/docs/metadata-overview)、[Microsoft Fabric OneLake Catalog](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)、[Microsoft Data Governance Strategy Update](https://learn.microsoft.com/partner-center/announcements/2026-november#update-on-the-microsoft-data-governance-strategy)

## 7. シナリオの見方

注文テーブルを例に、更新の公開、メタデータの収集と下流レポートの調査、変更候補の契約検証と利用申請の評価を順に調べる。各シナリオは同じ資産を扱い、呼び出す機能と確認する状態が異なる。

## 8. 実装例：Unity Catalog・Databricks・Amazon S3

Databricks on AWS で Iceberg テーブル用の REST 入口と、資産検索・リネージ・権限管理を同じ Unity Catalog に配置する例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| データ提供パイプライン・データ契約の検証 | Lakeflow Jobs | 検証タスクから公開タスクへ進む。検証ロジックは SQL などで実装する。 |
| データ利用者 | Databricks ワークスペース利用者 | Catalog Explorer で資産を探し、必要な権限を申請する。 |
| 処理エンジン | Databricks Runtime | 対象テーブルを読み書きし、対応する処理のリネージを登録する。 |
| 実装で追加 | 外部 Iceberg クライアント | Unity Catalog の Iceberg REST 入口を介して対象テーブルにアクセスする。 |
| Iceberg REST Catalog・メタデータ・イベント収集・検索・リネージ・所有者・ポリシー・利用申請 | Databricks Unity Catalog | REST インターフェース、ワークスペース内のリネージ、検索、権限申請を提供する。 |
| データ・メタデータファイル | Amazon S3（管理ストレージ） | 管理 Iceberg テーブルのファイルを保持する。 |
| 実装で追加 | 契約検証結果の表 | 契約版、対象資産、検証時刻、成否を SQL で確認できるようにする。 |
| Iceberg REST と権限制御 | Apache Polaris（比較） | テーブルの技術カタログを別途配置する参照例。 |
| ブランチによる版管理 | Project Nessie（比較） | カタログに版管理を持つ参照例。 |
| 外部エンジン接続と統制 | Snowflake Horizon Catalog（比較） | 外部エンジンと統合する参照例。 |
| 資産管理とプラットフォーム統制 | Databricks Unity Catalog（詳細） | この構成のサービス詳細を参照する。 |
| 横断収集と影響の確認 | DataHub（比較） | 横断的なメタデータ収集の参照例。 |
| 分類とデータ契約の管理 | OpenMetadata（比較） | 分類・契約の横断管理の参照例。 |
| データ公開と購読 | Amazon DataZone（比較） | 購読と権限付与の参照例。 |
| メタデータスキャンと承認 | Microsoft Purview（比較・既存環境） | 既存環境の資産登録・アクセス申請の参照例。 |
| 構造化メタデータと製品公開 | Knowledge Catalog（比較） | Google Cloud のメタデータ管理の参照例。 |
| 分析資産の発見と権限確認 | Microsoft Fabric OneLake catalog（比較） | Fabric の発見とガバナンスの参照例。 |

Lakeflow Jobs の検証タスクで候補データのスキーマと品質条件を確認し、成功時に公開タスクを実行する。結果を記録する表は設計例。下段の製品比較は独立した参照先であり、この構成でデプロイする製品は上段に示す。

[Databricks Unity Catalog](https://docs.databricks.com/aws/en/data-governance/unity-catalog)、[Databricks の Iceberg](https://docs.databricks.com/aws/en/iceberg/)、[Unity Catalog のリネージ](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage)、[Unity Catalog のアクセス申請](https://docs.databricks.com/aws/en/data-governance/unity-catalog/manage-privileges/access-requests)、[Lakeflow Jobs のタスク依存関係](https://docs.databricks.com/aws/en/jobs/run-if)、[Databricks AWS 参照アーキテクチャ](https://docs.databricks.com/aws/en/assets/files/reference-architecture-databricks-on-aws-037959ba92a5a1e33e244fbe2e19fd3f.pdf)
