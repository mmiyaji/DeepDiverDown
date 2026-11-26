# クラウド分析基盤の違い

| 観点 | Snowflake | Databricks | BigQuery | Amazon Redshift | Microsoft Fabric |
| --- | --- | --- | --- | --- | --- |
| 特徴 | **コンピュートとストレージの分離** と、用途別ウェアハウスで同時実行を分ける | **Delta とレイクハウス** に寄せた統合基盤。Photon で SQL を高速化 | **サーバーレスのスロット実行型** DWH。Iceberg レイクハウスにも対応 | **AWS 上のクラスター／Serverless 型** DWH。S3 とゼロ ETL に広がる | **OneLake 1 つ** に Lakehouse と Warehouse を載せた SaaS |
| 実行・課金の単位 | 仮想ウェアハウスのクレジット（サイズ・秒単位） | SQL Warehouse やジョブの計算資源 | ジョブとスロット（オンデマンドは処理量、容量は予約スロット） | クラスター（ノード）か Serverless の RPU | 容量（F SKU の CU）とワークスペース |
| データの置き場 | **マイクロパーティション**（列指向）。Iceberg は外部ボリュームにも置ける | 顧客のクラウドストレージ上の **Delta**（Parquet とログ）。Unity Catalog が管理 | **管理ストレージ**（Capacitor）。Iceberg は利用者の Cloud Storage | Redshift Managed Storage と S3 の外部表（Parquet・Iceberg） | **OneLake**（Delta Parquet）。ショートカットで S3・ADLS を同じ名前空間に見せる |
| 得意な用途 | SQL の BI・DWH、アカウント間の共有、Time Travel による復旧 | ETL・ストリーミング・SQL・機械学習を同じテーブルで扱う | 大規模な SQL 分析、ストレージとコンピュートを分けた運用 | 結合・集計中心の BI、運用 DB の取り込み | Power BI の Direct Lake、Spark と T-SQL の併用 |
| 注意点 | 結果再利用・Optima などは **適用条件が別々** | Liquid Clustering の AUTO などは **対象表・ランタイム・費用に条件** がある | **スロット競合** と、Iceberg の Preview 範囲 | **分散キー設計** が結合性能に効く。Iceberg 書き込みの提供段階は未確認 | Lakehouse の SQL 入口は **読み取り専用**。F64 未満は閲覧者にもライセンスが要る |

数値と提供段階（GA・Preview）は 2026 年 11 月時点の公式資料に基づき、性能値はプロジェクトや提供元の自己申告です。確認できなかった点は、各図の「未確認」に書いています。

次のサービスは、図にせず、位置づけだけを書きます。名称や提供範囲は、各社の資料で確認します。

- **Azure Synapse**：Fabric への移行が案内されています。専用 SQL プールの提供終了日は未確認です。
- **Amazon Athena**：S3 のデータを SQL で読む、サーバーレスのクエリ基盤です。「バッチ・SQL エンジン」の分類で比べます。
- **Dremio・Starburst**：Iceberg 上のクエリ基盤（Starburst は Trino の商用版）です。Trino の図と重複するため、図にしません。
- **MotherDuck**：DuckDB を拡張したクラウドサービスです。
- **Oracle・Teradata**：従来型の DWH ベンダーです。公式資料で確認できていない点があるため、図にしていません。

## 選び方

- 用途別ウェアハウスで同時実行を分け、アカウント間で共有する → **Snowflake**
- ETL・ストリーミング・機械学習を、同じ Delta テーブルで扱う → **Databricks**
- スロット課金で、サーバーレスに大規模な SQL を実行する → **BigQuery**
- AWS のサービスと S3 の外部表を、組み合わせて使う → **Amazon Redshift**
- Power BI を中心に、OneLake に集約する → **Microsoft Fabric**

## 公式資料

- [Snowflake Documentation](https://docs.snowflake.com/)
- [Databricks Documentation](https://docs.databricks.com/)
- [BigQuery Documentation](https://cloud.google.com/bigquery/docs)
- [Amazon Redshift Documentation](https://docs.aws.amazon.com/redshift/)
- [Microsoft Fabric Documentation](https://learn.microsoft.com/fabric/)
