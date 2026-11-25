# ClickHouse：Distributed テーブルとシャード越えのクエリ

## 1. 対象と前提

[ClickHouse の基本アーキテクチャ](reference-clickhouse.md)の「シャードと Distributed テーブル」を掘り下げる。前の図 [レプリケーションと Keeper](reference-clickhouse-replication.md) で同じシャード内のレプリカができる前提で、複数のシャードを 1 つの表として読み書きする流れを追う。構成は説明用で、実環境の計測値は含まない。

## 2. クラスター定義と Distributed テーブル

`Distributed` テーブルは、クラスター名、データベース、テーブルを引数に取り、必要に応じて分散キー（`sharding_key`）と `policy_name` を指定する。クラスター名はサーバーの設定ファイルの項目を指す。`remote_servers` にシャードとレプリカのホスト、ポート（TCP ポート。通常 9000）を書く。`ON CLUSTER` の分散 DDL はこの定義をひな形に使う。公式の例では、2 つのシャードのクラスターに、`Distributed('cluster_2S_1R', 'test', 'test_table', rand())` の表を作る。`rand()` で挿入を各シャードへランダムに分ける。

## 3. SELECT：全シャードへ並列に問い合わせる

SELECT は全シャードに送られ、読み取りは自動的に並列化される。遠隔の表にインデックスがあれば使う。集約は一部を遠隔のサーバーで実行でき、途中の集約状態を依頼元へ返す。各シャードでは、利用できるレプリカを 1 つ選ぶ。選び方は `load_balancing` で決まり、レプリカの `priority` は既定が 1 で、小さい値ほど優先される。接続に失敗すると次のレプリカを試す。

公式の例のように、レプリカが 1 台のシャードでは、そのサーバーを止めると Distributed テーブルへのクエリが失敗する（耐障害性がない）。レプリカを加えると、残りのレプリカで読める。

## 4. INSERT：分散キーとバックグラウンド送信

INSERT には `sharding_key` が必要（シャードが 1 つの場合、または `insert_distributed_one_random_shard` を有効にした場合を除く）。各シャードの割り当ては、シャードの重み（既定 1）に比例する。既定では、挿入したブロックをまずローカルのファイルシステムに書き、バックグラウンドでシャードへ送る。`distributed_foreground_insert` を有効にすると、この動作は変わる。`fsync_*` の耐久性設定はバックグラウンド送信にだけ働く。

## 5. internal_replication と複製表

`internal_replication` の既定は `false` で、Distributed が全レプリカへ書き込み、複製も Distributed が担う。`true` にすると、書き込みは最初の健全なレプリカだけに送られ、複製は表のエンジンに任せる。`Replicated*MergeTree` では `true` を勧める。公式のレプリカの例も `true` にして、データを 1 つのレプリカにだけ書かせている。複製の仕組みは [レプリケーションと Keeper](reference-clickhouse-replication.md) を参照。

## 6. 実装例：自前運用（2 シャード x 各 2 レプリカの Server と Keeper）

公式のシャードの例（2 シャード 1 レプリカ）とレプリカの例（1 シャード 2 レプリカ）を組み合わせた説明用の構成。公式資料にこの組み合わせの手順そのものはなく、実在の導入事例や動作検証済みの構成ではない。

| 機能 | 担い手 |
| --- | --- |
| クラスター定義 | 設定ファイルの `remote_servers` |
| Distributed テーブル、集約 | クライアントが接続する Server の `Distributed` の表 |
| 送信待ち | 同じホストのローカルディスク |
| シャード 1、2 | 各シャードの `ReplicatedMergeTree`（`internal_replication` は `true`） |
| Keeper | 3 台の ClickHouse Keeper |

運用者が OS、更新、バックアップ、容量を管理する。Kubernetes 上の構成は未確認。

- [ClickHouse の水平スケール](https://clickhouse.com/docs/architecture/horizontal-scaling)
- [ClickHouse の複製](https://clickhouse.com/docs/architecture/replication)

## 公式資料

- [ClickHouse Distributed table engine](https://clickhouse.com/docs/engines/table-engines/special/distributed)
- [ClickHouse の水平スケール](https://clickhouse.com/docs/architecture/horizontal-scaling)
- [ClickHouse の複製](https://clickhouse.com/docs/architecture/replication)
