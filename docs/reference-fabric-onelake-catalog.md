# Microsoft Fabric OneLake catalog の発見とガバナンス

## 1. OneLake catalog の位置付け

OneLake catalog は Fabric のデータ発見とガバナンスの入口。Explore で資産を発見し、Govern で管理状態を把握し、Secure で役割を確認・設定する。Microsoft は Purview Data Governance の機能を Fabric に集約する方針を発表している。本図は Fabric 内のアイテムを対象とし、既存 Purview 環境の移行では必要なソースや機能ごとに対応範囲を確認する。

[OneLake Catalog Overview](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)、[Microsoft Data Governance Strategy Update](https://learn.microsoft.com/partner-center/announcements/2026-november#update-on-the-microsoft-data-governance-strategy)

## 2. Explore とアイテム詳細

Explore では Fabric のアイテムを絞り込み、詳細から上流・下流、認定、機密性などを調べる。管理設定が許可し、所有者が発見可能に設定したコンテンツでは、利用権限を持たない利用者も検索結果からアクセスを申請できる。表示される詳細や操作は種類と権限に依存する。

[OneLake Catalog Overview](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)、[OneLake Catalog Item Details](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-item-details)、[Discovery Admin Settings](https://learn.microsoft.com/en-us/fabric/admin/service-admin-portal-discovery)

## 3. Govern とドメイン

Govern はドメイン、認定、メタデータスキャン、ポリシーなどを管理する入口。管理者はドメインやワークスペースの状態を確認し、ガバナンスの推奨アクションを検討できる。Govern の一般提供は 2026年9月。

[OneLake Catalog Overview](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)、[Govern Your Fabric Data](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-govern)、[What's New in Fabric](https://learn.microsoft.com/fabric/fundamentals/whats-new)

## 4. Secure とクエリ時の認可

Secure でワークスペースロールと OneLake セキュリティロールを確認できる。ワークスペース内の他利用者の権限を確認できる範囲は Admin または Member などの役割による。OneLake の行・列の制御は対応エンジンで評価される。SQL 分析エンドポイントではユーザー ID アクセスモードが必要。認可済みの外部エンジンと Table Read API を使う行・列フィルタリングは公開プレビュー。

[Secure Your Fabric Data](https://learn.microsoft.com/en-us/fabric/governance/secure-your-data)、[Read Data Secured with OneLake Security](https://learn.microsoft.com/en-us/fabric/onelake/security/read-secured-data)

## 5. シナリオの見方

「認定済みレポートの上流を確認する」では、Explore から資産の認定や由来を確認する。「制限付きのデータを読む」では、ワークスペースと資産の権限を管理し、対応エンジンがクエリ時に行・列の制限を適用する。
