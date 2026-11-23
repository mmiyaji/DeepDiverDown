# Spark SQL：AQE と Join・データスキュー

## 1. 対象と前提

shuffle の実測統計を使って Join 方式や partition を調整する適応実行を追う。 Apache Spark 4.3 の資料を基準とし、外部コネクターの対応バージョンを別途確認する。

## 2. 構成部品

- **入力と推定統計**：データソースとカタログの統計で初期計画を選ぶ。
- **初期物理計画**：Join と Exchange を含む計画を準備する。
- **Shuffle 書き込み**：map 側がデータを partition に再分配して実測サイズを作る。
- **実行時統計**：materialized な query stage の partition サイズなどを AQE が受け取る。
- **適応的再計画**：条件を満たす場合に小 partition 結合、skew 分割、Join 変更を行う。
- **下流 Join と集約**：更新後の計画で下流を処理する。
- **結果**：クエリ結果またはテーブルに出力する。

## 3. 処理と注意点

1. 入力と推定統計 → 初期物理計画：統計で初期計画。
2. 初期物理計画 → Shuffle 書き込み：shuffle を実行。
3. Shuffle 書き込み → 実行時統計：partition サイズを報告。
4. 実行時統計 → 適応的再計画：実測値で再計画。
5. 適応的再計画 → 下流 Join と集約：下流の Join を決定。
6. Shuffle 書き込み → 下流 Join と集約：shuffle を読み戻す。
7. 下流 Join と集約 → 結果：結果を出力。

- AQE は Spark 3.2 以降デフォルト有効。実測に応じ sort-merge join から broadcast hash join へ変える場合がある。
- skew 対策の分割、サイズに基づく partition 結合は条件と設定に依存する。broadcast はメモリ・転送コストも考慮する。

### 内部の仕組み

Query stage の実行結果が確定すると、map 出力の partition 統計を用いて残りの計画を見直す。既に実行・書き込み済みの処理までなかったことにはならない。

複数の小さい shuffle partition は結合され、skewed join の極端に大きい partition は条件に応じて分割できる。すべての偏りが自動で解消されるわけではない。

小さい側を実測して sort-merge join から broadcast hash join に変更する場合、既に行った shuffle の費用は残る。最初から正しく broadcast を選べた場合と比較する。

## 4. 実装例：Spark Standalone

自己管理のホスト群で Spark Standalone の Master と Worker を運用し、Driver と Executor を実行する。図中の対応は以下の通り。実装資料を組み合わせた説明用構成であり、実機検証済み構成や実在の導入事例ではない。対象製品・Spark・Scala・JDK の組み合わせ、セキュリティ、入力と出力は個別に確認する。

- 入力と推定統計：クラスター外のクライアント・ストレージ等。
- 初期物理計画：Spark Driver 側。
- Shuffle 書き込み：Spark Executor 側。
- 実行時統計：Spark Driver 側。
- 適応的再計画：Spark Driver 側。
- 下流 Join と集約：Spark Executor 側。
- 結果：クラスター外のクライアント・ストレージ等。

公式資料：[Spark SQL performance tuning](https://spark.apache.org/docs/4.3.0/sql-performance-tuning.html)、[Spark SQL UI](https://spark.apache.org/docs/4.3.0/web-ui.html)。
