# DuckDB の基本アーキテクチャ

## 1. 位置づけと前提

DuckDB は、アプリケーションのプロセスの中で動く分析向けの SQL データベース。別のサーバーを立てず、ライブラリとしてプロセスに組み込んで使う。列指向でベクトル化した実行エンジンを持ち、トランザクションは MVCC で扱う。データは単一のデータベースファイルに置けるほか、Parquet などの外部ファイルを直接読める。この図は DuckDB 2.0 系の公式資料を基準にする。設定の既定値は資料の記載に従い、バージョンで変わることがある。

流れは、クライアント API → SQL の解析と最適化 → 実行 → ストレージ・外部ファイル。各部品の内部は、次の 3 つの図で学ぶ。

1. DuckDB：ベクトル化実行と並列処理
2. DuckDB：ストレージ形式とメモリ管理
3. DuckDB：Parquet スキャンと行グループの除外

## 2. クライアント API とプロセスの境界

C、C++、Python、R、Java、Node.js、Go、Rust などの言語向けクライアントがある。アプリケーションは同じプロセスの中で接続を開き、SQL を発行する。Python では `duckdb.connect()` を引数なしで呼ぶとインメモリのデータベース、ファイル名を渡すと永続データベースを開く。1 つの接続は同時に 1 つの呼び出ししか処理せず、スレッドごとに `cursor()` で接続を分けて並列に使う。

同時実行は、1 つのプロセスが読み書きするか、複数のプロセスが読み取り専用で開く形が基本。1 つのプロセス内の複数スレッドは書き込める。複数のプロセスから書き込む場合は、Quack リモートプロトコルや DuckLake を使う。DuckDB はファイルロックを使うため、共有ディレクトリやネットワークストレージ上のデータベースファイルには注意する。

## 3. SQL から物理計画まで

エンジンは段階ごとに前の出力を受ける。パーサーは文字列から構文の木を作り、カタログは参照しない。バインダーがカタログを使って表・列・型を解決する。論理プランナーが論理演算子の木を作り、オプティマイザが式の書き換え、フィルタのプッシュダウン、結合順の最適化（DPhyp アルゴリズム）、共通部分式、IN 句の書き換えを適用する。最後に物理プランジェネレーターが物理演算子の木へ変換する。`EXPLAIN` は物理計画を実行せずに表示し、`EXPLAIN ANALYZE` はクエリを実行して演算子ごとの実測値を示す。

## 4. ベクトル化・プッシュ型の実行

物理演算子は、プッシュ型のベクトル化モデルで動く。データは行ではなく、まとまった行数の `DataChunk` として演算子の木を流れる。1 回に処理するタプル数の標準は 2,048。クエリは自動的にマルチスレッドで並列化される。詳細は「DuckDB：ベクトル化実行と並列処理」で扱う。

## 5. ストレージとバッファ管理

永続データベースは単一のデータベースファイルに保存する。データは行グループ（既定 122,880 行）に分け、ファイルは固定サイズのブロック（既定 256 KiB）で扱う。書き込みは WAL（先行書き込みログ）に記録され、checkpoint で WAL の内容がデータベースファイルへ反映される。WAL が一定の大きさ（既定 16 MiB）になると自動で checkpoint が実行される。

バッファマネージャーは永続ストレージのページをキャッシュし、クエリの中間結果と同じメモリ上限（既定は RAM の 80%）を共有する。メモリに収まらない中間結果は一時ディレクトリへ書き出す。詳細は「DuckDB：ストレージ形式とメモリ管理」で扱う。

## 6. 外部ファイルと拡張

Parquet、JSON、HTTP(S)・S3 のアクセスなどは拡張として提供される。Parquet は `parquet` 拡張で、`SELECT * FROM 'file.parquet'` のようにファイルを直接検索できる。HTTP(S) と S3 は `httpfs` 拡張が担当し、Parquet のメタデータと HTTP Range リクエストを使って、クエリに必要な部分だけをダウンロードする。例えば 1 列だけを選ぶと、メタデータとその列のデータだけを取得する。CSV は行形式のため、通常はファイル全体を取得する。

S3 の認証は `CREATE SECRET (TYPE s3, PROVIDER credential_chain)` で AWS SDK の資格情報チェーンを使える（`aws` 拡張が提供）。S3 互換サーバーで部分読み取りするには、HTTP Range リクエストへの対応が必要。外部ファイルを読む仕組みは「DuckDB：Parquet スキャンと行グループの除外」で扱う。

## 7. 公式資料

- [Why DuckDB](https://duckdb.org/why_duckdb)
- [DuckDB Internals Overview](https://duckdb.org/docs/2.0/internals/overview.html)
- [DuckDB Concurrency](https://duckdb.org/docs/2.0/connect/concurrency.html)
- [DuckDB Python API](https://duckdb.org/docs/2.0/clients/python/overview.html)
- [DuckDB Storage Format](https://duckdb.org/docs/2.0/internals/storage.html)
- [DuckDB Core Extensions](https://duckdb.org/docs/2.0/core_extensions/overview.html)
- [DuckDB HTTP(S) Support](https://duckdb.org/docs/2.0/core_extensions/httpfs/https.html)
- [DuckDB S3 API Support](https://duckdb.org/docs/2.0/core_extensions/httpfs/s3api.html)
- [DuckDB Memory Management](https://duckdb.org/2024/07/09/memory-management.html)

## 8. 実装例：Python に組み込む DuckDB

Python プロセス内の DuckDB が、ローカルのデータベースファイルと Parquet ファイルを使う例。アプリ、SQL の解析、実行、ストレージが 1 つのプロセスとホストにまとまる。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| アプリケーション、クライアント API | Python プログラムと duckdb パッケージ | `duckdb.connect('analytics.duckdb')` で接続する。 |
| パーサー・プランナー・実行・バッファ管理・拡張 | 同じプロセスの DuckDB エンジン | `pip install duckdb` で導入する。 |
| データベースファイルと WAL | ローカルディスクの analytics.duckdb | 1 つのプロセスだけが書き込む。 |
| 外部ファイル | ローカルの orders.parquet | `read_parquet` で直接読む。 |

資料を組み合わせた説明用の例で、実環境で検証した構成ではない。

## 9. 実装例：AWS（DuckDB on Fargate・Amazon S3）

Amazon ECS のスタンドアロンタスクを AWS Fargate で起動し、Amazon ECR に登録したイメージから Python スクリプトを実行する。DuckDB の Python パッケージと、同じ DuckDB リリースに対応する `httpfs`・`aws` 拡張をイメージに用意する。

| 機能 | 担い手 |
|---|---|
| タスクの起動と実行環境 | Amazon ECS と AWS Fargate |
| アプリケーション | Python スクリプト |
| SQL の計画・実行・バッファ管理・拡張 | Python と同一プロセス内の DuckDB |
| 外部ファイル | Amazon S3 の Parquet |

タスク IAM ロールに対象オブジェクトの読み取りを許可する。DuckDB は `CREATE SECRET (TYPE s3, PROVIDER credential_chain)` で AWS SDK のデフォルト認証チェーンを使用する。この例ではリージョンを設定し、`read_parquet('s3://…/orders.parquet')` でアクセスする。DuckDB が Parquet のメタデータを読み、必要な範囲を S3 の Range GET で取得する。取得量は述語、各列の統計、ファイル配置に依存する。この例はインメモリのデータベースを使い、永続のデータベースファイルと WAL は持たない。

- [DuckDB S3 API Support](https://duckdb.org/docs/1.5/core_extensions/httpfs/s3api)
- [DuckDB AWS extension](https://duckdb.org/docs/extensions/aws)
- [AWS SDK のコンテナ認証プロバイダー](https://docs.aws.amazon.com/sdkref/latest/guide/feature-container-credentials.html)
- [ECS タスク IAM ロール](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
- [ECS の Fargate タスク定義](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html)

自前例は利用者管理のホストで Python と埋め込み DuckDB を同一プロセスで実行する。AWS 例は RunTask で Fargate タスクを起動し、ECR のイメージを使い、タスク IAM ロールを AWS SDK credential chain に渡して S3 を読む。タスク実行ロールはイメージ取得用として別に設定する。AWS は ECS・Fargate・ECR・S3 の基盤を運用し、利用者はタスク定義、SQL、データと権限を管理する。ネットワーク経路・資格情報チェーン・拡張のバージョンの実動作は未検証で、公式資料を組み合わせた例である。
