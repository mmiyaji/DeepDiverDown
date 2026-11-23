# Spark SQL：Catalyst と実行計画

## 1. 対象と前提

SQL の解析、名前解決、ルール最適化、物理計画、Stage と Task への変換を追う。 Apache Spark 4.3 の資料を基準とし、外部コネクターの対応バージョンを別途確認する。

## 2. 構成部品

- **SQL / DataFrame**：利用者がクエリを組み立て、action により実行を要求する。
- **未解決の論理計画**：SQL パーサーなどが解析した時点では表名・列名は未解決。
- **名前と型の解決**：Analyzer がカタログを用いて表・列・型を解決する。
- **論理最適化**：Catalyst のルールが論理計画を変換する。選択可能な計画は統計の品質に影響される。
- **物理計画と codegen**：Scan、Exchange、Join などを選び、対応箇所で生成コードを使う。すべての演算が codegen 対象とは限らない。
- **Stage / Task**：shuffle などの境界に従って実行段階を作り Executor が task を処理する。
- **入力データ**：データソースやカタログが実データとメタデータを提供する。

## 3. 処理と注意点

1. SQL / DataFrame → 未解決の論理計画：クエリを解析。
2. 未解決の論理計画 → 名前と型の解決：名前と型を解決。
3. 名前と型の解決 → 論理最適化：論理計画を最適化。
4. 論理最適化 → 物理計画と codegen：物理演算子を選択。
5. 物理計画と codegen → Stage / Task：Stage と Task を実行。
6. 入力データ → Stage / Task：データを読み取る。
7. 入力データ → 名前と型の解決：表と列を参照。

- EXTENDED は parsed / analyzed / optimized / physical plan を表示する。CODEGEN は生成コード、COST は利用可能な統計を示す。
- EXPLAIN は実行後の AQE 最終計画や実際のタスク時間を単独で保証しない。SQL UI で runtime 統計と最終計画を確認する。

### 内部の仕組み

解析時は未解決の属性をカタログと照合して型を与える。論理最適化は意味を保つルール変換を適用し、物理計画は Scan・Join・Exchange などの実行方法を選ぶ。

Exchange は必要な分布にデータを移動する演算であり、shuffle と関連する。物理演算子の区切り、DAG の Stage 境界、Task は同義ではない。

EXPLAIN EXTENDED、FORMATTED、COST、CODEGEN はそれぞれ異なる観点を表示する。実行時の AQE 変更は SQL UI の最終計画と合わせて確認する。

## 4. 実装例：Spark Standalone

自己管理のホスト群で Spark Standalone の Master と Worker を運用し、Driver と Executor を実行する。図中の対応は以下の通り。実装資料を組み合わせた説明用構成であり、実機検証済み構成や実在の導入事例ではない。対象製品・Spark・Scala・JDK の組み合わせ、セキュリティ、入力と出力は個別に確認する。

- SQL / DataFrame：クラスター外のクライアント・ストレージ等。
- 未解決の論理計画：Spark Driver 側。
- 名前と型の解決：Spark Driver 側。
- 論理最適化：Spark Driver 側。
- 物理計画と codegen：Spark Driver 側。
- Stage / Task：Spark Executor 側。
- 入力データ：クラスター外のクライアント・ストレージ等。

公式資料：[Spark EXPLAIN](https://spark.apache.org/docs/4.3.0/sql-ref-syntax-qry-explain.html)、[Spark SQL 性能](https://spark.apache.org/docs/4.3.0/sql-performance-tuning.html)、[Spark Cluster Mode](https://spark.apache.org/docs/4.3.0/cluster-overview.html)。
