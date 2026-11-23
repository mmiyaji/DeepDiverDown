# Databricks レイクハウス参照アーキテクチャ

## 1. 範囲
外部データを取り込み、ストレージ上のテーブルを変換し、Unity Catalog 管理下でクエリ・提供・分析する流れを示す。

出典 [Databricks reference architectures](https://docs.databricks.com/aws/en/lakehouse-architecture/reference)

## 2. Source と Ingest
参照アーキテクチャは Source、Ingest、Transform、Query/Process、Serve、Analysis、Storage のレーンで整理される。バッチとストリーミングの入口を選べる。

## 3. Storage と Transform
オブジェクトストレージにデータとAI資産を置き、Spark等の処理で整備する。テーブル形式や実行基盤の詳細は構成に依存する。

## 4. Governance と利用
Unity Catalog はデータを統治し、Databricks SQLなどからクエリできる。分析や提供先は用途に応じて選ぶ。

出典 [Databricks reference architectures](https://docs.databricks.com/aws/en/lakehouse-architecture/reference)

## 5. シナリオ
取り込みと表の整備から、Unity Catalog を経由した分析、外部共有、モデル学習までを追う。各詳細図で処理の境界と運用上の確認事項を検討できる。

| 図の部品 | 詳細リファレンス | 観察するもの |
|---|---|---|
| Lakeflow・取り込み | [Lakeflow の CDC と品質管理](reference-databricks-lakeflow.md) | Connect、Auto Loader、Spark Declarative Pipelines、Jobs |
| Unity Catalog | [権限・ストレージ・リネージ](reference-databricks-unity-catalog.md) | メタストア、ワークスペース、管理／外部テーブル、列リネージ |
| Databricks SQL | [実行プロファイルとファイル配置](reference-databricks-sql-performance.md) | SQL Warehouse、Photon、Liquid clustering、保守 |
| OpenSharing | [共有の接続と失効](reference-databricks-open-sharing.md) | Databricks と外部クライアントへの共有経路 |
| MLflow と Model Serving | [モデルの版管理](reference-databricks-mlflow-serving.md) | 学習の追跡、UC への登録、推論時の配備 |
| AI Search | [索引更新と検索](reference-databricks-ai-search.md) | Delta Sync、埋め込み、検索とアクセス権 |

## 6. 参考資料
- [Databricks reference architectures](https://docs.databricks.com/aws/en/lakehouse-architecture/reference)

## 7. データの共有

取引先に公開する注文集計は OpenSharing の Share にまとめ、受領者とアクセス範囲を設定する。利用できる認証方式と資産は、Databricks 内での利用か外部クライアントかで異なる。 [OpenSharing](https://docs.databricks.com/aws/en/opensharing)

## 8. 機械学習と配備

整備したテーブルを学習に利用し、MLflow で実験と成果物を追跡する。選んだモデルを Unity Catalog に版として登録し、必要な場合は明示した版で Model Serving に配備する。 [モデルライフサイクル](https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle/) · [Model Serving](https://docs.databricks.com/aws/en/machine-learning/model-serving/)

## 9. 実装例 Databricks on AWS の注文レイクハウス

S3 の着地先を登録し、取込から BI・共有・モデル配備までを一つの Databricks ワークスペースの運用単位として構成する例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 外部データ源 | Amazon S3 の到着ファイル | 入力ファイルをソース別プレフィックスに配置する。 |
| 増分データ取り込み・変換・品質管理 | Lakeflow Spark Declarative Pipelines | Auto Loader で到着ファイルを取得し、同じパイプラインの後続段で品質ルールを適用する。 |
| オブジェクトストレージ | Delta テーブルのストレージ | 管理テーブルの保存領域はカタログの設定に従う。 |
| 権限・リネージカタログ | Unity Catalog | アクセス許可、データの名前空間、リネージを管理する。 |
| SQL クエリの計算資源 | Databricks SQL Warehouse | 注文集計を提供する。 |
| 分析結果の利用先 | Databricks ダッシュボード | SQL Warehouse の集計を表示する。 |
| 別組織へのデータ公開 | OpenSharing の Share と Recipient | 公開用資産と受領者を管理する。 |
| モデルの登録・配備 | MLflow と Model Serving | モデル成果物を登録し承認済みの版を配備する。 |

着地ファイルの外部ロケーションと、整備済み Delta 管理テーブルの保存領域を分ける。BI、共有、モデル配備には用途に応じたアクセス権を付与する。

出典 [Databricks reference architectures](https://docs.databricks.com/aws/en/lakehouse-architecture/reference)、[OpenSharing](https://docs.databricks.com/aws/en/opensharing)、[Model Serving](https://docs.databricks.com/aws/en/machine-learning/model-serving/)、[Databricks の S3 外部ロケーション](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/s3)、[Auto Loader](https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/)
