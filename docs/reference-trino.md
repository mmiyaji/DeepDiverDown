# Trino の分散クエリアーキテクチャ

## 1. Coordinator と Worker

Coordinator が SQL を解析して分散クエリ計画を作る。計画は Stage に分かれ、Worker 上の Task がそれぞれの Stage の処理を実行する。図はスキャンと集約の役割を分けて示す。

## 2. カタログと Connector

Trino のカタログは Connector と接続情報をまとめた設定である。Iceberg Connector は Iceberg のカタログやテーブルメタデータを参照し、Coordinator は処理対象の Split を Task に割り当てる。

## 3. 並列読み取りから結果へ

Worker は Connector を介して対象ファイルを読み、部分集計を作る。Exchange で中間データを次の Stage に渡し、Coordinator が実行結果を取得してクライアントに返す。

## 公式資料

- [Trino · Concepts](https://trino.io/docs/current/overview/concepts.html)
- [Trino · Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)

## 4. 実装例：Trino と Glue Catalog・S3 上の Iceberg

Trino の Coordinator と Worker が、Glue Catalog を使う Iceberg カタログに接続し、S3 にある注文テーブルを検索する例。分散読み取りと部分集計は同じ Worker 群で動く。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| SQL クライアント | Trino CLI | SQL を送り、結果を取得する。 |
| SQL の計画と調整、外部テーブルのメタデータ解決 | Trino Coordinator と Iceberg Connector | Iceberg テーブルを解決して分割とステージを計画する。 |
| 分割データの読取タスク、集約タスク | Trino Workers の読取と集約タスク | S3 上のデータを読み、ステージ間で中間結果を交換する。 |
| Iceberg テーブルのデータファイル | S3 上の Iceberg データとメタデータ | スナップショットが参照する物理ファイルを保持する。 |

実装で加わる部品を以下に示す。

- AWS Glue Catalog。カタログに iceberg.catalog.type=glue と fs.s3.enabled=true を設定し、Glue から Iceberg のメタデータ位置を解決する。

公式資料

- [Trino · Concepts](https://trino.io/docs/current/overview/concepts.html)
- [Trino · Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)
- [Trino file system support](https://trino.io/docs/current/object-storage/file-system-s3.html)
