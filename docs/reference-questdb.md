# QuestDB の基本アーキテクチャ

## 1. 概要

QuestDB は時系列データ向けの列指向データベースである。書き込みは WAL に受け、バックグラウンドのジョブがテーブルの列ファイルへ反映する。SQL には時系列向けの拡張がある。2026 年 11 月時点の公式資料に基づく。実装の内部（スレッド構成、メモリ配置の詳細）は未確認。

[QuestDB Docs: Storage model](https://questdb.com/docs/concept/storage-model/)

## 2. 取り込み経路

クライアントライブラリ（QWP）が推奨の経路である。ILP は InfluxDB、Telegraf、Kafka・Flink など既存の ILP 出力を使う場合の互換用で、HTTP（既定ポート 9000）を推奨し、TCP（9009）は互換目的で残る。PGWire は Postgres 互換のドライバーや BI ツール向け。REST の `/imp` は CSV の一括取り込みに使う。PGWire のポートは未確認。ILP では存在しないテーブルや列を最初の行から自動作成し、自動作成のテーブルはパーティションが DAY になる。

[Ingestion overview](https://questdb.com/docs/ingestion-overview/) / [ILP overview](https://questdb.com/docs/ingestion/ilp/overview/)

## 3. WAL とアプライジョブ

WAL は既定で有効である。書き込みは WAL のセグメントへ順次書かれ、トランザクションが確定する。シーケンサーがトランザクション番号を時系列順に割り当てる。アプライジョブが複数のトランザクションをまとめてソートし、テーブルへ非同期に反映する。遅れて届いた行（out-of-order）もこの段階でマージする。WAL には `PARTITION BY` が必須で、重複排除（`DEDUP UPSERT KEYS`）も WAL が前提になる。既定の `nosync` では OS クラッシュや停電で確定済みのトランザクションを失うことがある。Enterprise ではセグメントがコミット時にオブジェクトストレージへ複製される。

[Write-Ahead Log](https://questdb.com/docs/concept/write-ahead-log/)

## 4. 列ファイルとパーティション

テーブルは列ごとのファイルで保存する。固定長の型は 1 列 1 ファイル、可変長の型（VARCHAR、STRING）は 2 ファイルである。列ファイルは追記方式で、TableWriter が out-of-order の書き込みと重複排除を処理する。最新のパーティションは既定でネイティブのバイナリ形式である。時間によるパーティション分割とデザインタイムスタンプ列で物理的に並べる。パーティションのディレクトリ構成、SYMBOL 型の内部、メモリマップの詳細は今回取得した資料に記載がなく未確認。

[Storage engine](https://questdb.com/docs/architecture/storage-engine/)

## 5. SQL 拡張

- `SAMPLE BY`：デザインタイムスタンプに基づく等間隔の時間バケットで集計する。
- `LATEST ON`：キーごとの最新行を返す。
- `ASOF JOIN` / `LT JOIN` / `SPLICE JOIN` / `WINDOW JOIN` / `HORIZON JOIN`：時刻で突き合わせる結合。
- マテリアライズドビュー：`SAMPLE BY` の結果を事前計算し、基底データの到着に合わせて更新する。

[SQL extensions](https://questdb.com/docs/concept/sql-extensions/)

## 6. 階層ストレージと Parquet

ストレージは 3 層である。層 1 が WAL、層 2 がローカルのテーブルストレージ、層 3 が Parquet 形式のローカルまたはリモートのストレージ。過去のパーティションは作成時、パーティション単位の変換、またはストレージポリシー（Enterprise）で Parquet にできる。Parquet のパーティションも SQL で検索できる。層 3 として S3、Azure Blob、GCS、NFS へ移す機能（コールドストレージ）は Enterprise に含まれる。OSS 版での提供範囲は未確認。Parquet からの取り込みは今回の資料では確認できず、`/exp` による問い合わせ結果の Parquet 書き出しのみ確認した。

[Storage engine](https://questdb.com/docs/architecture/storage-engine/)

## 7. 実装例：自前の単一サーバー

QuestDB を自前のホスト 1 台で動かし、クライアントが書き込み、利用者が SQL で問い合わせる最小の例である。代表例であり、導入事例ではない。

| 機能配置の役割 | 実装の担い手 |
| --- | --- |
| クライアント・コレクター、クエリ利用者・BI | 利用者側のクライアントと BI ツール |
| 取り込みエンドポイント、WAL、アプライジョブ、SQL エンジン | 自前ホスト上の QuestDB プロセス |
| WAL セグメント、列ファイルとパーティション | 同じホストのローカルディスク |

根拠は [Write-Ahead Log](https://questdb.com/docs/concept/write-ahead-log/) と [Storage engine](https://questdb.com/docs/architecture/storage-engine/)。Parquet への移動、レプリケーション、Enterprise の機能は含めない。ホストの台数や構成、プロセスの内部構成は資料にないため未確認。
