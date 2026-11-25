# Spark Gluten：Velox による列指向ネイティブ実行

## 1. 対象と前提

Spark の物理計画を Substrait に変換し、対応する演算をネイティブ実行する。 外部プラグインの参照資料を基準とし、対応する Spark のバージョンを別途確認する。

## 2. 構成部品

- **Spark 物理計画**：Spark がクエリを解析し物理演算を作る。
- **Gluten の計画変換**：対応演算子を Substrait の表現に変換する。
- **JNI 境界**：JVM とネイティブコードの間で計画と実行を橋渡しする。
- **Velox ネイティブ実行**：C++ の列指向演算が対応する計画部分を処理する。
- **Arrow / ColumnarBatch**：列指向データを受け渡す。
- **Spark fallback と形式変換**：未対応箇所は Spark で実行し必要に応じ行・列を変換する。
- **Spark UI の実行指標**：native 側の指標も確認し fallback と変換の影響を調べる。

## 3. 処理と注意点

1. Spark 物理計画 → Gluten の計画変換：対応計画を変換。
2. Gluten の計画変換 → JNI 境界：Substrait を渡す。
3. JNI 境界 → Velox ネイティブ実行：ネイティブ演算を実行。
4. Velox ネイティブ実行 → Arrow / ColumnarBatch：列バッチを返す。
5. Spark 物理計画 → Spark fallback と形式変換：非対応演算を実行。
6. Spark fallback と形式変換 → Arrow / ColumnarBatch：行・列形式を変換。
7. Velox ネイティブ実行 → Spark UI の実行指標：実行指標を公開。

- Gluten は Spark 全体の置き換えではなく、対応する物理演算を Velox や ClickHouse バックエンドに委譲する中間層。
- 参照した Gluten の README は Spark 3.4・3.5・4.0・4.1 を列挙しており、4.3 対応を仮定しない。fallback、行列変換、ネイティブメモリと実環境の互換性を確認する。Photon と同じ実装とは限らない。

### 内部の仕組み

Spark の物理計画の対応部分を Substrait に変換し JNI を経由してネイティブ演算子へ渡す。Gluten は Arrow ベースの列バッチを Spark の Columnar API に返す。

unsupported な演算子では Spark に fallback する。ColumnarToRow / RowToColumnar 境界が増えると変換コストが発生し、native 側だけの比較では全体性能を判断できない。

ネイティブメモリと spill、列形式 shuffle、Spark バージョン対応 shim、Spark UI に出る native metrics を合わせて評価する。

## 4. 実装例：Spark Standalone

自己管理のホスト群で Spark Standalone の Master と Worker を運用し、Driver と Executor を実行する。図中の対応は以下の通り。実装資料を組み合わせた説明用構成であり、実機検証済み構成や実在の導入事例ではない。対象製品・Spark・Scala・JDK の組み合わせ、セキュリティ、入力と出力は個別に確認する。

- Spark 物理計画：Spark Driver 側。
- Gluten の計画変換：Spark Driver 側。
- JNI 境界：Spark Executor 側。
- Velox ネイティブ実行：Spark Executor 側。
- Arrow / ColumnarBatch：Spark Executor 側。
- Spark fallback と形式変換：Spark Executor 側。
- Spark UI の実行指標：クラスター外のクライアント・ストレージ等。

公式資料：[Apache Gluten Architecture](https://github.com/apache/gluten)、[Gluten Configuration](https://github.com/apache/gluten/blob/main/docs/Configuration.md)。
