# Microsoft Fabric の基本アーキテクチャ

## 1. OneLake とワークスペース

OneLake は Fabric テナントの論理データレイクで、ワークスペースや項目を通じてデータが整理される。この例では Lakehouse を作り、受注データを処理する。

## 2. 取り込みと整備

Fabric のパイプラインが受注データを Lakehouse の Files 領域へ取り込み、Spark ノートブックが型や欠損値を確認して管理対象の Delta テーブルに書き出す。Files と Tables のデータはどちらも OneLake に置かれる。

## 3. SQL と Power BI

Lakehouse 作成時に用意される SQL 分析エンドポイントで Delta テーブルを T-SQL から参照する。テーブルの更新は Spark 側で行う。Power BI のセマンティックモデルはこの SQL 接続を利用できる。Fabric Warehouse はこの例の Lakehouse とは別の項目である。

## 4. 資産の発見とガバナンス

OneLake catalog から Fabric の資産を探す。発見できることと、SQL エンドポイントやストレージへの読み取り権限はそれぞれ確認する。探索、アクセスの申請、運用管理は [OneLake catalog の詳細図](reference-fabric-onelake-catalog.md) を参照する。

## 公式資料

- [Microsoft Learn · Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview)
- [Microsoft Learn · OneLake](https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview)
- [Microsoft Learn · SQL analytics endpoint](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-sql-analytics-endpoint)
- [Microsoft Learn · Fabric Lakehouse](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-overview)
- [Microsoft Learn · OneLake catalog](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)

## 5. 実装例 Microsoft Fabric の注文レイクハウス

Fabric の同一ワークスペースに取込パイプライン、Lakehouse、ノートブック、Power BI レポートを置く例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 受注データ | Azure サブスクリプションの Azure Blob Storage | Fabric の接続で受注 CSV を読み出す。 |
| 取込パイプライン | Fabric Data Factory の Copy activity | 原本ファイルを OneLake の Lakehouse にコピーする。 |
| 取込ファイルの保管領域・分析用の Delta テーブル | OneLake の Lakehouse Files と Tables | 原本ファイルは Files、整備済み Delta は Tables に分ける。 |
| データ変換ノートブック | Fabric Spark ノートブック | 型変換や品質チェックを行い、分析用 Delta を書き込む。 |
| SQL 読み取り口 | Lakehouse SQL 分析エンドポイント | Lakehouse のテーブルを読み取り専用 SQL で提供する。 |
| BI レポート | Power BI 受注レポート | 公開されたセマンティックモデルの指標を表示する。 |
| データ資産カタログ | OneLake カタログ | Lakehouse などの資産を確認する。 |

Lakehouse の更新にはノートブックを使う。SQL 分析エンドポイントは Lakehouse のテーブルの参照経路である。レポートに合わせてセマンティックモデルを明示的に作成する。

Azure サブスクリプションの Azure Blob Storage に受注 CSV を置き、Fabric ワークスペースの Copy Activity が接続を使って Lakehouse の Files にコピーする。Fabric 容量に割り当てたワークスペースで、コピー成功後に Notebook Activity が Fabric 管理の Spark を起動し、Tables に Delta を保存する。

セマンティックモデルは Direct Lake on SQL で作成する。SQL 分析エンドポイントからテーブルを解決して権限を確認し、対象の Delta データを OneLake から読み取る。Power BI レポートはこのモデルの指標を表示する。実行状況は Fabric パイプラインの実行履歴で確認する。

- [Fabric の Azure Blob Storage コネクター](https://learn.microsoft.com/en-us/fabric/data-factory/connector-azure-blob-storage-copy-activity)
- [Fabric の Notebook activity と容量](https://learn.microsoft.com/en-us/fabric/data-factory/notebook-activity)
- [Direct Lake on SQL と OneLake](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-create-lakehouse)

出典 [Microsoft Learn · Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview)、[Microsoft Learn · OneLake](https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview)、[Microsoft Learn · SQL analytics endpoint](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-sql-analytics-endpoint)、[Microsoft Learn · Fabric Lakehouse](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-overview)、[Microsoft Learn · OneLake catalog](https://learn.microsoft.com/en-us/fabric/governance/onelake-catalog-overview)、[Fabric の Copy activity](https://learn.microsoft.com/en-us/fabric/data-factory/copy-data-activity)、[Power BI セマンティックモデルの作成](https://learn.microsoft.com/en-us/fabric/data-warehouse/create-semantic-model)

これは公式資料を組み合わせた代表構成であり、動作検証済みの導入事例ではない。Microsoft が Fabric・OneLake・Spark・SQL エンドポイントと Azure Storage のサービス基盤を運用し、利用者はワークスペースと容量、接続認証、パイプラインとノートブック、データ、セマンティックモデル、権限を管理する。管理 Spark や SQL の内部ホストを直接操作する想定はない。Blob への接続方式と権限、容量、Direct Lake の制約や SQL へのフォールバックは実環境で確認する。Azure/Fabric には AWS 用管理区分を流用しない。
