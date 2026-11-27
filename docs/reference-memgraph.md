# Memgraph のインメモリグラフ DB 構成

## 1. 概要

Memgraph はインメモリのグラフ DB である。データモデルは公式資料が「Labeled Property Graph」と明記し、ノードとリレーションシップがプロパティを持つ。ノードは複数のラベルを持て、リレーションシップは必ず 1 つのタイプを持ち作成後に変えられない。事前のスキーマ定義は要らない。クエリは Cypher で書き、Bolt で接続する。永続化には WAL とスナップショットを使い、Kafka などのストリームからも取り込める。公式資料は「高性能なインメモリのグラフ DB」と説明し、Neo4j とほとんどのクエリで互換とする。2026 年 11 月時点の公式資料に基づく。

[Memgraph overview](https://memgraph.com/docs/memgraph/overview)

## 2. Cypher と Bolt

クエリは 7687 番ポートで受ける（公式の Docker 手順の記載）。Bolt はバージョン 1、4.0、4.1、4.3、5.2 に対応する。クライアントライブラリは Python、Java、Go、Node.js、C#、Rust など多数ある。openCypher への準拠度、Neo4j 公式ドライバーでの接続可否は取得した資料に記載がなく未確認。

[Client libraries](https://memgraph.com/docs/client-libraries)

## 3. ストレージモード

モードは 3 つある。`IN_MEMORY_TRANSACTIONAL` が既定で、ACID を保証する。`IN_MEMORY_ANALYTICAL` は取り込みと分析が速く、メモリ消費が少ない。ただし分離性の保証がなく、失敗した書き込みのロールバックもない。`ON_DISK_TRANSACTIONAL` は RocksDB にデータを置き、RAM を超える量を扱える。実験的な機能で、スナップショット分離のみに対応する。トランザクションが使うグラフオブジェクトは RAM に収まる必要がある。インスタンス全体のメモリ上限は `--memory-limit`（MiB）で指定する。

[Storage memory usage](https://memgraph.com/docs/fundamentals/storage-memory-usage)

## 4. 永続化（WAL とスナップショット）

トランザクショナルのインメモリモードでは、スナップショットと WAL ファイルの両方で永続化する。スナップショットは定期的に作られ、`CREATE SNAPSHOT;` で手動でも作れる。保持数は `--storage-snapshot-retention-count`（既定 3）。起動時はスナップショットから復旧し、`--data-recovery-on-startup` の既定は `true`。分析モードでは WAL も定期スナップショットも作らない。オンディスクモードは RocksDB 自身の WAL に頼る。WAL 固有の設定項目と間隔は取得した資料に記載がなく未確認。

[Backup and restore](https://memgraph.com/docs/database-management/backup-and-restore)

## 5. ストリーム連携

Kafka、Redpanda、Pulsar から取り込める。Python の変換モジュールを読み込み、`CREATE KAFKA STREAM`（Pulsar は `CREATE PULSAR STREAM`）でストリームを作り、`START STREAM` で開始する。開始したストリームは最後にコミットしたオフセットから再開する。Kafka のストリームは at-least-once で、重複はあり得る。認証情報は暗号化されずにディスクへ保存される。

[Data streams](https://memgraph.com/docs/data-streams)

## 6. レプリケーションと HA

レプリケーションは MAIN から 1 台以上の REPLICA へデータを複製する。MAIN は読み書き、REPLICA は読み取りだけを受ける。複製モードは SYNC、ASYNC、STRICT_SYNC の 3 つ。各モードの動作は取得した資料に記載がなく未確認。Community 版のレプリケーションは手動でフェイルオーバーする。HA は Enterprise 版で、Raft に基づくコーディネーターが自動フェイルオーバーを行う。コーディネーターの内部動作とポートは未確認。分析モードでは REPLICA の登録中は使えず、オンディスクモードはレプリケーションと HA に対応しない。

[Replication](https://memgraph.com/docs/clustering/replication)
[High availability](https://memgraph.com/docs/clustering/high-availability)

## 7. 実装例：自前サーバーの MAIN・REPLICA 構成

| 機能 | 具体的な担い手 |
| --- | --- |
| クエリの受付 | Memgraph MAIN（Bolt・Cypher） |
| グラフの保持 | MAIN のインメモリストレージ |
| 永続化 | MAIN のデータディレクトリ（snapshots・wal） |
| ストリーム取り込み | Memgraph のストリームと Kafka |
| 複製 | REPLICA |
| 自動フェイルオーバー | コーディネーター（Enterprise） |

代表的な構成であり、導入事例や動作検証済みの構成ではない。台数、ネットワーク、Kafka の構成は未確認。
