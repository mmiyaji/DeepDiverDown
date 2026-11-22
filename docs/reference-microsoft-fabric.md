# Microsoft Fabric の基本アーキテクチャ

## 1. OneLake とワークスペース

OneLake は Fabric テナントの論理データレイクで、ワークスペースや項目を通じてデータが整理される。この例では Lakehouse を作り、受注データを処理する。

## 2. 取り込みと整備

Fabric のパイプラインが受注データを Lakehouse の Files 領域へ取り込み、Spark ノートブックが型や欠損値を確認して管理対象の Delta テーブルに書き出す。Files と Tables のデータはどちらも OneLake に置かれる。

## 3. SQL と Power BI

Lakehouse 作成時に用意される SQL 分析エンドポイントで Delta テーブルを T-SQL から参照する。テーブルの更新は Spark 側で行う。Power BI のセマンティックモデルはこの SQL 接続を利用できる。Fabric Warehouse はこの例の Lakehouse とは別の項目である。

## 公式資料

- [Microsoft Learn · Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview)
- [Microsoft Learn · OneLake](https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview)
- [Microsoft Learn · SQL analytics endpoint](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-sql-analytics-endpoint)
- [Microsoft Learn · Fabric Lakehouse](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-overview)
