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
