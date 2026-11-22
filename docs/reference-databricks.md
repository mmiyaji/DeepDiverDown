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
図は Source、Ingest、Object storage、Transform、Unity Catalog、SQL/Query、BI/Serving の7ノードで、取り込みから分析までを追う。

## 6. 参考資料
- [Databricks reference architectures](https://docs.databricks.com/aws/en/lakehouse-architecture/reference)
