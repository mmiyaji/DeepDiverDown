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
