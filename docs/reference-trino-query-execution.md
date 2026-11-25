# Trino：Stage・Task・Split と Exchange

Trino 484 の公式ドキュメントを基準に、1 つの SQL が Stage・Task・Split・Driver・Exchange に分かれて実行される仕組みを追う。前提は「Trino の基本アーキテクチャ」（Coordinator と Worker の役割）。

## 1. 対象と前提

- 対象は、SQL 文が分散実行に変わり、結果になるまでの実行モデル。
- Coordinator が計画と調整、Worker が処理を担う（基本アーキテクチャ）。
- メモリ制限とスピルは次の図、Connector へのプッシュダウンと dynamic filtering はその次の図で扱う。

## 2. Statement と Query

- **Statement**：Trino に送る ANSI 互換の SQL 文（テキスト）。
- **Query**：Statement を解析して作られる実行。分散計画、Stage、Task、Split、関与する Connector を含む。Statement は文、Query は動いている処理。

## 3. 分散計画と Stage

- 分散計画は、Stage の木で表す。根の Stage（ルート）が、ほかの Stage の出力を集める。
- Stage は Coordinator が計画をモデル化するための単位で、Worker 上で直接実行されない。実行するのは Stage の Task。
- `EXPLAIN`（既定は `TYPE DISTRIBUTED`）は、計画を Fragment に分けて Exchange の位置を示す。Fragment は `SINGLE`（1 ノード）、`HASH`（ハッシュで入力を分配）、`ROUND_ROBIN`、`BROADCAST`（全ノードへ送る）、`SOURCE`（入力 Split に触れるノード）の種類を持つ。`RemoteSource` が Fragment 間の Exchange を示す。

## 4. Split と Connector

- **Split**：大きなデータの一部分。末端の Stage は Connector から Split を読み、中間の Stage は別の Stage の出力を読む。
- Coordinator が Connector に対象テーブルの Split 一覧を問い合わせ、どの Task がどの Split を処理するかを管理する。
- Iceberg Connector では、`iceberg.max-split-size` が Split の目標最大サイズ（厳密な上限ではない）、`iceberg.split-manager-threads` が Split 生成のスレッド数を決める。

## 5. Task・Driver・Operator

- **Task**：Stage の実行単位。Worker に分散され、Split を処理し、複数の Driver を並列に走らせる。
- **Driver**：メモリ上で動く Operator の並び。入力と出力を 1 つずつ持ち、Trino で最も小さい並列の単位。
- **Operator**：データを読む・変換する・出力する部品。テーブルスキャンや、述語で行を絞るフィルターなど。
- `task.concurrency` は、結合や集約など並列 Operator の既定のローカル並列度（2 の累乗）。`task.max-worker-threads` は Split を処理するスレッド数（既定は CPU 数の 2 倍）。`task.min-drivers` は Worker で動かす末端 Split 数の目標。

## 6. Exchange

- **Exchange**：クエリの Stage 間でノードをまたいでデータを渡す仕組み。
- Task は出力をバッファに書き、ほかの Task の出力は exchange client を通して読む。
- `query.max-hash-partition-count`（既定 100）は、結合・集約・分割ウィンドウ関数など分散処理のパーティション数の上限。
- フォールトトレラント実行（`retry-policy=TASK`）では、exchange manager の設定が要る。

## 7. スケジューリング

- `query.execution-policy` は Stage の起動順を決める。`phased`（既定）は Stage 間の依存で詰まらないよう順に起動し、`all-at-once` は全 Stage を同時に起動する。
- 結合の方式（`join_distribution_type`）は、broadcast（ビルド側全体を各ノードへ）と partitioned（結合キーで両側を再分配）から、既定では結合ごとに自動で選ぶ。これが Exchange の形を変える。

## 8. 実装例：EKS 上の Trino・Glue Catalog・S3

「Trino の基本アーキテクチャ」と同じ構成の例。EKS の EC2 マネージドノードグループに Trino Helm チャートで Coordinator Pod と Worker Pod を配置し、Iceberg Connector が Glue Data Catalog でメタデータ位置を解決して、S3 の Iceberg テーブルを読む。クライアントは別途設定した経路で Coordinator に SQL を送る。

| 機能 | 担い手 |
| --- | --- |
| クライアント（Statement） | 外部の Trino CLI |
| 分散計画・スケジューラ | Trino Coordinator Pod |
| Connector | Coordinator Pod と Worker Pod の Iceberg Connector |
| 末端・中間・ルート Stage の Task、Driver、Exchange | Trino Worker Pods |
| データソース | Amazon S3 上の Iceberg テーブル |

Split の一覧は Coordinator の Iceberg Connector が S3 上のメタデータから作り、Worker Pod の Task に割り当てる。Worker 間の Exchange は Pod 間の通信で行われる。Pod 間の通信経路の詳細は資料で確認していない。

AWS が EKS 制御プレーンと EC2・Glue・S3 の基盤を運用する。利用者は Kubernetes API、ノードグループ、Trino の配置・設定・更新、カタログ、S3 データ、IAM 権限を管理する。図は公式資料を組み合わせた代表例で、実動作は未検証。バージョン互換性、ネットワーク経路、クライアントの公開方式は未確認。

- [Trino on Kubernetes with Helm](https://trino.io/docs/current/installation/kubernetes.html)
- [Trino Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)
- [Trino S3 file system](https://trino.io/docs/current/object-storage/file-system-s3.html)
- [Amazon EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [IAM roles for service accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)

## 公式資料

- [Trino · Concepts](https://trino.io/docs/current/overview/concepts.html)
- [Trino · EXPLAIN](https://trino.io/docs/current/sql/explain.html)
- [Trino · Task properties](https://trino.io/docs/current/admin/properties-task.html)
- [Trino · Query management properties](https://trino.io/docs/current/admin/properties-query-management.html)
- [Trino · Cost-based optimizations](https://trino.io/docs/current/optimizer/cost-based-optimizations.html)
- [Trino · Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)
