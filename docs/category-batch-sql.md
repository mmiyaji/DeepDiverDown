# バッチ・SQL エンジンの違い

同じ「SQL でデータを処理する」でも、どこで動き、どう広げ、データをどこに置くかが大きく違います。

| 観点 | Apache Spark | Trino | DuckDB | ClickHouse |
| --- | --- | --- | --- | --- |
| 実行モデル | Driver が Job を Stage・Task に分け、Executor が並列に実行する DAG 型。変換は遅延評価 | Coordinator が計画し、Worker の Task が Split を処理する MPP 型。Exchange で Stage をつなぐ | 1 プロセスに組み込むプッシュ型のベクトル化実行。2,048 行単位のチャンクが演算子を流れる | ベクトル化された列指向実行。シャードごとに並列に読み、結果を集める |
| スケール | Executor を増やして水平に広げる。Standalone・YARN・Kubernetes で動く | Worker を足して広げる。Coordinator は 1 つ | 1 台の中のマルチスレッドで並列化する | Distributed テーブルでシャード分割、ReplicatedMergeTree で複製 |
| ストレージとの関係 | 計算と分離。HDFS や S3 を読み書きし、Shuffle の中間データは Executor のローカルに置く | 自前のストレージを持たず、Connector 経由で S3 や RDB を読む | 単一ファイルの独自形式を持ち、Parquet や S3 も拡張で直接読める | MergeTree のパートと疎インデックスに保存。Cloud ではオブジェクトストレージ |
| 得意な処理 | 大規模な ETL、SQL 集計、Join、反復処理 | 複数のデータソースをまたぐ対話的な分析 SQL | 手元の分析、データの下ごしらえ、アプリへの組み込み | 大量データへの高速な集計クエリ、ログや指標の分析 |
| 運用形態 | アプリケーションを投入して動かす。自前クラスターやマネージド基盤 | 常駐するクラスターを自前で運用する OSS | ライブラリとして組み込み、サーバーは不要 | 自前運用（Server と Keeper）か ClickHouse Cloud |

## 選び方の目安

- **データが大きく、変換処理を組みたい**：Spark
- **今あるデータの置き場所を変えずに SQL で横断したい**：Trino
- **1 台で済む規模を、手軽に速く分析したい**：DuckDB
- **同じ表に何度も集計を投げ、応答の速さが大事**：ClickHouse

## 公式資料

- [Spark Cluster Mode Overview](https://spark.apache.org/docs/latest/cluster-overview.html)
- [Trino Concepts](https://trino.io/docs/current/overview/concepts.html)
- [DuckDB Internals Overview](https://duckdb.org/docs/2.0/internals/overview.html)
- [ClickHouse Architecture Overview](https://clickhouse.com/docs/academic_overview)
