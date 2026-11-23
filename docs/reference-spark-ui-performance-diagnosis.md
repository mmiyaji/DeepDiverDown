# Spark UI：実行計画と性能診断

## 1. 対象と前提

SQL 演算子、Job、Stage、Task、Executor の観測値から遅延要因を追う。 Apache Spark 4.3 の資料を基準とし、外部コネクターの対応バージョンを別途確認する。

## 2. 構成部品

- **SQL UI と物理計画**：Scan、Exchange、Join などの演算子と統計を見る。
- **Job と Stage**：SQL と Job の対応、shuffle の境界と実行時間を見る。
- **Task の時間分布**：中央値と長い task を比べ偏りや straggler を検討する。
- **Shuffle / spill / GC**：読み書き量、spill、GC を他の指標や plan と合わせて解釈する。
- **永続 Event Log**：設定時にイベントを保存し、アプリ終了後の調査に使う。
- **History Server**：Event Log から終了済みアプリの UI を再構成する。

## 3. 処理と注意点

1. SQL UI と物理計画 → Job と Stage：計画から Job を追う。
2. Job と Stage → Task の時間分布：Stage の task を確認。
3. Task の時間分布 → Shuffle / spill / GC：shuffle・spill・GC を確認。
4. Job と Stage → 永続 Event Log：イベントを保存。
5. 永続 Event Log → History Server：履歴 UI を再構成。

- EXPLAIN の推定値と実行後の SQL UI の実測を照合する。AQE 有効時は初期計画と最終計画を区別する。
- spill や長い task は原因を一意に示さない。partition の偏り、メモリ、ネットワーク、外部 I/O と合わせて診断する。

### 内部の仕組み

SQL タブの演算子から関連 Job / Stage を開き、shuffle read / write と task の分布を確認する。最大値と中央値の大きな差は skew や遅い外部 I/O を調べる手掛かりになる。

spill の大きさ、GC 時間、入力行数、待ち時間と Executor のメモリを合わせて見る。単一メトリクスから直接「メモリ不足」と断定しない。

History Server の UI はイベントログから再構成される。アプリケーション実行前の eventLog 有効化と共有保存先、権限、保持期間を設計する。

## 4. 実装例：Spark Standalone

自己管理のホスト群で Spark Standalone の Master と Worker を運用し、Driver と Executor を実行する。図中の対応は以下の通り。実装資料を組み合わせた説明用構成であり、実機検証済み構成や実在の導入事例ではない。対象製品・Spark・Scala・JDK の組み合わせ、セキュリティ、入力と出力は個別に確認する。

- SQL UI と物理計画：クラスター外のクライアント・ストレージ等。
- Job と Stage：Spark Driver 側。
- Task の時間分布：Spark Executor 側。
- Shuffle / spill / GC：Spark Executor 側。
- 永続 Event Log：クラスター外のクライアント・ストレージ等。
- History Server：クラスター外のクライアント・ストレージ等。

公式資料：[Spark Web UI](https://spark.apache.org/docs/4.3.0/web-ui.html)、[Spark Monitoring](https://spark.apache.org/docs/4.3.0/monitoring.html)、[Spark SQL performance tuning](https://spark.apache.org/docs/4.3.0/sql-performance-tuning.html)。
