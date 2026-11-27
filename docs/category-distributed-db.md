# 分散 SQL データベースの違い

自前運用型

| 観点 | TiDB | CockroachDB | YugabyteDB |
| --- | --- | --- | --- |
| 特徴 | **計算層と保存層を分けた** 分散 SQL。任意で列指向の TiFlash を足せる | **全ノードが SQL を受け付ける** 分散 SQL。既定の分離レベルは SERIALIZABLE | **PostgreSQL 互換の YSQL と Cassandra 系の YCQL** の 2 つの API を持つ分散 SQL |
| データモデル・実行モデル | 行と索引を KV キーに変換し、連続するキー範囲を **Region** に分ける。TiDB サーバーは行データを持たない | SQL を KV 操作に変換し、ソート済みの連続区間 **レンジ** に分ける。自分で処理できない要求は担当ノードへ転送する | テーブルを **タブレット** に分ける。主キーで 1 つに決まる。ハッシュとレンジのシャーディングを選べる |
| 一貫性・耐久性の仕組み | Region ごとに Raft グループを作り、複数 TiKV に置く。複製数と配置は設定による。トランザクションの分離レベルは未確認 | レンジごとに Raft。書き込みは過半数の合意でコミット。既定の複製数は 3。ハイブリッド論理クロック（HLC）を使い、ずれが上限を超えると線形化可能性が崩れうる | タブレットごとに Raft。多数のピアが Raft ログへ永続化した時点で書き込みが読める。HLC と MVCC で読む。分離レベルの扱いは未確認 |
| 拡張のしかた | PD が Region の配置を担う。TiKV ノードを足す手順の詳細は未確認 | 複製係数は複製ゾーンで、クラスタ・データベース・テーブルの単位に設定する。ノード追加の手順は未確認 | YB-TServer がタブレットを保持する。レンジシャーディングは増加に応じて動的に分割される。ノード追加の手順は未確認 |
| 運用の形態 | TiDB・PD・TiKV・TiFlash を運用する。学習用は TiUP playground による単一ホスト。本番構成の資料は未確認 | `cockroach start` で 3〜5 台を `--join` し、`cockroach init`、証明書、NTP を利用者が運用する。入口の分散に HAProxy を使える | YB-Master（カタログ・調整）と YB-TServer を利用者が運用する。YB-Master は 3 台の例。ユニバース間は xCluster の非同期複製 |
| 得意な用途 | 同じデータを TiKV（行）と TiFlash（列）で扱う HTAP | 資料に用途の明記なし（未確認）。1 台の障害に耐える構成は 3 ノード | クラウドネイティブな OLTP。資料はゾーン障害時に RPO 0、RTO 約 3 秒としている |
| 注意点 | TiFlash は **対象表ごとにレプリカを設定** する。単一ホストの playground は本番の根拠にならない。本リポジトリでは実行未検証 | クロックのずれが最大オフセットの 80% を超えるとノードが停止する。PostgreSQL 互換の範囲は未確認 | 範囲検索はハッシュシャーディングが不得手。レンジシャーディングはホットスポットが起きうる。YCQL は非トランザクションモードの xCluster のみ |
| ライセンス | 未確認 | **OSS ではない**。24.3.0 のリリース日以降の版は CockroachDB Software License。Enterprise Free は年間売上 1,000 万ドル未満の企業向けで、年次更新とテレメトリが必要 | データベース本体は Apache License 2.0。管理基盤 YugabyteDB Anywhere は Polyform Free Trial License 1.0.0 |

内容は 2026 年 11 月時点の公式資料に基づきます。確認できなかった点は「未確認」と書いています。

## 選び方

- 同じデータで行単位の更新と列指向の分析を両立する → **TiDB**
- 全ノードが SQL を受け、SERIALIZABLE を既定にする（ライセンス条件を確認のうえ） → **CockroachDB**
- PostgreSQL 互換の API と Cassandra 系の API を併用し、ライセンスを Apache 2.0 にしたい → **YugabyteDB**

## 公式資料

- [TiDB architecture](https://docs.pingcap.com/tidb/stable/tidb-architecture/)
- [TiDB storage](https://docs.pingcap.com/tidb/stable/tidb-storage/)
- [TiFlash replicas](https://docs.pingcap.com/tidb/stable/create-tiflash-replicas/)
- [TiUP playground](https://docs.pingcap.com/tidb/stable/tiup-playground/)
- [CockroachDB Architecture overview](https://docs.cockroachlabs.com/docs/stable/architecture/overview)
- [CockroachDB Transaction layer](https://docs.cockroachlabs.com/docs/stable/architecture/transaction-layer)
- [CockroachDB Replication layer](https://docs.cockroachlabs.com/docs/stable/architecture/replication-layer)
- [CockroachDB Licensing FAQs](https://docs.cockroachlabs.com/docs/stable/licensing-faqs)
- [yugabyte-db（GitHub）](https://github.com/yugabyte/yugabyte-db)
- [YugabyteDB architecture](https://docs.yugabyte.com/preview/architecture/)
- [YugabyteDB Sharding data across nodes](https://docs.yugabyte.com/preview/architecture/docdb-sharding/sharding/)
- [YugabyteDB Replication in DocDB](https://docs.yugabyte.com/preview/architecture/docdb-replication/replication/)
- [YugabyteDB xCluster replication](https://docs.yugabyte.com/preview/architecture/docdb-replication/async-replication/)
