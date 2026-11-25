# バッチ・SQL エンジンの違い

| 観点 | Apache Spark | Trino | DuckDB | ClickHouse |
| --- | --- | --- | --- | --- |
| 特徴 | **大規模な変換処理** の定番 | **データを動かさず** SQL で横断 | **1 台で完結** する組み込み型 | **集計の速さ** に特化 |
| 実行モデル | Driver が Job を Stage・Task に分け、**Executor が並列実行** | Coordinator が計画し、**Worker が Split を処理** | アプリの **プロセス内** で 2,048 行ずつ処理 | シャードごとに **列単位で並列に読む** |
| スケール | **Executor を足す**（YARN・Kubernetes など） | **Worker を足す**。Coordinator は 1 台 | **1 台のコア数まで** | **シャードとレプリカ** を足す |
| データの置き場所 | 外部（**HDFS・S3**）。中間データは Executor のローカル | **持たない**。Connector で S3・RDB を読む | **単一ファイル**。Parquet・S3 も直接読める | **自前の MergeTree**。Cloud ではオブジェクトストレージ |
| 向いている処理 | ETL、Join、**反復処理** | 複数ソースへの **対話的な分析** | 手元の分析、**前処理**、アプリへの組み込み | ログ・指標への **繰り返しの集計** |
| 動かし方 | ジョブとして **投入** | クラスターを **常駐** させて自前運用 | **ライブラリ**。サーバー不要 | 自前運用（Server＋Keeper）か **ClickHouse Cloud** |

## 選び方

- 毎晩の大きな変換ジョブ → **Spark**
- S3 と RDB にあるデータを、移さずに結合したい → **Trino**
- ノート PC や 1 台のサーバーで、Parquet を速く読みたい → **DuckDB**
- ダッシュボードから同じ表へ何度も集計を投げる → **ClickHouse**

## 公式資料

- [Spark Cluster Mode Overview](https://spark.apache.org/docs/latest/cluster-overview.html)
- [Trino Concepts](https://trino.io/docs/current/overview/concepts.html)
- [DuckDB Internals Overview](https://duckdb.org/docs/2.0/internals/overview.html)
- [ClickHouse Architecture Overview](https://clickhouse.com/docs/academic_overview)
