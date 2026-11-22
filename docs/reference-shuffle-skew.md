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
