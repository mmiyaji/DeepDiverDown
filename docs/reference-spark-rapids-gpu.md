# Spark RAPIDS：GPU 実行と fallback

## 1. 対象と前提

Spark の SQL 演算を GPU に委譲し、未対応部分を CPU に戻す構成を追う。 外部プラグインの参照資料を基準とし、対応する Spark のバージョンを別途確認する。

## 2. 構成部品

- **SQL / DataFrame**：Spark アプリがクエリを発行する。
- **Spark 物理計画**：Spark の計画を plugin が GPU 対応可能な演算に変換する。
- **RAPIDS plugin**：対応する SQL 演算を GPU 実装に置き換える。
- **GPU と device memory**：対応する列指向演算を GPU 上で実行する。
- **CPU fallback**：非対応の演算や条件は Spark の CPU 演算に戻る。
- **CPU / GPU データ転送**：実行境界の変換や転送は追加コストになり得る。
- **結果と診断**：結果を出力し explain と実行指標で GPU 化範囲を確認する。

## 3. 処理と注意点

1. SQL / DataFrame → Spark 物理計画：物理計画を作成。
2. Spark 物理計画 → RAPIDS plugin：GPU 対応を判定。
3. RAPIDS plugin → GPU と device memory：対応演算を実行。
4. RAPIDS plugin → CPU fallback：未対応演算を実行。
5. CPU fallback → CPU / GPU データ転送：データを転送。
6. CPU / GPU データ転送 → GPU と device memory：GPU にデータを渡す。
7. GPU と device memory → 結果と診断：結果を返す。
8. CPU fallback → 結果と診断：CPU 結果を返す。

- RAPIDS の資料は 24.12 を参照。対応する演算子や Spark バージョンはリリースに依存し、Spark 4.3 との互換性は未確認。Qualification と explain で対象 workload を調べる。
- GPU の導入が常に高速・低コストになるわけではない。転送、メモリ、fallback、GPU の共有条件を含めて検証する。

### 内部の仕組み

RAPIDS plugin は Spark SQL の対応演算を GPU 用実装に置き換える。非対応演算は CPU 側で実行され、物理計画の境界でデータの転送と変換が必要になる。

GPU メモリ、1 GPU での同時タスク、CPU / GPU の転送とデータ skew がボトルネックになり得る。SQL explain と Qualification の結果を benchmark や Spark UI と照合する。

GPU 対応状況、Spark・CUDA・ドライバーの互換性は対象リリースを確認する。Celeborn の remote shuffle と RAPIDS の GPU 向け shuffle は別の実装で、併用可否を仮定しない。

## 4. 実装例：Spark Standalone

自己管理のホスト群で Spark Standalone の Master と Worker を運用し、Driver と Executor を実行する。図中の対応は以下の通り。実装資料を組み合わせた説明用構成であり、実機検証済み構成や実在の導入事例ではない。対象製品・Spark・Scala・JDK の組み合わせ、セキュリティ、入力と出力は個別に確認する。

- SQL / DataFrame：クラスター外のクライアント・ストレージ等。
- Spark 物理計画：Spark Driver 側。
- RAPIDS plugin：Spark Executor 側。
- GPU と device memory：Spark Executor 側。
- CPU fallback：Spark Executor 側。
- CPU / GPU データ転送：Spark Executor 側。
- 結果と診断：クラスター外のクライアント・ストレージ等。

公式資料：[RAPIDS Accelerator Overview](https://docs.nvidia.com/spark-rapids/user-guide/24.12/getting-started/overview.html)、[RAPIDS Accelerator FAQ](https://docs.nvidia.com/spark-rapids/user-guide/24.12/faq.html)、[Spark Resource Configuration](https://spark.apache.org/docs/4.3.0/configuration.html)。
