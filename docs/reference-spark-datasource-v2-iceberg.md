# Spark：Data Source V2 と Iceberg の読み書き

## 1. 対象と前提

Spark とテーブルコネクターが pushdown、入力分割、書き込みと commit を調整する。 Apache Spark 4.3 の資料を基準とし、外部コネクターの対応バージョンを別途確認する。

## 2. 構成部品

- **SQL / DataFrame**：列・条件・テーブルを指定する。
- **Catalog / Table**：テーブルを解決し connector の capability を Spark に公開する。
- **ScanBuilder の交渉**：connector が受理した filter と必要列を計画し、残りは Spark が評価する。
- **Iceberg メタデータ**：snapshot と manifest から対象ファイルの候補を計画する。
- **InputPartition と Reader**：入力分割ごとに task が Parquet 等を読む。
- **Task の DataWriter**：各 task がデータファイルを書き、commit message を Driver に返す。
- **Driver の BatchWrite commit**：成功した task の commit message を集約し connector が表の更新を commit する。
- **データファイル**：データファイルの所在と最新 snapshot は分けて管理される。

## 3. 処理と注意点

1. SQL / DataFrame → Catalog / Table：テーブルを解決。
2. Catalog / Table → ScanBuilder の交渉：scan を構築。
3. SQL / DataFrame → ScanBuilder の交渉：列と条件を交渉。
4. Iceberg メタデータ → ScanBuilder の交渉：snapshot と manifest を参照。
5. ScanBuilder の交渉 → InputPartition と Reader：入力分割を作成。
6. データファイル → InputPartition と Reader：必要なファイルを読む。
7. InputPartition と Reader → Task の DataWriter：変換結果を書き込む。
8. Task の DataWriter → データファイル：データファイルを保存。
9. Task の DataWriter → Driver の BatchWrite commit：task commit を報告。
10. Driver の BatchWrite commit → Iceberg メタデータ：表の更新を commit。

- Data Source V2 は connector が実装する能力だけ利用できる。残った条件を Spark が評価するため、pushdown と厳密なフィルタリングを混同しない。
- Iceberg の write.distribution-mode は none / hash / range があり、実際の利用可能性や既定値はバージョンと設定を確認する。

### 内部の仕組み

ScanBuilder が filter や required columns の受理を交渉し、Scan、Batch、InputPartition、PartitionReaderFactory に進む。connector が処理できない残りの filter は Spark で評価する。

Iceberg は snapshot と manifest を用いて読むべきファイルを絞り、Parquet reader で列や row group を読み取る。manifest の pruning と Parquet の読み取り最適化は別段階。

write では DataWriter が task 単位でファイルと commit message を作り、Driver の BatchWrite がコミットをまとめる。失敗時の abort と未参照ファイルの扱いは connector の仕様を確認する。

## 4. 実装例：Spark Standalone

自己管理のホスト群で Spark Standalone の Master と Worker を運用し、Driver と Executor を実行する。実装資料を組み合わせた説明用構成であり、実機検証済み構成や実在の導入事例ではない。対象製品・Spark・Scala・JDK の組み合わせ、セキュリティ、入力と出力は個別に確認する。

| 機能配置 | 実装例の部品 |
| --- | --- |
| SQL / DataFrame | SQL / DataFrame |
| Catalog / Table | Driver：Catalog / Table |
| ScanBuilder の交渉 | Driver：ScanBuilder の交渉 |
| Iceberg メタデータ | Iceberg メタデータ |
| InputPartition と Reader | Executor：InputPartition と Reader |
| Task の DataWriter | Executor：Task の DataWriter |
| Driver の BatchWrite commit | Driver：Driver の BatchWrite commit |
| データファイル | データファイル |

Iceberg メタデータとデータファイルは、自前のサーバー群のうち Spark Standalone クラスターの外側に置く。ストレージの実装とホストの割り当ては未指定である。

公式資料：[Spark Data Source V2](https://spark.apache.org/docs/4.3.0/sql-v2-data-sources.html)、[Iceberg Spark Writes](https://iceberg.apache.org/docs/latest/spark-writes/)、[Iceberg Spark Queries](https://iceberg.apache.org/docs/latest/spark-queries/)。
