# ClickHouse：レプリケーションと Keeper

## 1. 対象と前提

[ClickHouse の基本アーキテクチャ](reference-clickhouse.md)の「レプリカと Keeper」を掘り下げる。前の図 [MergeTree のパートと疎インデックス](reference-clickhouse-mergetree.md)で作られるパートを、同じシャードの複数サーバーへどう複製するかを追う。複製の対象は `ReplicatedMergeTree` 系のエンジンのテーブル。構成は説明用で、実環境の計測値は含まない。ClickHouse Cloud では SharedMergeTree が使われ、仕組みが異なる（基本アーキテクチャの §9）。

## 2. テーブルの識別：Keeper のパスとレプリカ名

`ReplicatedMergeTree` は、Keeper 上のテーブルのパス（`zoo_path`）とレプリカ名（`replica_name`）を引数に取る。パスは複製表ごとに一意で、レプリカ名は同じシャード内で一意にする。パラメーターには `{shard}`、`{replica}` などの置換を使え、値は設定の `<macros>` から取る（`{database}` と `{table}` は組み込み）。`ON CLUSTER` の DDL では、明示のパラメーターは使えない。公式の例では `ON CLUSTER` で全ノードに表を作り、`ReplicatedMergeTree` がデータも複製する。

## 3. INSERT：ローカルに書き、あとで複製する

複製は非同期のマルチマスター。INSERT と ALTER は利用できるどのサーバーにも送れる。データはまず受けたサーバーのローカルに書かれ、あとでほかのレプリカへコピーされるので、新しいデータがほかのレプリカで見えるまでに遅れがある。ネットワークで送るのは元のデータだけ。INSERT は既定では 1 つのレプリカの確認だけを待ち、`insert_quorum` を設定すると複数のレプリカの確認を待つ。同じデータのブロック（サイズ・行数・順序が同じ）は 1 回だけ書かれるため、ネットワーク障害後の再送は安全。

## 4. マージ：各レプリカで同じ手順

マージの実行は調整され、全レプリカで同じように行われる。マージ後のパートをネットワークで送らないので、ネットワーク使用量を抑えられる。パートの作り方とマージの内容は [MergeTree のパートと疎インデックス](reference-clickhouse-mergetree.md) と同じ。

## 5. Keeper の役割と障害時

Keeper は複製表のメタデータを保持する。更新は状態遷移として複製ログに記録される。Keeper は Raft で合意し、3 台の構成なら 1 台の障害で動作を続ける。ZooKeeper のクライアントから使えるが、データ形式とサーバー間のプロトコルは互換性がなく、同じクラスターに混在できない。高可用性のため 3 台以上を推奨し、本番では専用ホストを勧める。1 ブロックの INSERT で、Keeper に約 10 件のエントリが複数のトランザクションで追加される。

Keeper の設定がなければ複製表は作れず、既存の複製表は読み取り専用になる。SELECT は Keeper を使わない。複製表は結果整合で、収束の途中は古い状態を読み得る。公式の例では、1 台を止めて別のレプリカへ書き込んだあと、止めたサーバーを戻すと、欠けたデータを健全なレプリカから自動で同期した。

## 6. 実装例：自前運用（Linux ホストの Server 2 台と Keeper）

公式の複製の例（1 シャード 2 レプリカ、Keeper 3 台）を基にした説明用の構成で、実在の導入事例や動作検証済みの構成ではない。

| 機能 | 担い手 |
| --- | --- |
| INSERT を送るクライアント | `clickhouse-client` |
| レプリカ A、B | 2 台のホストの `ReplicatedMergeTree` の表（`macros` の `replica` で識別） |
| 各レプリカのマージ | 各 Server のバックグラウンドマージ |
| Keeper | 3 台の ClickHouse Keeper（公式の例のポートはクライアント 9181、Keeper 間 9234） |

加わる部品は設定ファイルの `macros` と `zookeeper`。OS、更新、バックアップは運用者が管理する。Kubernetes 上の構成は未確認。

- [ClickHouse の複製](https://clickhouse.com/docs/architecture/replication)
- [ClickHouse Keeper](https://clickhouse.com/docs/guides/sre/keeper/clickhouse-keeper)

## 公式資料

- [ClickHouse データレプリケーション](https://clickhouse.com/docs/engines/table-engines/mergetree-family/replication)
- [ClickHouse の複製（シャードとレプリカの構成例）](https://clickhouse.com/docs/architecture/replication)
- [ClickHouse Keeper](https://clickhouse.com/docs/guides/sre/keeper/clickhouse-keeper)
- [ClickHouse アーキテクチャ概説](https://clickhouse.com/docs/academic_overview)
