# Trino：プッシュダウンと Dynamic Filtering

Trino 484 の公式ドキュメントを基準に、読むデータを減らす 2 つの仕組み（Connector へのプッシュダウンと、実行時に作る dynamic filter）を整理する。前提は「Trino：Stage・Task・Split と Exchange」（Split と Stage）と、「Trino：メモリ管理とスピル」（結合のビルド側がメモリに載る）。

## 1. 対象と前提

- 対象は、データソースから読む量と Split の数を減らす仕組み。
- 前者は計画時に決まり、後者は結合のビルド側を処理してから実行時に決まる。
- どちらも対応は Connector ごとに異なる。

## 2. プッシュダウンの種類

Trino は、クエリの一部をつないだデータソースに任せることができる。対応は Connector とデータソースによる。

- **述語**：`WHERE` などの条件で行を絞る。成功すると、`EXPLAIN` にその条件の `ScanFilterProject` が出なくなる。
- **射影**：クエリが使う列だけを読む。成功すると、`TableScan` に必要な列だけが出る。
- **dereference**：`ROW` 型の中の指定フィールドだけを読む。射影の細かい形。
- **集約**：`count` などの集約関数を Connector 側で実行する。成功すると `Aggregate` が計画から消える。`ROLLUP`・`CUBE`・`GROUPING SETS` などは対象外。
- **結合**：同じカタログのテーブルの結合をデータソースに任せる。結合条件が押し込めることが前提。
- **LIMIT**：並び順のない `LIMIT` を押し込み、Trino に転送されるデータを減らす。
- **Top-N**：`ORDER BY` と `LIMIT` を押し込み、上位 N 行だけを返す。成功すると `TopN` が計画から消える。

## 3. Connector ごとの違い

- 押し込めるかどうかは Connector が決める。Iceberg Connector には射影の押し込み（`iceberg.projection-pushdown-enabled`、既定 `true`）と、大きな述語リストを圧縮する `iceberg.domain-compaction-threshold`（既定 1000）の設定がある。
- 結合の順序とビルド側の選択（`join_reordering_strategy`、`join_distribution_type`）は、Connector が返すテーブル統計を使うコストベース最適化で決まる。統計がないと、`AUTOMATIC` でも `ELIMINATE_CROSS_JOINS` に戻る。

## 4. Dynamic Filtering の仕組み

- 選択的な結合で、結合が捨てるデータを読まないために使う。既定で有効。
- 結合のビルド側（右側）の処理中に、結合キーの候補値を集める。
- **broadcast 結合**：集めた条件をプローブ側（左側）のローカルのスキャンに押し込む。条件は Coordinator にも送られ、Split の絞り込みに使われる。Hive Connector ではこれを dynamic partition pruning と呼ぶ。
- **partitioned 結合**：Coordinator が条件を Worker に配り、プローブ側のスキャンに適用する。

## 5. 適用先と対応する結合

- 適用先は、プローブ側のテーブルスキャン（ORC や Parquet の stripe・row group の除外など Connector 側の絞り込みを含む）と、Coordinator の Split 列挙。
- 対応する結合は、`=`・`<`・`<=`・`>`・`>=`・`IS NOT DISTINCT FROM` の条件を持つ inner 結合と right 結合、および `IN` の semi-join。
- 前提：プランナーが dynamic filter を作ること、Connector が対応していること、ビルド側が小さいテーブルであること（コストベース最適化が統計で選ぶ）。

## 6. 設定と確認

- `enable-dynamic-filtering`（セッションでは `enable_dynamic_filtering`）で有効・無効を切り替える。
- 集める値の上限は `dynamic-filtering.max-distinct-values-per-driver`、`dynamic-filtering.max-size-per-driver`、`dynamic-filtering.range-row-limit-per-driver`。partitioned 結合は `dynamic-filtering.partitioned.*`。上限を超えると、列ごとの最小値と最大値の収集に切り替わり、精度は落ちるが絞り込みは続く。
- Iceberg Connector では、Split の生成が dynamic filter の完了を待つ時間を `iceberg.dynamic-filtering.wait-timeout`（既定 1s）で決める。
- `EXPLAIN` が結合ノードの dynamic filter の割り当てとスキャンの条件を示す。`EXPLAIN ANALYZE` はスキャンの dynamic filter の統計を出す。
- 制限：最小値・最大値の収集は `DOUBLE`・`REAL`・順序のない型に対応しない。`IS NOT DISTINCT FROM` は `DOUBLE`・`REAL` に対応しない。

## 7. 実装例：EKS 上の Trino・Glue Catalog・S3

「Trino の基本アーキテクチャ」と同じ構成の例。EKS の EC2 マネージドノードグループに Trino Helm チャートで Coordinator Pod と Worker Pod を配置し、Iceberg Connector が Glue Data Catalog でメタデータ位置を解決して、S3 の Iceberg テーブルを読む。クライアントは別途設定した経路で Coordinator に SQL を送る。

| 機能 | 担い手 |
| --- | --- |
| SQL | 外部の Trino CLI |
| オプティマイザー・Split 列挙・dynamic filter の配布 | Trino Coordinator Pod |
| Connector | Coordinator Pod と Worker Pod の Iceberg Connector |
| プローブ側のスキャン・結合のビルド側 | Trino Worker Pods |
| データソース・統計 | Amazon S3 上の Iceberg テーブルとメタデータ |

Iceberg Connector のテーブル統計がどこに保持され、どの設定で参照されるかは、確認した資料では扱っていない。ここでは S3 上のテーブルとメタデータに置く例とし、Glue が持つかは断定しない。

AWS が EKS 制御プレーンと EC2・Glue・S3 の基盤を運用する。利用者は Kubernetes API、ノードグループ、Trino の配置・設定・更新、カタログ、S3 データ、IAM 権限を管理する。図は公式資料を組み合わせた代表例で、実動作は未検証。バージョン互換性、ネットワーク経路、クライアントの公開方式は未確認。

- [Trino on Kubernetes with Helm](https://trino.io/docs/current/installation/kubernetes.html)
- [Trino Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)
- [Trino S3 file system](https://trino.io/docs/current/object-storage/file-system-s3.html)
- [Amazon EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [IAM roles for service accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)

## 公式資料

- [Trino · Pushdown](https://trino.io/docs/current/optimizer/pushdown.html)
- [Trino · Dynamic filtering](https://trino.io/docs/current/admin/dynamic-filtering.html)
- [Trino · Cost-based optimizations](https://trino.io/docs/current/optimizer/cost-based-optimizations.html)
- [Trino · Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)
