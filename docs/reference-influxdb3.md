# InfluxDB 3 の基本アーキテクチャ

## 1. 概要

InfluxDB 3 は時系列データ向けのデータベースで、Apache Arrow、DataFusion、Parquet、Flight を基盤にする（FDAP スタック）。Core と Enterprise は単一プロセスで動き、1 つの実行ファイルまたは Docker コンテナで起動できる。Core は直近のデータの監視・収集向け、Enterprise は Core に履歴分析、コンパクション、高可用性、読み取りレプリカを加えた版である。2026 年 11 月時点の公式資料に基づく。WAL と Parquet の保持の詳細は [InfluxDB 3 Core：WAL と Parquet](reference-influxdb3-storage-internals.md) に書く。

[InfluxDB 3 Core and Enterprise architecture](https://www.influxdata.com/blog/influxdb3-core-enterprise-architecture)

## 2. データモデル

サーバーはデータベースを持ち、データベースはテーブル、テーブルは列を持つ。データベースは v2 のバケット、テーブルは v1・v2 のメジャメントに相当する。列の型はタグ（文字列の辞書）、フィールド（int64、float64、uint64、bool、string）、time（ナノ秒精度）である。テーブルの主キーはタグと time で、タグ列の定義は後から変えられない。スキーマは書き込み時に決まる（schema-on-write）。

[Get started with InfluxDB 3 Core](https://docs.influxdata.com/influxdb3/core/get-started/)

## 3. 書き込みの入口

書き込みには `influxdb3` CLI、HTTP API、v1・v2・v3 のクライアントライブラリ、Telegraf、プロセシングエンジンを使える。既定の接続先は `localhost:8181`。書き込みはメモリに蓄えられ、既定で 1 秒ごとに WAL へフラッシュされ、`no_sync=false`（既定）ではフラッシュ後に書き込みが確定する。書き込み API のエンドポイントと形式は今回取得した資料に記載がなく未確認。

[InfluxDB 3 Core durability](https://docs.influxdata.com/influxdb3/core/reference/internals/durability/)

## 4. 永続化とオブジェクトストア

WAL のあと、データは Arrow 形式のクエリ可能バッファに入る。既定では 10 分ごとに古い部分を Parquet としてオブジェクトストアへ書き、直近 5 分分はメモリに残す。書き出した Parquet はメモリにキャッシュされ、新しいデータの検索でオブジェクトストアに触れずに済む。オブジェクトストアを使う場合、永続化先はそこだけになる（ディスクレス）。設定ガイドがある保存先は Amazon S3、MinIO、Google Cloud Storage、Azure Blob Storage。

[InfluxDB 3 Core durability](https://docs.influxdata.com/influxdb3/core/reference/internals/durability/)

## 5. クエリエンジン

クエリは DataFusion が実行し、SQL と InfluxQL を使える。クライアントは CLI、HTTP API、InfluxDB 3 Explorer、v1 クライアントライブラリ、Flight SQL クライアント、Grafana。Flux の扱いは未確認。

[InfluxDB 3 Core and Enterprise architecture](https://www.influxdata.com/blog/influxdb3-core-enterprise-architecture)

## 6. プロセシングエンジン

Python のプロセシングエンジンが組み込まれており、データの到着時、オンデマンド、スケジュールで動く。プラグインで変換・正規化、アラート、ダウンサンプリング、複製を行える。Kapacitor 1.x と Flux Tasks の後継として紹介されている。

[InfluxDB 3 Core and Enterprise architecture](https://www.influxdata.com/blog/influxdb3-core-enterprise-architecture)

## 7. Enterprise のノードモード

Enterprise は `--mode` でノードの役割を分ける。`ingest`（取り込みと line protocol の解析）、`query`（クエリ実行）、`compact`（バックグラウンドのコンパクション）、`process`（プロセシングエンジン、`--plugin-dir` が必要）、`all`（単一ノード向け）。クエリノードは同じオブジェクトストアを読むため水平に増やせる。各ノードはオブジェクトストア上の専用領域に書き、ノードが落ちても別のノードがその領域を読み続けられる。推奨の複数ノード構成は専用のコンパクターを置く。Core との機能差の詳細は今回取得した資料の範囲で未確認。

[Enterprise clustering](https://docs.influxdata.com/influxdb3/enterprise/admin/clustering/)

## 8. 実装例

| 機能 | 具体的な担い手 |
| --- | --- |
| 書き込み元 | Telegraf |
| サーバー | InfluxDB 3 Core の単一プロセス |
| 検索 | DataFusion（SQL・InfluxQL） |
| 検索クライアント | Grafana |
| 永続化 | S3 互換のオブジェクトストア |
| コンパクター | Enterprise 限定の機能で、Core の例では担い手を置かない（図では未配置の部品として示す） |

代表的な構成であり、導入事例や動作検証済みの構成ではない。ホストの種類、Telegraf と Grafana の稼働場所、認証の設定は未確認。
