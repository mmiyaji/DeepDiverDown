# YugabyteDB の概要（YSQL・YCQL・タブレット・Raft・DocDB）

## 1. 概要とライセンス

YugabyteDB は PostgreSQL 互換をうたう分散 SQL データベースである。公式の GitHub リポジトリは、データベース本体を Apache License 2.0、管理基盤 YugabyteDB Anywhere（`managed/`）を Polyform Free Trial License 1.0.0 としている。既定のビルドは Apache 2.0 のデータベースのバイナリだけを作る。商用サービスもある（提供形態の詳細は未確認）。得意とするのはクラウドネイティブな OLTP とされる。

- [yugabyte-db（GitHub）](https://github.com/yugabyte/yugabyte-db)
- [Tablet splitting](https://docs.yugabyte.com/preview/architecture/docdb-sharding/tablet-splitting/)（2026年11月28日取得。§4 のタブレット分割の根拠）
- [Colocated tables](https://docs.yugabyte.com/stable/additional-features/colocation/)（2026年11月28日取得。§4 のコロケーションの根拠。preview 版の同名ページは stable 版へ転送された）

## 2. 2 層構造と API

公式資料はクエリ層とストレージ層に分ける。クエリ層は YSQL と YCQL の 2 つの API を受け持ち、読み書きを適切なデータへ振り分ける。YSQL は PostgreSQL のクエリ層を再利用した完全なリレーショナル API で、データ型、ストアドプロシージャ、トリガー、拡張を含め多くの PostgreSQL 機能を使える。YCQL は Cassandra QL を起源にもつ準リレーショナル API である。ストレージ層は DocDB で、RocksDB を土台にしたドキュメントストアがタブレットのデータを保持する。

- [YugabyteDB architecture](https://docs.yugabyte.com/preview/architecture/)

## 3. YB-Master と YB-TServer

YB-Master はカタログの管理とクラスタの調整を担当し、多くのバックグラウンド処理を実行する。YB-TServer は各ノードで動き、そのノードのタブレットを保持・管理する。YB-Master のメタデータの保存方式は取得した資料に記載がなく未確認。

## 4. タブレットとシャーディング

DocDB はテーブルをタブレットという複数のシャードとして管理する。行の主キーでタブレットが 1 つに決まる。

- ハッシュシャーディング：シャード列のハッシュで行を散らす。ハッシュ空間は 2 バイトで、最大 64K タブレット。16 タブレットなら各 4,096 値を担当する。範囲検索は不得手。YSQL は `PRIMARY KEY (customer_id HASH)` のように指定し、YCQL は既定でハッシュ。
- レンジシャーディング：主キーの並びで連続した範囲に分ける。最初は 1 タブレットで、データの増加に応じて動的に分割される。範囲検索に向くがホットスポットが起きうる。YSQL は `ASC` などで指定し、YCQL は非対応。

タブレット分割には 3 通りある。事前分割はテーブル作成時にタブレット数を決める方法で、ハッシュシャーディングの YSQL は `SPLIT INTO n TABLETS`、YCQL は `WITH tablets` で指定し、レンジシャーディングの YSQL は `SPLIT AT VALUES` で分割点を並べる。手動分割は稼働中のテーブルに `yb-admin split_tablet <tablet_uuid>` を実行する。タブレットの併合は未対応で、手動分割を使いすぎるとタブレットの大きさとアクセスが偏る。自動分割は 2.18.0 から既定で有効で、ノードあたりのタブレット数に応じた 3 段階の閾値（128 MiB、10 GiB、100 GiB）で分割する。新しいハッシュシャーディングのテーブルは、既定でノードごとに 1 タブレットになる。コロケーションは、関連する複数のテーブルを 1 つの親タブレット（コロケーションタブレット）に置き、テーブルごとにタブレットを作らない方式で、データはクラスタの RF に従って複製される。クラスタ全体の既定は `ysql_colocate_database_by_default = true`、データベース単位は `CREATE DATABASE <name> with COLOCATION = true` で指定する。コロケーションされたデータベース内のテーブルは既定でコロケーションされ、`WITH (COLOCATION = false)` で外せる。コロケーションされたテーブルは分割できない。負荷が偏るテーブルはコロケーションしないよう資料は勧めている。コロケーションタブレット内の内部配置と、コロケーション済みテーブルの性能は未確認。

- [Sharding data across nodes](https://docs.yugabyte.com/preview/architecture/docdb-sharding/sharding/)

## 5. トランザクション

DocDB の更新は、単一行も複数ノードにまたがるものも、すべてトランザクションとして扱う。自動コミットでは 1 文が 1 トランザクションになる。各ノードのハイブリッド論理クロック（HLC）は物理時刻と論理部分の組で、RPC のたびに値を交換して高いほうへ合わせる。トランザクションは HLC から決めた時刻の版を MVCC で読み、行ロックを取らない。未コミットの値は通常の値とは別の領域に暫定レコードとして置き、部分的に適用された状態を他のノードから見せない。トランザクションステータステーブルと分離レベルの扱いは未確認。

- [Distributed transactions overview](https://docs.yugabyte.com/preview/architecture/transactions/transactions-overview/)

## 6. Raft による複製と耐久性

タブレットごとに Raft グループがあり、リーダー 1 つがユーザーの書き込みを受けてフォロワーに複製する。フォロワーはホットスタンバイになる。多数のタブレットピアが Raft ログに永続化した時点で、書き込みが適用され読めるようになる。ログは、データがディスクに載った後にバックグラウンドで削除される。障害を f 個のフォールトドメインまで許容するには RF を 2f+1 以上にする（RF 3〜4 で 1 件、RF 5〜6 で 2 件）。強い一貫性の読み取りはリーダーを通り、フォロワーは緩い保証で読み取りを返せる。公式資料はゾーン障害時に RPO 0、RTO 約 3 秒としている（公式の記載であり、本資料では測定していない）。リーダーリースの詳細は未確認。

- [Replication in DocDB](https://docs.yugabyte.com/preview/architecture/docdb-replication/replication/)

## 7. xCluster（ユニバース間の非同期複製）

2 つのユニバース間で DocDB 層の WAL レコードを非同期に複製する。1 本の流れは送信元から送信先への一方向で、逆向きにもう 1 本張ると双方向になる。YSQL と YCQL の両方に対応する。非トランザクションモードは送信先でも書き込めるが、直近の複製データの読み取りが不整合になりうる（YCQL はこのモードのみ）。YSQL 限定のトランザクションモードは送信先を読み取り専用にし、通常は 1〜2 秒に複製遅延を足した遅れの安全時刻で読む。リードレプリカとの違いは未確認。

- [xCluster replication](https://docs.yugabyte.com/preview/architecture/docdb-replication/async-replication/)

## 8. 実装例：自前のサーバー上のユニバース

| 機能 | 具体的な担い手 |
| --- | --- |
| クライアント | PostgreSQL・Cassandra 系のドライバー |
| カタログ・調整 | YB-Master（3 台） |
| API・トランザクション・タブレット・Raft | YB-TServer |
| WAL・データ | ノードのローカルディスク（Raft ログと DocDB） |
| ユニバース間の複製 | 別ユニバースへの xCluster |

利用者が自前のサーバーで YB-Master、YB-TServer、OS、ディスクを運用する構成。公式資料に基づく代表例であり、導入事例や動作検証済みの構成ではない。YB-Master と YB-TServer を 3 台とする台数は RF 3 を前提にした例示で、ゾーン配置、TLS・認証、バージョンは未確認。マネージド版（YugabyteDB Aeon）は取得した資料で確認していないため、実装例にしていない。
