# Microsoft Purview の Data Map と Unified Catalog

## 1. 対象範囲と移行

本図は既存の Microsoft Purview Data Governance 環境を対象とする。Microsoft は 2026年11月12日に Unified Catalog、Data Map、Workflows、クラシック機能の提供終了を発表した。新規ガバナンスアカウントの作成受付は終了し、既存機能は 2027年11月12日までメンテナンスモードでサポートされる。ガバナンス機能の集約先は Microsoft Fabric の OneLake catalog。Purview のデータセキュリティ・コンプライアンス機能は継続する。

[Microsoft Purview Data Governance Overview](https://learn.microsoft.com/en-us/purview/data-governance-overview)、[Microsoft Data Governance Strategy Update](https://learn.microsoft.com/partner-center/announcements/2026-november#update-on-the-microsoft-data-governance-strategy)

## 2. Data Map のスキャンとリネージ

データソースを登録してスキャンし、スキーマなどの技術メタデータを Data Map に取り込む。自動分類やリネージの対応範囲はソースごとに異なる。Azure Data Factory と連携すると、対応するアクティビティの入出力がリネージとして追加される。

[Microsoft Purview Data Map Scans and Ingestion](https://learn.microsoft.com/en-us/purview/data-map-scan-ingestion)、[Data Map Supported Sources](https://learn.microsoft.com/en-us/purview/data-map-data-sources)

## 3. Unified Catalog のデータ製品

ガバナンスドメインに、用途を持つデータ製品として資産をまとめる。利用者は資産やデータ製品を検索し、業務上の意味、所有者、利用条件を確認できる。

[Microsoft Purview Data Governance Overview](https://learn.microsoft.com/en-us/purview/data-governance-overview)、[Microsoft Purview Unified Catalog](https://learn.microsoft.com/en-us/purview/unified-catalog)

## 4. アクセス申請と付与

利用者が Unified Catalog で申請すると、設定に応じて承認者やプライバシーレビュー担当者に通知される。最終承認者、または指定された権限付与担当者がソース資産へのアクセスを設定し、完了を記録する。カタログにおける閲覧ロールとソースのデータアクセス権限は別の経路で評価される。

[Microsoft Purview Data Governance Overview](https://learn.microsoft.com/en-us/purview/data-governance-overview)、[Unified Catalog Data Product Access Policies](https://learn.microsoft.com/en-us/purview/unified-catalog-data-product-access-policies)、[Request Access to Data Products](https://learn.microsoft.com/en-us/purview/unified-catalog-data-product-access-requests)

## 5. シナリオの見方

既存テナントの注文データ製品を例に、テーブルとジョブの収集、カタログからの発見、承認から権限反映までを追う。図の Microsoft Fabric OneLake catalog は移行先の詳細図を開く入口。

## 6. 実装例：既存 Purview・Azure SQL・Data Factory

稼働中の Purview Data Governance テナントで、Azure SQL Database をスキャンし、Data Factory の入出力を関連付ける例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| データ製品の所有者 | データ製品所有者 | Unified Catalog の製品説明と申請条件を整える。 |
| データ利用者 | 分析担当者 | 注文データ製品の閲覧・申請を行う。 |
| 権限付与担当者 | データベースの権限付与担当者 | 承認内容に従い Azure SQL の権限を付ける。 |
| 登録・スキャン | Purview スキャン | Azure SQL を収集し、Data Map に反映する。 |
| 資産メタデータ・分類の集約 | Purview Data Map | 自動分類と Data Factory の実行関係を集約する。 |
| データ製品カタログ・アクセス申請・承認 | Unified Catalog（データ製品・アクセス） | 製品の検索画面に申請と承認の履歴を関連付ける。 |
| データソース | Azure SQL Database | 注文データを保持し、接続時にアクセス権を評価する。 |
| 連携するデータ変換基盤 | Azure Data Factory | 対応するアクティビティの入出力を Purview へ送る。 |
| 後継のガバナンス基盤 | Microsoft Fabric OneLake catalog | 既存サービスの移行先への参照。 |
| 実装で追加 | Purview マネージド VNet Integration Runtime | Purview 管理の VNet に配置し、マネージド プライベート エンドポイント経由で Azure SQL を読み取る。 |

スキャン用 ID に Azure SQL Database の読み取り権限とネットワーク到達性が必要。閉域接続には Purview 内で作成したランタイムと、Azure SQL Database 側で承認されたマネージド プライベート エンドポイントを使う。Azure Data Factory はパイプラインを実行し、対応する処理のリネージを Data Map に送る。[Purview のマネージド VNet とプライベート エンドポイント](https://learn.microsoft.com/en-us/purview/catalog-managed-vnet)。新規ガバナンスアカウントの作成受付は終了し、サポート終了予定は 2027年11月12日。

[Microsoft Data Governance Strategy Update](https://learn.microsoft.com/partner-center/announcements/2026-november#update-on-the-microsoft-data-governance-strategy)、[Microsoft Purview Data Map Scans and Ingestion](https://learn.microsoft.com/en-us/purview/data-map-scan-ingestion)、[Unified Catalog Data Product Access Policies](https://learn.microsoft.com/en-us/purview/unified-catalog-data-product-access-policies)、[Azure SQL Database の登録とスキャン](https://learn.microsoft.com/en-us/purview/register-scan-azure-sql-database)

この例では Purview のシステム割り当てマネージド ID を Azure SQL の Entra ユーザーとして登録し、必要なメタデータと分類の読み取り権限を与える。Purview が管理する VNet とプライベートエンドポイントを設定し、SQL の所有者が接続を承認する。マネージド VNet は Purview 外から直接管理できない。Data Factory と Azure SQL の設定、スキャン、承認とソース権限は利用者が管理し、Fabric は移行先の参照であって接続済みと仮定しない。この組み合わせは実動作未検証。[Azure SQL スキャン](https://learn.microsoft.com/en-us/purview/register-scan-azure-sql-database)、[管理 VNet とプライベートエンドポイント](https://learn.microsoft.com/en-us/purview/data-governance-private-endpoints-managed-virtual-network)
