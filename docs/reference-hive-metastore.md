# Hive Metastore のテーブルメタデータとパーティション

## 1. 概要

Hive Metastore はデータベース、テーブル、パーティションなどの定義を RDB に保存し、Thrift サービスとして提供する。データの実体は S3 や HDFS にあり、メタストアは保持しない。2026 年 11 月時点の公式資料に基づく。

[Hive Metastore Administration](https://hive.apache.org/docs/latest/admin/adminmanual-metastore-administration/)

## 2. Thrift サービスとメタストア DB

サーバーとクライアントは Thrift で通信する。既定のポートは 9083 で、クライアントは `hive.metastore.uris` に `thrift://<host>:<port>` を指定する（Hive 3.0 以降のスタンドアロンでは `metastore.thrift.uris`）。サービスは状態を持たず、複数台で冗長化できる。定義は DataNucleus（JDO）経由で RDB に保存する。組み込みの Derby は単体テスト向けで、本番には外部 RDB を使う。動作確認済みの RDB は MySQL、MariaDB、PostgreSQL、Oracle、MS SQL Server。

[Hive Metastore Administration (3.0)](https://hive.apache.org/docs/latest/admin/adminmanual-metastore-3-0-administration/)

## 3. テーブル・パーティション・ストレージ記述子

メタストアはデータベース、テーブル、関数の定義を保持し、統計や認可の記録も保存できる。テーブルやパーティションは格納先の場所を持ち、エンジンはその場所のファイルを直接読む。パーティションとストレージ記述子（場所・入出力形式）の項目の詳細は、今回取得した管理資料に記載がなく未確認。

## 4. 複数エンジンからの共有

Hive、Trino はメタストアの Thrift URI を設定して接続する。Trino の Hive コネクタは Hive のメタデータとデータ形式だけを使い、HiveQL や実行環境は使わない。Spark と Flink の接続設定は今回の取得範囲になく未確認。データファイルへの読み書きは各エンジンが S3・HDFS に直接行う。

[Trino Hive connector](https://trino.io/docs/current/connector/hive.html)

## 5. Iceberg など新しい形式の Hive カタログ方式

Iceberg の HiveCatalog では、Iceberg のテーブルプロパティと HMS 上の Hive のテーブルプロパティを同期する。現在のメタデータ JSON の場所は `metadata_location` で指す。HMS にパーティションは作らず、Iceberg 側のパーティション仕様に変換される。Hive 連携は Hive 2.3.10、3.1.3 以降が対象。ロックや同時更新の扱いは未確認。

[Iceberg Hive integration](https://iceberg.apache.org/docs/latest/hive/)

## 6. スタンドアロン運用

Hive 3.0 以降、Metastore は別パッケージとして Hive 本体なしで動かせる。既定から `metastore.task.threads.always` と `metastore.expression.proxy` を変える必要がある。コンパクションは Hive なしでは動かないため、ACID テーブルは読み書きできるが圧縮できない。スキーマは `schematool -initSchema` で作る。

## 7. 実装例：自前のスタンドアロン構成

| 機能 | 具体的な担い手 |
| --- | --- |
| クエリエンジン | Spark、Trino、HiveServer2、Flink |
| Thrift サービス | スタンドアロン Metastore サーバー |
| メタストア DB・各定義 | PostgreSQL |
| データの実体 | HDFS（S3 互換ストレージも可） |
| 追加 | 運用者が schematool でスキーマを初期化 |

代表的な構成であり、導入事例や動作検証済みの構成ではない。ノード台数と認証（Kerberos・SSL）は未確認。
