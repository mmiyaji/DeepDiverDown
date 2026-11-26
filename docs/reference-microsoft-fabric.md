# Microsoft Fabric の基本アーキテクチャ

2026 年 11 月時点の公式資料に基づく。

## 1. 位置づけ

Fabric は、取り込み、Spark、SQL ウェアハウス、リアルタイム分析、Power BI を一つの SaaS にまとめたデータ分析基盤である。データはテナントごとに一つの OneLake に置き、計算は容量（Capacity Unit）単位で共有する。この図は、Lakehouse 経路と Warehouse 経路が OneLake と Power BI で合流する流れを示す。Azure Synapse Analytics からの移行は Fabric Data Warehouse の Migration Assistant が対象に含める。Synapse の提供終了日は取得した資料で未確認。

[Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview)、[Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/data-warehousing)

## 2. OneLake と取り込み

OneLake はテナントに一つの論理データレイクで、Fabric の各項目のデータを Delta Parquet で保持する。Lakehouse と Warehouse のデータはどちらも OneLake にある。取込パイプラインは外部データを Lakehouse の Files か Warehouse にコピーする。外部ストレージのデータをコピーせずに見せる仕組みは「OneLake とショートカット」の図で追う。

[OneLake](https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview)

## 3. Lakehouse と Spark

Lakehouse は Files（原本）と Tables（Delta テーブル）を持つ。Spark ノートブックが Files を整えて Tables に書く。Lakehouse のテーブルを更新するのは Spark で、T-SQL では更新できない。

[Fabric Lakehouse](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-overview)

## 4. Warehouse と SQL 分析エンドポイント

Warehouse は T-SQL の書き込みとマルチテーブルのトランザクションを持つ。Lakehouse には読み取り専用の SQL 分析エンドポイントが自動で付く。どちらも同じ SQL エンジンで動く。違いと同期の仕組みは「Warehouse と SQL 分析エンドポイント」の図で追う。

[Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/data-warehousing)、[SQL analytics endpoint](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-sql-analytics-endpoint)

## 5. セマンティックモデルと Power BI

Power BI のセマンティックモデルは、指標とリレーションを定義する。Direct Lake では OneLake の Delta テーブルから必要な列を読み込んで応答する。詳細は「Direct Lake と Power BI」の図で追う。

[Direct Lake overview](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview)

## 6. 発見・容量・ワークスペース

OneLake catalog で資産を探す。詳細は [OneLake catalog の図](reference-fabric-onelake-catalog.md) を参照する。ワークスペースは項目の入れ物で、容量に割り当てる。F SKU は Azure で購入し、Azure が秒単位で課金する。F64 以上では、閲覧者ロールの利用者は Fabric の無料ライセンスで Power BI の内容を見られる。F64 未満では Pro などのライセンスが要る。

[OneLake catalog](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)、[Fabric licenses and capacity](https://learn.microsoft.com/en-us/fabric/enterprise/licenses)

## 7. 実装例 Microsoft Fabric の注文レイクハウス

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 受注データ | Azure Blob Storage | 受注 CSV |
| 取込パイプライン | Data Factory の Copy activity | Files へのコピー、Warehouse へのロード |
| Lakehouse・Spark | Lakehouse と Fabric Spark ノートブック | Files の原本、Tables の Delta |
| Warehouse | Fabric Warehouse | T-SQL で更新する表 |
| OneLake | OneLake | Delta Parquet |
| SQL 読み取り口 | SQL 分析エンドポイント | 読み取り専用の T-SQL |
| セマンティックモデル・レポート | Power BI | Direct Lake のモデルとレポート |
| 資産の検索 | OneLake catalog | 検索と認定 |
| 計算の単位 | Fabric 容量（F SKU） | ワークスペースの割り当て |

公式資料を組み合わせた代表構成であり、動作検証済みの導入事例ではない。Microsoft が Fabric と OneLake の基盤を運用し、利用者は容量、ワークスペース、接続、データ、モデル、権限を管理する。Spark や SQL の内部ホストは直接操作しない。Blob への接続方式、容量の大きさ、Direct Lake の制約は実環境で確認する。Azure と Fabric に AWS 用の管理区分は使わない。

出典 [Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview)、[OneLake](https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview)、[Fabric Lakehouse](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-overview)、[SQL analytics endpoint](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-sql-analytics-endpoint)、[Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/data-warehousing)、[Direct Lake overview](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview)、[Fabric licenses and capacity](https://learn.microsoft.com/en-us/fabric/enterprise/licenses)、[OneLake catalog](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)、[Copy activity](https://learn.microsoft.com/en-us/fabric/data-factory/copy-data-activity)
