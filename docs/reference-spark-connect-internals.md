# Spark Connect：クライアントと Driver の分離

## 1. 対象と前提

クライアントが未解決計画を送信し、Spark Server が実行して Arrow バッチを返す。 Apache Spark 4.3 の資料を基準とし、外部コネクターの対応バージョンを別途確認する。

## 2. 構成部品

- **薄いクライアント**：アプリ・notebook が DataFrame 操作を組み立てる。
- **未解決の論理計画**：クライアントが protobuf にシリアライズする。
- **認証プロキシ（任意）**：必要に応じ gRPC の前段で認証を行う。Spark Connect 自体には認証機能が組み込まれていない。
- **Spark Connect Server / Driver**：gRPC の要求から Spark の論理計画を作り通常の Spark 実行に渡す。
- **Executor**：Driver が計画した task を分散実行する。
- **Arrow 結果バッチ**：結果が Arrow 形式のバッチとして gRPC でクライアントに返る。

## 3. 処理と注意点

1. 薄いクライアント → 未解決の論理計画：論理計画を構築。
2. 未解決の論理計画 → 認証プロキシ（任意）：protobuf / gRPC で送信。
3. 認証プロキシ（任意） → Spark Connect Server / Driver：要求を転送。
4. Spark Connect Server / Driver → Executor：Task を実行。
5. Executor → Arrow 結果バッチ：結果を返す。
6. Arrow 結果バッチ → 薄いクライアント：Arrow バッチを返す。

- Spark Connect は 3.4 で導入。Spark 4 固有の発明ではない。クライアントと Driver は別プロセスで、RDD と SparkContext の直接操作はサポートされない。
- 認証プロキシは任意の構成要素。ネットワーク境界、暗号化、セッション管理は実際の環境で設計する。

### 内部の仕組み

クライアントは未解決の論理計画を Protocol Buffers にエンコードし、gRPC / HTTP2 経由で Spark Server に送る。サーバー側で解析し通常の Spark SQL 計画・実行を使う。

結果は Arrow 形式のバッチで返る。クライアントは Driver の JVM 内部や RDD / SparkContext に直接アクセスできず、古い PySpark の内部フィールドへの依存は移行時に確認する。

Spark Connect に認証は組み込まれておらず、ネットワーク境界と TLS・認証プロキシを別途構成する。前段 proxy は環境により任意である。

## 4. 実装例：Spark Standalone

自己管理のホスト群で Spark Standalone の Master と Worker を運用し、Driver と Executor を実行する。図中の対応は以下の通り。実装資料を組み合わせた説明用構成であり、実機検証済み構成や実在の導入事例ではない。対象製品・Spark・Scala・JDK の組み合わせ、セキュリティ、入力と出力は個別に確認する。

- 薄いクライアント：クラスター外のクライアント・ストレージ等。
- 未解決の論理計画：クラスター外のクライアント・ストレージ等。
- 認証プロキシ（任意）：クラスター外のクライアント・ストレージ等。
- Spark Connect Server / Driver：Spark Driver 側。
- Executor：Spark Executor 側。
- Arrow 結果バッチ：Spark Driver 側。

公式資料：[Spark Connect Overview](https://spark.apache.org/docs/4.3.0/spark-connect-overview.html)、[Connect Application Development](https://spark.apache.org/docs/4.3.0/app-dev-spark-connect.html)。
