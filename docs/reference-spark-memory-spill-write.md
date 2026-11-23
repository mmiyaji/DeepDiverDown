# Spark：メモリ・spill とファイル書き込み

## 1. 対象と前提

Executor の execution / storage メモリ、spill、partition と出力ファイルの関係を追う。 Apache Spark 4.3 の資料を基準とし、外部コネクターの対応バージョンを別途確認する。

## 2. 構成部品

- **読み取り partition**：入力サイズとファイルの配置から task が入力を読む。
- **Executor の処理 task**：sort、join、集約のため execution メモリを使う。
- **Execution / Storage 領域**：計算用と cache 用のメモリを管理する。cache の保護領域もある。
- **ローカルディスクへの spill**：必要に応じ中間データを退避し、後で読み戻す。
- **書き込み前の分配**：partition と分布に応じ shuffle や sort を行う。
- **並列 writer**：task が出力ファイルを書き、ファイル数やサイズは分配や表 partition に影響される。
- **出力ファイルと表**：Iceberg 等では commit とファイルの後処理を管理する。

## 3. 処理と注意点

1. 読み取り partition → Executor の処理 task：入力を読む。
2. Executor の処理 task → Execution / Storage 領域：作業メモリを利用。
3. Execution / Storage 領域 → ローカルディスクへの spill：圧力時に退避。
4. ローカルディスクへの spill → Executor の処理 task：中間データを読み戻す。
5. Executor の処理 task → 書き込み前の分配：書き込み先に分配。
6. 書き込み前の分配 → 並列 writer：task がファイルを作成。
7. 並列 writer → 出力ファイルと表：出力ファイルを保存。

- Spark の unified memory の概念と、JVM heap、off-heap、Python / native メモリ、コンテナー overhead を分けて考える。
- 小ファイルは単に partition 数だけで決まらない。入力量、task、表 partition、ファイル目標サイズや処理経路が影響する。

### 内部の仕組み

JVM heap 内の unified memory は execution と storage が利用する。execution が必要とする場合、保護対象を超える cache を退避できる一方、storage は execution の使用中メモリを追い出せない。

sort・aggregation・shuffle はメモリが足りない場合にディスクへ spill する。JVM heap 以外の native / Python メモリとコンテナー memory overhead は別途必要。

Iceberg の書き込みでは distribution-mode によって要求する分配が変わり、各 task が各 table partition に書く。ファイルサイズは task の処理量と partition 分布の双方に左右される。

## 4. 実装例：Spark Standalone

自己管理のホスト群で Spark Standalone の Master と Worker を運用し、Driver と Executor を実行する。図中の対応は以下の通り。実装資料を組み合わせた説明用構成であり、実機検証済み構成や実在の導入事例ではない。対象製品・Spark・Scala・JDK の組み合わせ、セキュリティ、入力と出力は個別に確認する。

- 読み取り partition：クラスター外のクライアント・ストレージ等。
- Executor の処理 task：Spark Executor 側。
- Execution / Storage 領域：Spark Executor 側。
- ローカルディスクへの spill：Spark Executor 側。
- 書き込み前の分配：Spark Executor 側。
- 並列 writer：Spark Executor 側。
- 出力ファイルと表：クラスター外のクライアント・ストレージ等。

公式資料：[Spark Tuning](https://spark.apache.org/docs/4.3.0/tuning.html)、[Spark Configuration](https://spark.apache.org/docs/4.3.0/configuration.html)、[Iceberg Spark Writes](https://iceberg.apache.org/docs/latest/spark-writes/)。
