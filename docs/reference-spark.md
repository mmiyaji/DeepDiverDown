# Apache Spark の基本アーキテクチャ

## 1. 読み方と範囲

Spark のクラスタモードで、1つのバッチアプリケーションが動く流れを示す。図の Executor 2基とストレージは説明用の配置。クラスタマネージャーには Spark Standalone、YARN、Kubernetes のいずれかを使える。図はアプリケーション内の役割とデータの流れを示し、実測値や個別環境の設定は持たない。

出典 [Apache Spark Cluster Mode Overview](https://spark.apache.org/docs/latest/cluster-overview.html)

## 2. アプリケーションの投入

利用者やジョブ管理ツールが `spark-submit` でアプリケーションを投入する。Driver はメインプログラムを実行し、`SparkContext` を通じて分散実行を調整する。Client モードでは投入プロセス内で Driver が動き、Cluster モードではクラスタ側が Driver を起動する。図の矢印は投入から Driver 実行に至る流れを示す。

出典 [Submitting Applications](https://spark.apache.org/docs/latest/submitting-applications.html)・[Cluster Mode Overview](https://spark.apache.org/docs/latest/cluster-overview.html)

## 3. 資源割り当てと実行プロセス

Driver はクラスタマネージャーを通じて実行資源を確保する。クラスタマネージャーはアプリケーション間の資源を割り当て、ワーカーノードに Executor を配置する。Executor はアプリケーション専用のプロセスで、Task の実行やキャッシュを担当する。Driver と Executor は接続できる必要がある。

出典 [Cluster Mode Overview](https://spark.apache.org/docs/latest/cluster-overview.html)・[Job Scheduling](https://spark.apache.org/docs/latest/job-scheduling.html)

## 4. Job・Stage・Task

`filter` などの変換は遅延評価され、`count` や結果の保存といったアクションを契機に処理が実行される。Job は依存関係をもとに Stage に分かれ、Driver が Stage 内の Task を Executor に配る。各 Task は担当パーティションを処理する。

出典 [RDD Programming Guide の RDD Operations](https://spark.apache.org/docs/latest/rdd-programming-guide.html#rdd-operations)・[Cluster Mode Overview の用語集](https://spark.apache.org/docs/latest/cluster-overview.html#glossary)

## 5. 入力と Shuffle

ファイルを入力とする例では、Executor が担当データを外部ストレージから並列に読む。`groupBy` のように同じキーのレコードをまとめる処理は、パーティションをまたぐデータ再分配が必要になる場合がある。Shuffle では上流の Task が中間出力を分割し、下流の Task が必要なブロックを取得する。図は Executor 間のデータ移動の一例を表す。

出典 [RDD Programming Guide の External Datasets](https://spark.apache.org/docs/latest/rdd-programming-guide.html#external-datasets)・[Shuffle Operations](https://spark.apache.org/docs/latest/rdd-programming-guide.html#shuffle-operations)

## 6. 結果の出力

ファイル出力の例では、Executor 上の Task が出力先に書き込む。小さな結果なら `collect()` で Driver に持ち帰れる。図はストレージへの保存を表し、保存形式や公開の扱いは選んだ出力先に依存する。

出典 [RDD Programming Guide の Actions](https://spark.apache.org/docs/latest/rdd-programming-guide.html#actions)

## 7. パーティション喪失時の再計算

RDD は依存関係を使って失われたパーティションを再計算できる。図は、Task を別の Executor に再割り当てし、必要な入力を読み直す例を示す。失われたデータの種類や保存設定によって再計算の範囲は変わる。

出典 [RDD Programming Guide の Overview](https://spark.apache.org/docs/latest/rdd-programming-guide.html#overview)・[RDD Persistence](https://spark.apache.org/docs/latest/rdd-programming-guide.html#rdd-persistence)

## 8. 実装例：Spark Standalone と HDFS

Spark Standalone のクラスターに売上集計を投入し、HDFS を入力・出力で共用する例。Driver は cluster モードで Worker 上に起動し、タスクは各 Executor で動く。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| アプリケーションの投入元 | spark-submit | アプリケーション JAR を cluster モードで投入する。 |
| クラスター資源管理 | Standalone Master | Worker 登録と Executor の資源割当を担う。 |
| ジョブの調整プロセス | Worker 上の Driver JVM | ジョブをステージに分けてタスクを割り当てる。 |
| タスク実行担当 A | Worker A 上の Executor JVM | Worker A のローカルディスクをシャッフルに使う。 |
| タスク実行担当 B | Worker B 上の Executor JVM | Worker B で独立したタスクを実行する。 |
| 入力データ、集計結果 | HDFS 上の入力・出力パス | 入力と集計結果を異なる HDFS パスで保持する。 |

実装で加わる部品を以下に示す。

- アプリケーション JAR。注文集計のコードをパッケージ化し、投入時に指定する。

公式資料

- [Apache Spark Cluster Mode Overview](https://spark.apache.org/docs/latest/cluster-overview.html)
- [Submitting Applications](https://spark.apache.org/docs/latest/submitting-applications.html)
- [RDD Programming Guide](https://spark.apache.org/docs/latest/rdd-programming-guide.html)
- [Job Scheduling](https://spark.apache.org/docs/latest/job-scheduling.html)
- [Spark Standalone Mode](https://spark.apache.org/docs/latest/spark-standalone.html)
