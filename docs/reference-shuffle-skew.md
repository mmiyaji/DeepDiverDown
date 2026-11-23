# 分散実行：シャッフルとデータスキュー

## 1. 処理の境界

受注明細を日付で絞り、顧客マスタと customer_id で結合する。両入力が結合キーで同じように分割されていない場合、この例ではシャッフルを伴う結合を使う。保存時の日付パーティションと、実行時の分割は別の単位である。

## 2. シャッフルと並列実行

スキャンが出力した行を customer_id のハッシュなどで振り分け、両入力の同じキーを同じ結合タスクで扱えるようにする。タスク間・ワーカー間でデータを移すため、ネットワーク転送やメモリ使用、ディスクへのスピルが発生しうる。

## 3. スキューの発見と対処

少数のキーに明細が集中すると、同じキーの処理が偏り、一部タスクの完了が遅れる。実行計画で処理バイトやタスク時間の分布を確認する。Spark の AQE は対応する結合で偏ったパーティションを分割し、必要に応じて対向側のデータを複製する。小さい側を配布できる場合はブロードキャスト結合も候補になるが、各ワーカーでメモリを使う。

## 公式資料

- [Apache Spark · Shuffle operations](https://spark.apache.org/docs/latest/rdd-programming-guide.html#shuffle-operations)
- [Apache Spark · Performance Tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html#optimizing-skew-join)
- [Google Cloud · Query plan and timeline](https://cloud.google.com/bigquery/docs/query-plan-explanation)

## 4. 実装例：Spark SQL Adaptive Query Execution

Spark SQL で受注明細と顧客マスタを結合する例。Adaptive Query Execution が対象の結合で偏ったシャッフル分割を分けられる場合を示す。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 受注明細・日付範囲 | 日付で分けた Parquet 受注明細 | 対象期間の注文を読む。 |
| 顧客マスタ | Parquet の顧客マスタ | 顧客キーと属性を読み込む。 |
| 結合キーでのデータ再分配 | Spark SQL の Shuffle Exchange | customer_id で関連する行を同じ分割へ送る。 |
| 均等な分割の結合タスク、偏った分割の結合タスク | Spark Executor 上の結合タスク | 対象となる偏りを AQE が検出すると、必要に応じて再分割し反対側を複製する。 |
| 実行タスクの観測 | Spark UI の SQL と Stage | 物理計画やタスクのシャッフル読取量、時間を確認する。 |
| 結合結果 | 出力用 Parquet テーブル | 顧客属性を付けた注文を保存する。 |

実装で加わる部品を以下に示す。

- AQE と偏り検出の設定。spark.sql.adaptive.skewJoin.enabled を使い、分割サイズのしきい値と中央値に対する倍率を確認する。

公式資料

- [Apache Spark · Shuffle operations](https://spark.apache.org/docs/latest/rdd-programming-guide.html#shuffle-operations)
- [Apache Spark · Performance Tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html#optimizing-skew-join)
- [Google Cloud · Query plan and timeline](https://cloud.google.com/bigquery/docs/query-plan-explanation)
- [Spark Web UI](https://spark.apache.org/docs/latest/web-ui.html)
