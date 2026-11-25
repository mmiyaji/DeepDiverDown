# ClickHouse の基本アーキテクチャ

## 1. 対象と読み方

ClickHouse は列指向の分析用データベース。この図は初めて学ぶ人向けに、SQL を受ける層、テーブルエンジン、保存、複数サーバーへの分散と複製を一枚で示す。構成は説明用で、実環境の計測値は含まない。

仕組みは次の順で掘り下げる。

1. [MergeTree のパートと疎インデックス](reference-clickhouse-mergetree.md)：保存の単位と読む範囲の絞り込み
2. [レプリケーションと Keeper](reference-clickhouse-replication.md)：同じデータを複数サーバーに持つ仕組み
3. [Distributed テーブルとシャード越えのクエリ](reference-clickhouse-distributed-query.md)：複数シャードを 1 つの表として読む仕組み

## 2. クエリ処理の層

エンジンは大きく、クエリ処理、ストレージ、外部との統合の三層に分かれる。ユーザーのセッションやクライアントのプロトコルを扱うアクセス層がある。ClickHouse は C++ で書かれ、依存のない単一の静的リンクのバイナリとして配布される。クライアントは SQL を送り、結果を受け取る。

## 3. ベクトル化された列指向の実行

実行モデルは MonetDB/X100 に似たベクトル化で、演算子は 1 行ずつでなく複数行のまとまり（データチャンク）を一度に渡す。これで仮想関数呼び出しのコストを抑える。保存の形式は厳密に列指向。必要に応じたコード生成（コンパイル）も併用する。

## 4. テーブルエンジン

テーブルごとにエンジンを選び、データの保存、読み取り、複製、分散の方法を決める。この図では次の 3 種類を扱う。

- `MergeTree` 系：ローカルのディスクにパートとして保存する。
- `ReplicatedMergeTree`：`MergeTree` に複製を加える。
- `Distributed`：データを持たず、複数シャードへの窓口になる。

## 5. MergeTree ストレージ

`MergeTree` のテーブルは、不変のパートの集まり。INSERT のたびに新しいパートができ、バックグラウンドで小さいパートがより大きいパートにマージされる。パートは主キー順に並び、行はグラニュール（既定 8192 行）にまとまる。インデックスは疎で、各グラニュールの先頭行のキーだけを持つ。クエリは `PARTITION BY` による除外と、この疎主インデックスで読む範囲を絞る。主キーに一意性の制約はない。詳細は [MergeTree のパートと疎インデックス](reference-clickhouse-mergetree.md)。

## 6. シャードと Distributed テーブル

シャードはデータを分けて持つ単位。1 つのシャードは 1 台以上のレプリカからなる。クラスターの構成は設定の `remote_servers` に書く。`Distributed` テーブルはクラスター名、データベース、テーブル、必要に応じて分散キーを指定して作る。SELECT は全シャードへ送られ、読み取りは自動的に並列化される。集約は一部を遠隔のサーバーで行い、途中の集約状態を依頼元へ返せる。INSERT には分散キーが要る（シャードが 1 つの場合などを除く）。書き込みは既定でローカルに保存され、バックグラウンドでシャードへ送られる。詳細は [Distributed テーブルとシャード越えのクエリ](reference-clickhouse-distributed-query.md)。

## 7. レプリカと ClickHouse Keeper

`ReplicatedMergeTree` は複数のレプリカが同じデータを持つ。INSERT と ALTER は利用できるどのサーバーにも送れ、まずローカルに書き、あとからほかのレプリカへ複製する（非同期のマルチマスター）。複製の調整にはレプリカのメタデータを保持する ClickHouse Keeper を使う。Keeper は Raft で合意し、ZooKeeper のクライアントから使える。高可用性のため 3 台以上を推奨し、本番では専用ホストを勧める。Keeper がなければ複製表は作れず、既存の複製表は読み取り専用になる。SELECT は Keeper を使わない。詳細は [レプリケーションと Keeper](reference-clickhouse-replication.md)。

## 8. 実装例：自前運用クラスター（Linux ホストの Server と Keeper）

利用者が Linux ホストに ClickHouse Server と Keeper を導入する代表例。公式の手順（シャードの例と、レプリカの例）を組み合わせた説明用の構成で、実在の導入事例や動作検証済みの構成ではない。

| 機能 | 担い手 |
| --- | --- |
| SQL クライアント | `clickhouse-client` |
| SQL の解析と計画、列処理、テーブルエンジン | 各ホストの `clickhouse-server` |
| Distributed テーブル | Server 上の `Distributed` エンジンの表 |
| シャード内のレプリカ | `ReplicatedMergeTree` の表（`shard`、`replica` のマクロで識別） |
| パート | 各ホストのローカルディスク |
| ClickHouse Keeper | 3 台以上（公式の例は 3 台。本番では専用ホスト推奨） |

加わる部品は設定ファイル。`remote_servers` でクラスターを定義し（`ON CLUSTER` の分散 DDL のひな形にもなる）、`macros` に `shard` と `replica` を書き、`zookeeper` に Keeper の接続先を書く。レプリカを持つシャードでは `internal_replication` を `true` にして、Distributed からの書き込みを 1 つのレプリカだけにする。運用者が OS、更新、バックアップ、容量を管理する。公式の例はシャードだけ、レプリカだけの構成で、両方を組み合わせた構成とサイズは各自で設計する。Kubernetes 上の構成は未確認。

- [ClickHouse の水平スケール](https://clickhouse.com/docs/architecture/horizontal-scaling)
- [ClickHouse の複製](https://clickhouse.com/docs/architecture/replication)
- [ClickHouse Keeper](https://clickhouse.com/docs/guides/sre/keeper/clickhouse-keeper)

## 9. 実装例：ClickHouse Cloud

ClickHouse Cloud ではデータをオブジェクトストレージに置き、計算が自動でスケールする。Cloud の MergeTree 系の表は、ReplicatedMergeTree に代わる SharedMergeTree で動く。メタデータを全サーバーにコピーする必要がなく、レプリカは共有ストレージと Keeper を通じて、非同期でリーダーなしに調整する。シャードを増やさずに多数のレプリカへ拡張できる。複数の計算ノードグループが同じオブジェクトストレージを共有することもできる（計算と計算の分離）。

| 機能 | 担い手 |
| --- | --- |
| SQL クライアント | サービスの URL へ接続するクライアント |
| SQL の処理、テーブルエンジン | 計算ノード（レプリカ） |
| 複製のエンジン | SharedMergeTree |
| パート | オブジェクトストレージ（サービスごとに分離） |
| 調整 | ClickHouse Keeper |

図の ClickHouse Cloud の枠は、計算ノード、SharedMergeTree、オブジェクトストレージ、Keeper を含むサービスの論理的な範囲を示す。ストレージ分離の仕方はクラウドごとに異なる（AWS は共有バケット内のサービスごとのプレフィックス、GCP はバケット、Azure はコンテナ）。Keeper の配置・台数と内部の制御系の構成は未確認である。

- [ClickHouse Cloud のアーキテクチャ](https://clickhouse.com/docs/cloud/reference/architecture)
- [SharedMergeTree](https://clickhouse.com/docs/cloud/reference/shared-merge-tree)

## 公式資料

- [ClickHouse アーキテクチャ概説](https://clickhouse.com/docs/academic_overview)
- [ClickHouse MergeTree table engine](https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree)
- [ClickHouse Distributed table engine](https://clickhouse.com/docs/engines/table-engines/special/distributed)
- [ClickHouse データレプリケーション](https://clickhouse.com/docs/engines/table-engines/mergetree-family/replication)
- [ClickHouse Keeper](https://clickhouse.com/docs/guides/sre/keeper/clickhouse-keeper)
- [ClickHouse の水平スケール](https://clickhouse.com/docs/architecture/horizontal-scaling)
- [ClickHouse の複製](https://clickhouse.com/docs/architecture/replication)
- [ClickHouse Cloud のアーキテクチャ](https://clickhouse.com/docs/cloud/reference/architecture)
- [SharedMergeTree](https://clickhouse.com/docs/cloud/reference/shared-merge-tree)
