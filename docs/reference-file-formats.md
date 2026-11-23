# 物理ファイルフォーマット：Parquet・ORC・Avro・Arrow・CSV/JSON

## 1. 目的と前提

データレイクやレイクハウスでは、テーブル形式（Iceberg・Delta Lake・Hudi）の下に、実際のバイト列を決める**物理ファイルフォーマット**がある。どの形式で書くかで、読む列だけを取れるか、統計で読み飛ばせるか、分割して並列に読めるか、圧縮がどれだけ効くかが決まる。このリファレンスでは主要な 5 系統を、内部構造・読み取り方・向く用途で比べる。

図は説明用の論理モデルで、特定エンジンの実装や既定値を保証しない。既定値は各プロジェクトの版や設定で変わる。出典 [Apache Parquet](https://parquet.apache.org/docs/file-format/)、[Apache ORC Specification](https://orc.apache.org/specification/ORCv1/)、[Apache Avro Specification](https://avro.apache.org/docs/current/specification/)、[Apache Arrow Columnar Format](https://arrow.apache.org/docs/format/Columnar.html)

## 2. 行指向と列指向

- **行指向**（Avro、CSV、JSON Lines）：1 行の全列が連続して並ぶ。1 行ずつ追記・読み出しする処理（イベント取り込み、メッセージ、CDC）に向く。少数の列だけ集計しても、全列を読むことになる。
- **列指向**（Parquet、ORC、Arrow）：同じ列の値が連続して並ぶ。必要な列だけを読め（列投影）、同じ型・近い値が並ぶので圧縮とエンコーディングがよく効く。分析クエリの標準。
- **ハイブリッド**：Parquet の Row Group、ORC の Stripe のように「行の塊ごとに列で並べる」構造にして、行の塊単位で分割・並列読みをし、塊の中は列で読む。

## 3. Parquet

構造は **ファイル → Row Group → 列チャンク → ページ** の入れ子で、ファイル末尾に Thrift で書かれたフッター（スキーマ、各 Row Group・列チャンクの位置、min/max・null 数などの統計）と、`PAR1` のマジックがある。

- 読み取りは「末尾 8 バイトでフッター長を知る → フッターを読む → 統計で Row Group を選ぶ → 必要な列チャンクだけを範囲読み」の順。
- **ページ索引**（Column Index／Offset Index）があれば、Row Group の中でもページ単位で読み飛ばせる。**ブルームフィルター**を列ごとに持たせると、min/max では除外できない等値検索（ID など）で読み飛ばせる。
- エンコーディングは辞書、RLE／ビットパッキング、DELTA_BINARY_PACKED、BYTE_STREAM_SPLIT など。圧縮はページ単位で、snappy・gzip・zstd・lz4・brotli などを列ごとに選べる。
- 入れ子の型（構造体・配列・マップ）は Dremel 由来の繰り返しレベル・定義レベルで平らにして列として保存する。
- Spark・Trino・Iceberg・Delta Lake・Hudi・BigQuery の外部テーブルなど、ほぼすべてのエンジンの共通語。

出典 [Parquet File Format](https://parquet.apache.org/docs/file-format/)、[Parquet Page Index](https://parquet.apache.org/docs/file-format/pageindex/)、[Parquet Bloom Filter](https://parquet.apache.org/docs/file-format/bloomfilter/)

## 4. ORC

Hive 向けに生まれた列指向形式。構造は **ファイル → Stripe → (Index Data / Row Data / Stripe Footer)** で、末尾にファイルフッターと Postscript（圧縮方式やフッター長）がある。

- **3 段の統計**：ファイル全体、Stripe ごと、Stripe 内の**行グループごと**（既定 10,000 行ごとの Row Index）に min/max などを持つ。Parquet のページ索引に近い粒度の読み飛ばしが、最初から形式に組み込まれている。
- ブルームフィルターを列ごとに付けられる。
- 整数は RLE v2、文字列は辞書または直接エンコーディングを列ごとに自動選択する。圧縮は zlib・snappy・zstd・lz4 など（ORC 自体の既定は zlib）。
- Hive の ACID テーブル（delta ディレクトリによる更新）の基盤でもある。Iceberg も ORC を書ける。
- エコシステムは Parquet より Hive／Trino 寄り。新規のレイクハウスでは Parquet が選ばれることが多い。

出典 [ORC Specification v1](https://orc.apache.org/specification/ORCv1/)、[ORC Indexes](https://orc.apache.org/docs/indexes.html)

## 5. Avro

行指向のバイナリ形式。**ヘッダー（マジック、JSON のスキーマ、コーデック）→ データブロック（件数・バイト数・本体）→ 16 バイトの同期マーカー** の繰り返し。

- スキーマがファイルに埋め込まれ、読み手のスキーマとの**スキーマ解決**（列追加・既定値・型の昇格）が仕様で決まっている。スキーマ進化に強いので、Kafka のメッセージ（Schema Registry）、取り込みの着地、Iceberg の Manifest に使われる。
- 同期マーカーにより、ファイルの途中から読み始めても次のブロック境界に同期できる。圧縮はブロック単位（deflate・snappy・zstandard・bzip2・xz）なので、圧縮しても分割可能。
- 列統計や列投影はない。分析のスキャンでは全列をデコードするため、分析用の保存形式としては Parquet・ORC に劣る。

出典 [Avro Specification - Object Container Files](https://avro.apache.org/docs/current/specification/#object-container-files)、[Avro Schema Resolution](https://avro.apache.org/docs/current/specification/#schema-resolution)

## 6. Arrow（IPC／Feather）

Arrow は**メモリ上の列指向形式**の標準で、ファイル形式（Arrow IPC ファイル＝Feather v2）とストリーム形式はそのメモリ配置をそのまま書き出したもの。

- バッファの並びがメモリ表現と同じなので、読み込み時のデコードがほぼ不要で、mmap によるゼロコピー読み取りができる。Pandas・Polars・DuckDB・Spark（Python UDF）・Flight RPC の間でデータを渡す共通形式。
- 圧縮は任意（lz4_frame・zstd をバッファ単位で）。統計や索引による読み飛ばしは基本的に持たないため、長期保存・大規模スキャンの保存形式というより、**処理系間の受け渡しと一時データ**向け。
- Parquet と Arrow は役割分担の関係で、「Parquet で保存し、読み込んだら Arrow のメモリで処理する」構成が一般的。

出典 [Arrow Columnar Format](https://arrow.apache.org/docs/format/Columnar.html)、[Arrow IPC](https://arrow.apache.org/docs/format/Columnar.html#serialization-and-interprocess-communication-ipc)

## 7. CSV／JSON Lines

テキスト形式。人が読め、どのツールでも出し入れできるため、外部からの受け取りや着地（Bronze 層）に使われる。

- スキーマ・型・統計を持たない。読むたびに型推論・パースが必要で、CPU を多く使う。
- **圧縮と分割の罠**：ファイル全体を gzip すると、先頭から順にしか解凍できず、1 ファイルを 1 タスクでしか読めない（分割不可）。bzip2 はブロック単位なので分割できるが遅い。zstd や gzip のまま並列に読みたいなら、ファイルを適度な大きさに分けて書く。
- 改行を含む値、区切り文字のエスケープ、文字コードなど、パースの曖昧さが品質問題の原因になりやすい。取り込み後に Parquet などへ変換するのが定石。

## 8. 圧縮コーデックの比較

| コーデック | 圧縮率 | 圧縮速度 | 解凍速度 | 主な使われ方 |
|---|---|---|---|---|
| snappy | 低め | 速い | 速い | 長く Parquet・ORC の定番。CPU を節約したいとき |
| lz4 | 低め | とても速い | とても速い | Arrow、低遅延の処理 |
| zstd | 高い（レベル可変） | 中〜速い | 速い | 現在の多くの既定（Iceberg の Parquet など）。転送量と CPU の均衡が良い |
| gzip／zlib／deflate | 高い | 遅い | 中 | 互換性重視。ORC の既定（zlib） |
| bzip2・xz | とても高い | とても遅い | 遅い | アーカイブ用途。bzip2 はテキストでも分割可能 |
| brotli | 高い | 遅い | 中 | Parquet で選べる。利用は限定的 |

オブジェクトストレージから読む分析では、転送量が支配的になりやすいので、高圧縮で解凍の速い zstd が選ばれやすい。ローカル SSD やメモリ上の処理では lz4・snappy の速さが効く。どちらにせよ**圧縮単位がページ・ブロック単位かどうか**が、分割と範囲読みを左右する。

## 9. 形式の選び方

| 用途 | 向く形式 | 理由 |
|---|---|---|
| 分析テーブルの保存（レイクハウス） | Parquet（または ORC） | 列投影・統計・ページ単位の圧縮 |
| Hive 中心の既存基盤・ACID | ORC | Hive との統合、Stripe／行グループの索引 |
| イベント・メッセージ・メタデータ | Avro | 行単位の追記、スキーマ進化、分割可能 |
| 処理系間の受け渡し・キャッシュ | Arrow IPC | デコード不要、ゼロコピー |
| 外部連携・生データの着地 | CSV／JSON Lines | 互換性。取り込み後に列指向へ変換 |

## 10. シナリオの見方

- `analytic-scan`：Parquet と ORC で、フッター → 統計 → 必要な列だけを読む分析スキャン。
- `ingest-convert`：CSV／Avro で着地したデータを、Parquet に変換して分析層へ置く。
- `interchange`：Parquet から読み込んだデータを Arrow で別の処理系へ渡す。
- `gzip-trap`：ファイル全体を gzip した CSV が 1 タスクでしか読めない様子。

## 11. 実装例：Apache Spark のファイル変換と PyArrow IPC

注文データの取り込み、分析ファイルへの変換、Python への受け渡しを Apache Spark と PyArrow で試す例。各形式は別用途のサンプルで、全データを毎回すべての形式に複製する必要はない。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 元の業務イベント | 注文アプリの入力イベント | CSV・JSON Lines または Avro で例示用のイベントを用意する。 |
| CSV / JSON Lines、Avro | 共有保存先の CSV・JSON Lines・Avro | 交換用のテキストまたはスキーマ付きの Avro コンテナを保持する。 |
| 取り込みと形式変換、分析ファイルの照会 | Spark SQL のデータソースと照会 | 型を解決し、Parquet に書いて、Parquet と ORC のサンプルを別々に SQL で読む。 |
| Parquet、ORC | Parquet と ORC の分析ファイル | それぞれのファイル形式に沿って列を保持する。 |
| Python の列データ利用側 | PySpark Driver 上の PyArrow | 小サイズの結果を toArrow で Table として取得する。 |
| Arrow IPC / Feather | Arrow IPC / Feather の受け渡しファイル | PyArrow で書き出し、対応する読み手が受け取る。 |

実装で加わる部品を以下に示す。

- Spark Avro データソースのモジュール。Avro 入力を使う環境では Spark と Scala に対応するモジュールを用意する。

公式資料

- [Apache Parquet File Format](https://parquet.apache.org/docs/file-format/)
- [Apache ORC Specification v1](https://orc.apache.org/specification/ORCv1/)
- [Apache Avro Specification](https://avro.apache.org/docs/current/specification/)
- [Apache Arrow Columnar Format](https://arrow.apache.org/docs/format/Columnar.html)
- [Spark Avro Data Source Guide](https://spark.apache.org/docs/latest/sql-data-sources-avro.html)
- [Apache Arrow in PySpark](https://spark.apache.org/docs/latest/api/python/tutorial/sql/arrow_pandas.html)
- [Apache Arrow streaming, serialization, and IPC](https://arrow.apache.org/docs/python/ipc.html)

## 12. 実装例：AWS の EMR on EC2・Spark・S3

同一 AWS アカウントの Amazon EMR が管理する EC2 クラスタで、YARN 上の Spark を使って注文データをファイル間で変換する。`DataFrame.toArrow()` を使うため、この例では Spark 4.1.1 を含む `emr-spark-8.1.0` を選ぶ。

| 機能配置 | AWS での担い手 |
|---|---|
| 元の業務イベント | 外部の注文アプリ |
| CSV・JSON Lines・Avro | Amazon S3 の着地プレフィックス |
| 取り込み・形式変換 | EMR の Spark データソースで読み、Parquet へ書き出すジョブ |
| Parquet・ORC の照会 | Amazon S3 の分析用プレフィックスを読む Spark SQL |
| Python の列データ利用 | 小さい結果を `toArrow()` で集める PySpark Driver と PyArrow |
| Arrow IPC | Driver の PyArrow が必要に応じて書き出す受け渡しファイル |

CSV や Avro などのうち必要な入力だけを選び、分析用の Parquet に変換する。ORC は別途用意した比較用のサンプルを読む。Spark の照会結果を Arrow に集める処理は Driver のメモリーに収まる範囲で使う。Avro の対応モジュールと PyArrow を実行環境に用意し、クラスタの IAM ロールに着地・出力プレフィックスへの必要なアクセスを許可する。

- [Amazon EMR Release Guide — AWS runtime for Apache Spark 8.1.0](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-spark810-release.html)
- [AWS Prescriptive Guidance — Using columnar formats](https://docs.aws.amazon.com/prescriptive-guidance/latest/spark-tuning-glue-emr/using-columnar-formats.html)
- [Apache Spark 4.1.1 — Avro Data Source](https://spark.apache.org/docs/4.1.1/sql-data-sources-avro.html)
- [PySpark 4.1.1 — DataFrame.toArrow](https://spark.apache.org/docs/4.1.1/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.toArrow.html)
- [PyArrow — Streaming, serialization and IPC](https://arrow.apache.org/docs/python/ipc.html)

自前例は Linux 上の Spark Standalone Master と Worker を使い、共有 HDFS の入力・分析ファイルを読む。PyArrow と IPC は Driver 側で利用する。AWS 例では AWS が EMR・EC2・S3 の基盤を運用し、利用者がジョブ、クラスタ、データと権限を管理する。公式資料を組み合わせた代表例であり、ネットワーク、依存ライブラリーと各形式の実動作は未検証。

- [Spark Standalone Mode](https://spark.apache.org/docs/latest/spark-standalone.html)
- [HDFS Architecture](https://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-hdfs/HdfsDesign.html)
