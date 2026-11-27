# NebulaGraph の基本アーキテクチャ

## 1. 概要

NebulaGraph は分散グラフ DB である。Graph Service（nebula-graphd）、Meta Service（nebula-metad）、Storage Service（nebula-storaged）の 3 つが別プロセスで動き、問い合わせ処理とストレージを分けて拡張できる。2026 年 11 月時点の公式資料（3.8.0）に基づく。

[Architecture overview](https://docs.nebula-graph.io/3.8.0/1.introduction/3.nebula-graph-architecture/1.architecture-overview/)

## 2. Graph Service（graphd）

問い合わせを担当する。Parser（Flex・Bison で構文解析して AST を作る）、Validator（スキーマとの照合）、Planner（実行計画の作成。`enable_optimizer` が true ならルールベースの最適化）、Executor の順に処理する。コストベース最適化は開発中。状態を持たないかは資料に記載がなく未確認。既定のポート 9669 は今回取得できず未確認。

[Graph Service](https://docs.nebula-graph.io/3.8.0/1.introduction/3.nebula-graph-architecture/3.graph-service/)

## 3. Meta Service（metad）

スキーマ（タグ、エッジタイプ、プロパティ）、ユーザーと権限、全スペースのメタデータ、ストレージのパーティションの位置、TTL の定義、ジョブの記録を管理する。metad 同士は Raft クラスターを組み、リーダーだけがクライアントや他コンポーネントに応答する。本番は別マシンに 3 台を推奨する。既定のポートは RPC 9559、Raft 9560、HTTP 19559。

[Meta Service](https://docs.nebula-graph.io/3.8.0/1.introduction/3.nebula-graph-architecture/2.meta-service/)、[Meta 設定](https://docs.nebula-graph.io/3.8.0/5.configurations-and-logs/1.configurations/2.meta-config/)

## 4. スペースとパーティション

スペース（graph space）は互いに分離されたデータの単位で、`CREATE SPACE` で `partition_num`（既定 100）、`replica_factor`（既定 1、本番は 3 を推奨、奇数のみ）、`vid_type`（`FIXED_STRING(N)` か `INT64`）を指定する。3 つとも作成後に変更できない。データは頂点 ID の剰余による静的ハッシュでパーティションに分かれる。頂点の out-key、in-key、タグのデータは同じパーティションに入る。エッジは out-key と in-key の 2 つで保存するため、エッジの保存量は 2 倍になる。

[CREATE SPACE](https://docs.nebula-graph.io/3.8.0/3.ngql-guide/9.space-statements/1.create-space/)、[Storage Service](https://docs.nebula-graph.io/3.8.0/1.introduction/3.nebula-graph-architecture/4.storage-service/)

## 5. Raft とレプリカ

パーティションごとに Raft グループを持つ（Multi Group Raft）。書き込みと読み取りはリーダーが受け、書き込みは過半数のレプリカが Raft-wal を受け取った時点で成功とする。3 レプリカなら 1 台の停止に耐える。グループ間で通信層とスレッドプールを共有する。ディスクが遅いとハートビートが途切れて再選出が起き、長期間リーダー不在になることがある。Learner の扱いは今回取得した資料になく未確認。

[Storage Service](https://docs.nebula-graph.io/3.8.0/1.introduction/3.nebula-graph-architecture/4.storage-service/)

## 6. Storage Service（storaged）と RocksDB

独自の KVStore で、ローカルのストレージエンジンに RocksDB を使う。階層は、グラフ操作を KV 操作に変換するストレージインターフェース、Multi Group Raft の合意層、RocksDB の get・put・scan の 3 つ。Community Edition では `data_path` に書いたパスごとに RocksDB のインスタンスができる。既定のポートは RPC 9779、Admin 9778、Raft 9780、HTTP 19779。`meta_server_addrs`（既定 127.0.0.1:9559）で metad を指定する。

[Storage Service](https://docs.nebula-graph.io/3.8.0/1.introduction/3.nebula-graph-architecture/4.storage-service/)、[Storage 設定](https://docs.nebula-graph.io/3.8.0/5.configurations-and-logs/1.configurations/4.storage-config/)

## 7. nGQL と openCypher

クエリ言語は nGQL。SQL に近い宣言型で、走査、パターンマッチ、集計、更新、アクセス制御、インデックスを扱う。openCypher 9 とは完全互換ではなく、DQL の一部（`MATCH`、`OPTIONAL MATCH`、`WITH` など）に互換を持たせる設計である。DDL、DML、DCL、Bolt プロトコル、APOC・GDS の互換は予定にない。スキーマは必須で、等価演算子は `==`、トランザクションは非対応と記載されている。

[nGQL overview](https://docs.nebula-graph.io/3.8.0/3.ngql-guide/1.nGQL-overview/1.overview/)

## 8. 実装例：自前のサーバーで動かす 3 サービス構成

| 機能 | 具体的な担い手 |
| --- | --- |
| クライアント | nGQL を送るアプリ |
| 問い合わせ処理 | nebula-graphd |
| メタデータ・Raft クラスター | nebula-metad（3 台推奨） |
| データの保持 | nebula-storaged と各 RocksDB |

代表的な構成であり、導入事例や動作検証済みの構成ではない。Kubernetes の NebulaGraph Operator の StatefulSet 構成、台数、ネットワーク、認証、graphd の既定ポートは未確認。
