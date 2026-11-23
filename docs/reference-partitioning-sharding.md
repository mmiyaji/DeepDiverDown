# データ配置と並列性：パーティショニングとシャーディング

## 1. 読み方と範囲

このリファレンスは、注文データを例に、論理的に1つの `orders` を複数の保存単位へ配置し、読み書きを並列化する考え方を示す。図のノードは説明用の役割であり、ノード数、容量、レプリカ数、クラウド製品の構成を実環境の値として表さない。ここでは、`order_date` による時間パーティションと、`customer_id` のハッシュによるシャードを組み合わせる。

「パーティショニング」は、同じ論理テーブル（またはデータセット）を、キーに応じた複数の物理的なパーティションへ分けることを指す。「シャーディング」は、複数の独立した保存先や処理単位へ分散して、容量・スループットを水平に増やす構成を指す。製品によって呼び方や実装境界は異なるため、図では論理テーブル、時間パーティション、ハッシュシャードを別ノードとして表す。

出典 [PostgreSQL Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)・[Apache Iceberg Partitioning](https://iceberg.apache.org/docs/latest/partitioning/)・[Amazon DynamoDB Partitions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.Partitions.html)

## 2. 時間パーティション：`order_date` で表を分ける

注文を `order_date` の月や日で範囲分割すると、期間条件を含む検索は関係しないパーティションを読まずに済む。PostgreSQL はパーティション境界に基づく partition pruning をクエリ計画時または実行時に行える。古いデータの保持期限が来たときも、個々の行を大量に削除する代わりに、古いパーティションを取り外す運用を選べる。

データレイクのファイル配置でも同じ考え方がある。Iceberg の `day(order_date)` のような変換は、行を日付ごとのファイル群にまとめ、不要なファイルをスキップする。Iceberg の hidden partitioning は、利用者が物理的な `order_date_day` 列を手で生成・指定しなくても、論理列と物理配置の関係を追跡する。したがって、表のパーティション（クエリの枝）と、ファイルシステム／オブジェクトストレージ上のファイル配置（保存の単位）は関連するが同一ではない。

出典 [PostgreSQL Partition Pruning](https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-PRUNING)・[Apache Iceberg What is partitioning?](https://iceberg.apache.org/docs/latest/partitioning/#what-is-partitioning)・[Apache Iceberg Hidden Partitioning](https://iceberg.apache.org/docs/latest/partitioning/#hidden-partitioning)

## 3. ハッシュシャード：`customer_id` で書き込み先を分散する

時間パーティションだけでは、当日の注文が同じ保存単位へ集中することがある。そこで、各時間パーティションの中を `hash(customer_id) mod N` のような決定的な規則で複数シャードへ振り分ける。図の A と B は、同じ論理的な時間範囲を担当するシャードの例である。実際の N や再配置手順は環境ごとに決める。

DynamoDB の公式説明でも、パーティションキーの値を内部ハッシュ関数へ入力し、その結果で保存・読み出し先を決める。アクセス頻度が均一になる高カーディナリティのキーは負荷を分散しやすい一方、少数の値や人気のある値に偏るキーは hot partition を作り得る。この例では `customer_id` をハッシュキーとして使うが、顧客ごとの注文量が極端に偏る場合は、追加のバケットや別のアクセスモデルを検討する。

出典 [Amazon DynamoDB Partitions and data distribution](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.Partitions.html)・[DynamoDB Partition Key Design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html)・[DynamoDB Uniform Workload](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-uniform-load.html)

## 4. 書き込みルーティング：論理キーから保存先へ

注文 API は論理テーブルへ書き込む。ルーターは `order_date` から時間パーティションを、`customer_id` からハッシュシャードを計算し、組み合わせた保存先へ送る。これが「どの行をどこへ置くか」の書き込みルーティングである。

データベースの宣言的パーティショニングでは、親テーブルへの INSERT を対応する子パーティションへ内部的にルーティングできる。アプリケーションが物理テーブル名を組み立てる方式では、境界の追加・タイムゾーン・再送時の一貫性を別途管理しなければならない。図の矢印は設計上の経路を示し、複製、トランザクション、再試行の保証までは仮定しない。

出典 [PostgreSQL Declarative Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-DECLARATIVE)・[PostgreSQL Partitioning Overview](https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-OVERVIEW)

## 5. 読み出しとタスク分割：選択的検索と全体集計

期間条件と顧客条件がある検索では、ルーターが時間パーティションとハッシュシャードを絞り込み、対象だけを読む。期間条件がない全期間集計では複数パーティション・複数シャードを読む必要があり、クエリをタスクへ分割して並列に実行し、最後に結果をマージする。これは保存パーティションそのものを増やす操作ではなく、処理側のタスク分割である。

Trino では、Split はデータセットの読み取り範囲で、Worker 上の Task が担当する。タスク数と保存パーティションの数は別々に考える。並列度を上げても、遅いホットシャード、ネットワーク、最終マージが全体の待ち時間を決める点に注意する。

出典 [Trino・Tasks と Splits](https://trino.io/docs/current/overview/concepts.html#split)・[PostgreSQL Partition Pruning](https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-PRUNING)

## 6. 偏りと運用上のトレードオフ

パーティションやシャードを増やせば常に速くなるわけではない。`order_date` の当日書き込みは時間パーティションへ集中し、人気顧客は `customer_id` のハッシュ先を hot にする。逆に細かく分けすぎると、クエリ計画、メタデータ、ファイル数、接続数、マージ処理のコストが増える。範囲パーティションは期間検索と保持期限管理に向くが、直近範囲へ書き込みが集中しやすい。ハッシュシャードは均等化しやすいが、顧客単位の範囲検索や再シャーディングが複雑になる。

対策はアクセスパターンを先に定義し、キーの分布、パーティションごとの読み書き量、ファイルサイズ、遅延を観測することである。DynamoDB は均一な活動を partition key 全体に分散する設計を勧め、PostgreSQL はパーティション数を無制限に増やすのではなく、pruning が効く検索と保守作業の効果を確認するよう示している。ここでのノードは対策済みの本番構成を意味せず、偏りを検証する観点を示す。

出典 [DynamoDB Partition Key Design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html)・[DynamoDB Uniform Workload](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-uniform-load.html)・[PostgreSQL Partition Maintenance](https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-MAINTENANCE)

## 7. シナリオ：注文の書き込み、顧客検索、月次集計

1. `order-api` が `order_date=2026-11-23` と `customer_id=C42` を含む注文を受け、`partition-router` に渡す。
2. ルーターが当日の時間パーティションを選び、`hash(C42)` の結果から担当シャードを選んで書き込む。
3. 顧客別検索では同じキーから同じ候補へ直接読み出し、不要なシャードを避ける。
4. 月次集計では対象月の全時間パーティションとシャードをタスクへ分割し、`query-worker` が並列に部分集計する。
5. 部分結果をマージし、ホットシャードや欠落したパーティションがないかメトリクスで確認する。

この流れは、書き込み時の決定的な配置、読み出し時の pruning／ルーティング、分析時のタスク並列化を一続きで見るための例である。実際に必要な一貫性、再試行、レプリカ、再シャーディング、バックフィルの方式は採用するデータベースやテーブル形式の仕様に従って別途決める。

出典 [PostgreSQL Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)・[Apache Iceberg Partitioning](https://iceberg.apache.org/docs/latest/partitioning/)・[Amazon DynamoDB Partitions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.Partitions.html)・[Trino・Tasks と Splits](https://trino.io/docs/current/overview/concepts.html#split)

## 8. ノード追加とシャードの再配置

保存先のノードを増やすとき、キーをノード数で割った余り（hash mod N）で置き場所を決めていると、N が変わるだけでほとんどのキーの置き場所が変わり、大量のデータ移動が起きる。固定数のスロット（論理シャード）にキーを割り当て、スロットをノードに割り当てる方式や、コンシステントハッシュでは、新しいノードへ一部のスロットだけを移せばよく、移動量はおよそ全体の 1/N に抑えられる。移動中も読み書きを続けるため、移すスロットを順に複製してから担当を切り替える。

## 9. 実装例：ClickHouse Distributed と各シャードの MergeTree

ClickHouse の Distributed 表から、顧客のハッシュで二つのデータシャードへ振り分ける例。各シャードのローカル表では注文日を月で分割する。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 注文 API | 注文 API の ClickHouse クライアント | 顧客 ID と注文日を持つレコードを投入する。 |
| パーティション／シャードルーター、論理 orders テーブル | ClickHouse の Distributed 表と調整ノード | ハッシュを使って行を分配し、検索時はシャードの部分結果を集める。 |
| order_date 時間パーティション、customer_id ハッシュシャード A | シャード A のローカル MergeTree 表 | 担当顧客の注文を持ち、その中を注文日の月で分ける。 |
| order_date 時間パーティション、customer_id ハッシュシャード B | シャード B のローカル MergeTree 表 | 同じパーティション式で別の顧客集合を持つ。 |
| 並列クエリタスク | 各シャードでの読取と部分集計 | 条件に合うパートを読み、集約の中間状態を送り返す。 |

実装で加わる部品を以下に示す。

- remote_servers とシャード式の設定。シャードの接続先と重み、顧客キーを使う分配式を定義する。選択的読取ではシャード除外が利用可能な述語と設定を確認する。

公式資料

- [PostgreSQL Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [Apache Iceberg Partitioning](https://iceberg.apache.org/docs/latest/partitioning/)
- [Amazon DynamoDB Partitions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.Partitions.html)
- [DynamoDB Partition Key Design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html)
- [Trino・Tasks と Splits](https://trino.io/docs/current/overview/concepts.html#split)
- [ClickHouse Distributed table engine](https://clickhouse.com/docs/reference/engines/table-engines/special/distributed)
- [ClickHouse MergeTree table engine](https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/mergetree)

## 10. 実装例：AWS（ClickHouse on EC2・Amazon EBS）

同じ VPC に Linux の EC2 を3台配置し、1台を ClickHouse の調整ノード、残りをシャード A と B とする。各シャードには同じ AZ 内の専用 EBS ボリュームを接続し、ローカル MergeTree のデータディレクトリを置く。

| 機能 | 担い手 |
|---|---|
| 書き込み先の決定と部分結果の統合 | 調整ノードの ClickHouse Distributed 表 |
| ローカルの保存と部分集計 | A、B の ClickHouse Server と MergeTree |
| 月パーティション内のデータパートの保存 | シャードごとの Amazon EBS |

調整ノードの `remote_servers` に二つのシャードを定義し、Distributed 表の分配式に `cityHash64(customer_id)`、ローカル表のパーティション式に `toYYYYMM(order_date)` を使う。書き込みは `distributed_foreground_insert=1` とし、先に顧客キーでシャードを選び、その中で注文月のパートに格納する。読み取り時は各シャードで月を絞る。顧客条件から対象シャードを限定できる場合は、`optimize_skip_unused_shards` の設定と実行計画を確認する。この例は各シャード1台のため、運用者がバックアップと復旧を管理する。

- [ClickHouse Distributed](https://clickhouse.com/docs/reference/engines/table-engines/special/distributed)
- [ClickHouse MergeTree](https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/mergetree)
- [ClickHouse の Debian・Ubuntu 導入](https://clickhouse.com/docs/get-started/setup/self-managed/debian-ubuntu)
- [Amazon EBS ボリュームのアタッチ](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-attaching-volume.html)

自前例は調整ノードと二つのシャードを別の Linux ホストに置き、利用者が ClickHouse とローカルディスクを管理する。AWS 例は AWS が EC2・EBS の基盤を運用し、利用者が OS、ClickHouse、ネットワーク、データ、バックアップと復旧を管理する。いずれも公式資料を組み合わせた代表例で、各シャードのレプリカや冗長性は仮定せず、具体的な接続・性能・バージョンは未検証。
