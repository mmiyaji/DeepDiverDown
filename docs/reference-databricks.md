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

## 6. 参考資料
- [Databricks reference architectures](https://docs.databricks.com/aws/en/lakehouse-architecture/reference)

## 7. データの共有

取引先に公開する注文集計は OpenSharing の Share にまとめ、受領者とアクセス範囲を設定する。利用できる認証方式と資産は、Databricks 内での利用か外部クライアントかで異なる。 [OpenSharing](https://docs.databricks.com/aws/en/opensharing)

## 8. 機械学習と配備

整備したテーブルを学習に利用し、MLflow で実験と成果物を追跡する。選んだモデルを Unity Catalog に版として登録し、必要な場合は明示した版で Model Serving に配備する。 [モデルライフサイクル](https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle/) · [Model Serving](https://docs.databricks.com/aws/en/machine-learning/model-serving/)
