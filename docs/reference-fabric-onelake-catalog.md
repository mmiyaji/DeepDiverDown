# Microsoft Fabric OneLake catalog の発見とガバナンス

## 1. OneLake catalog の位置付け

OneLake catalog は Fabric のデータ発見とガバナンスの入口。Explore で資産を発見し、Govern で管理状態を把握し、Secure で役割を確認・設定する。Microsoft は Purview Data Governance の機能を Fabric に集約する方針を発表している。本図は Fabric 内のアイテムを対象とし、既存 Purview 環境の移行では必要なソースや機能ごとに対応範囲を確認する。

[OneLake Catalog Overview](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)、[Microsoft Data Governance Strategy Update](https://learn.microsoft.com/partner-center/announcements/2026-november#update-on-the-microsoft-data-governance-strategy)

## 2. Explore とアイテム詳細

Explore では Fabric のアイテムを絞り込み、詳細から上流・下流、認定、機密性などを調べる。管理設定が許可し、所有者が発見可能に設定したコンテンツでは、利用権限を持たない利用者も検索結果からアクセスを申請できる。表示される詳細や操作は種類と権限に依存する。

[OneLake Catalog Overview](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)、[OneLake Catalog Item Details](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-item-details)、[Discovery Admin Settings](https://learn.microsoft.com/en-us/fabric/admin/service-admin-portal-discovery)

## 3. Govern とドメイン

Govern はドメイン、認定、メタデータスキャン、ポリシーなどを管理する入口。管理者はドメインやワークスペースの状態を確認し、ガバナンスの推奨アクションを検討できる。Govern の一般提供は 2026年9月で、2026 年 11 月時点の記述である。

[OneLake Catalog Overview](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)、[Govern Your Fabric Data](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-govern)、[What's New in Fabric](https://learn.microsoft.com/fabric/fundamentals/whats-new)

## 4. Secure とクエリ時の認可

Secure でワークスペースロールと OneLake セキュリティロールを確認できる。ワークスペース内の他利用者の権限を確認できる範囲は Admin または Member などの役割による。OneLake の行・列の制御は対応エンジンで評価される。SQL 分析エンドポイントではユーザー ID アクセスモードが必要。認可済みの外部エンジンと Table Read API を使う行・列フィルタリングは公開プレビュー。

[Secure Your Fabric Data](https://learn.microsoft.com/en-us/fabric/governance/secure-your-data)、[Read Data Secured with OneLake Security](https://learn.microsoft.com/en-us/fabric/onelake/security/read-secured-data)

## 5. シナリオの見方

「認定済みレポートの上流を確認する」では、Explore から資産の認定や由来を確認する。「制限付きのデータを読む」では、ワークスペースと資産の権限を管理し、対応エンジンがクエリ時に行・列の制限を適用する。

## 6. 実装例：OneLake・SQL 分析エンドポイント

OneLake catalog を使い、Fabric の Lakehouse と関連レポートを検索し、クエリ時に細かな権限を適用する例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| データ利用者 | レポートを探す分析担当者 | 認定、上流、利用条件を確認する。 |
| 管理者・所有者 | Fabric ワークスペース管理者 | 資産の認定とユーザーの権限を設定する。 |
| 資産の発見・ガバナンス状態の管理・アクセス権限の管理 | OneLake catalog（Explore・Govern・Secure） | 発見、運用状況、ロール管理を統合した入口。 |
| 分析アセット | Power BI レポート | カタログから探す分析アイテム。 |
| データの実体 | OneLake の Lakehouse Delta テーブル | ワークスペースの Lakehouse に属し、OneLake にデータファイルと Delta ログを保存する。 |
| ドメイン・ワークスペース | Fabric ドメイン・ワークスペース | アイテムの整理とワークスペースロールの範囲。 |
| データアクセスロール | OneLake Security | テーブルの行・列のアクセスを Entra ID に結び付ける。 |
| 対応クエリエンジン | SQL 分析エンドポイント | ユーザー ID の実効権限でクエリを実行する。 |
| 実装で追加 | Microsoft Entra ID | 利用者・グループの ID を認証する。 |

Fabric ワークスペースの SQL 分析エンドポイントはユーザー ID アクセスモードで、サインインした利用者に適用される OneLake のロールを使って Lakehouse のテーブルを読み取る。接続には Fabric アイテムの権限も必要で、テーブルのデータ操作は読み取り専用。 [SQL 分析エンドポイント](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-sql-analytics-endpoint)、[SQL 分析エンドポイントの OneLake セキュリティ](https://learn.microsoft.com/en-us/fabric/onelake/security/sql-analytics-endpoint-onelake-security)。行・列のアクセス制御を適用したテーブルは、エンジンの対応範囲や認証モードを確認する。サードパーティーの認可済みエンジン経由は公開プレビュー。

[OneLake Catalog Overview](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)、[OneLake Catalog Item Details](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-item-details)、[Secure Your Fabric Data](https://learn.microsoft.com/en-us/fabric/governance/secure-your-data)、[Read Data Secured with OneLake Security](https://learn.microsoft.com/en-us/fabric/onelake/security/read-secured-data)、[OneLake security overview](https://learn.microsoft.com/en-us/fabric/onelake/security/fabric-onelake-security)

Fabric はテナントの capacity で SQL 計算を提供し、OneLake が Lakehouse のファイルを保持する。利用者はワークスペース、capacity、アイテム、OneLake Security ロールとアクセスモードを設定できるが、サービス内部の計算・保存ノードを直接操作しない。Entra の ID と Fabric ワークスペースは別の管理対象として示す。SQL エンドポイントの利用にはアイテムの Read 権限も必要。この構成と権限設定は資料を組み合わせた例で実動作未検証。[Fabric capacity](https://learn.microsoft.com/en-us/fabric/enterprise/licenses)、[OneLake SQL セキュリティ](https://learn.microsoft.com/en-us/fabric/onelake/security/sql-analytics-endpoint-onelake-security)
