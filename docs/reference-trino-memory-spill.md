# Trino：メモリ管理とスピル

Trino 484 の公式ドキュメントを基準に、クエリのメモリがどう数えられ、上限を超えるとどうなり、スピルで何が変わるかを整理する。前提は「Trino：Stage・Task・Split と Exchange」（Worker の Task と Operator が処理する）。

## 1. 対象と前提

- 対象は、Worker 上の Operator が使うメモリの追跡、上限、スピル、メモリ不足時の挙動。
- 結合・集約・ソート・ウィンドウ関数の Operator が中間結果をメモリに持つため、データが大きいとメモリ上限に当たる。
- スピルは公式資料で legacy 機能とされ、代わりにフォールトトレラント実行（`retry-policy=TASK` と exchange manager）が推奨される。

## 2. ユーザーメモリと上限

- `query.max-memory`（既定 20GB）：1 つのクエリがクラスタ全体で使えるユーザーメモリの上限。全 Worker の合計で数え、超えるとクエリは終了される。
- `query.max-memory-per-node`（既定は最大ヒープの 30%）：1 つのクエリが 1 つの Worker で使えるユーザーメモリの上限。
- `memory.heap-headroom-per-node`（既定は最大ヒープの 30%）：Trino が追跡しない割り当てのために、JVM ヒープに残す余白。
- 各ノードで `query.max-memory-per-node` と `memory.heap-headroom-per-node` の合計は、JVM の最大ヒープより小さくする。
- これらの上限は、タスク単位の再試行（`retry-policy=TASK`）を有効にしたクエリには適用されない。

## 3. 取り消し可能メモリとスピル

- スピルは、Operator の中間結果をディスクに書き出し、メモリ上限を超える処理を続けられるようにする仕組み。使わない場合、上限を超えたクエリは終了される。
- スピルできるメモリは「取り消し可能（revocable）」で、メモリマネージャーが取り消すと、中間データをディスクに書いてあとで処理する。
- `query.max-total-memory`（既定は `query.max-memory` の 2 倍）は、取り消し可能メモリを含めた、クラスタ全体での上限。`query.max-memory` より大きくする。

## 4. スピルの対象と設定

- **結合**：ビルド側のパーティションをディスクに書き、パーティションを 1 つずつ読み戻す。データに偏りがなければ、ピークのメモリは最大のパーティション（ビルド側の約 `1 / task.concurrency`）まで減る。
- **集約**：中間の集約結果を書き出し、あとで読み戻して統合する。
- **ORDER BY**：途中のソート結果を書き出し、あとで統合する。
- **ウィンドウ関数**：途中の結果を書き出し、メモリに余裕ができてから統合する。1 つのウィンドウが非常に大きい場合など、効かないことがある。
- 主な設定：`spill-enabled`（既定 `false`）、`spiller-spill-path`（スピル先。有効時は必須で、複数ディスクはカンマ区切り）、`max-spill-per-node`（既定 100GB）、`query-max-spill-per-node`（既定 100GB）、`aggregation-operator-unspill-memory-limit`（既定 4MB）、`spill-compression-codec`、`spill-encryption-enabled`。

## 5. メモリが足りないとき

- `query.low-memory-killer.policy`（既定 `total-reservation-on-blocked-nodes`）は、メモリが足りないときに終了するクエリを決める。`none`（終了しない）、`total-reservation`（合計で最もメモリを使うクエリ）、`total-reservation-on-blocked-nodes`（メモリが尽きたノードで最も使うクエリ）。`retry-policy` が `NONE` か `QUERY` のときだけ適用される。
- 上限を超えたクエリは、クラスタ全体でも 1 ノードでも、終了される。

## 6. 注意点

- スピルは、メモリを多く使うクエリの成功を保証しない。ディスクから読み戻すときにメモリ不足になることがある。
- スピルしたクエリは、ディスクがボトルネックになりメモリ内の実行より大幅に遅くなることがある。
- スピル先にシステムドライブ（JVM やログのディスク）を使わない。スピル先は独立したディスクとして扱われ、RAID は不要。スピル先のディスクの飽和を監視する。
- スピルの暗号化と圧縮は CPU を使う。暗号化を有効にする場合は `memory-revoking-threshold` を下げることを検討する、と公式資料にある。

## 7. 実装例：EKS 上の Trino・Glue Catalog・S3

「Trino の基本アーキテクチャ」と同じ構成の例。EKS の EC2 マネージドノードグループに Trino Helm チャートで Coordinator Pod と Worker Pod を配置し、Iceberg Connector が Glue Data Catalog でメタデータ位置を解決して、S3 の Iceberg テーブルを読む。クライアントは別途設定した経路で Coordinator に SQL を送る。

| 機能 | 担い手 |
| --- | --- |
| Operator・ユーザーメモリ・取り消し可能メモリ | Trino Worker Pods の JVM ヒープ |
| メモリ上限 | Coordinator と Worker の設定ファイル（Helm の values で設定） |
| 低メモリ時のクエリ終了 | Trino Coordinator Pod |
| スピル先 | Worker が動く EC2 ノードのローカルディスク |

スピル先（`spiller-spill-path`）として EKS ノードのローカルディスクをどう Pod に渡すか（emptyDir やホストのディスクなど）は、確認した資料では指定されていない。システムドライブを避ける注意（§6）はこの構成でも同じ。ここでは Worker が動くノードのディスクを例とする。

AWS が EKS 制御プレーンと EC2・Glue・S3 の基盤を運用する。利用者は Kubernetes API、ノードグループ、Trino の配置・設定・更新、カタログ、S3 データ、IAM 権限を管理する。図は公式資料を組み合わせた代表例で、実動作は未検証。バージョン互換性、ネットワーク経路、クライアントの公開方式は未確認。

- [Trino on Kubernetes with Helm](https://trino.io/docs/current/installation/kubernetes.html)
- [Trino Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)
- [Trino S3 file system](https://trino.io/docs/current/object-storage/file-system-s3.html)
- [Amazon EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [IAM roles for service accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)

## 公式資料

- [Trino · Resource management properties](https://trino.io/docs/current/admin/properties-resource-management.html)
- [Trino · Spilling to disk](https://trino.io/docs/current/admin/spill.html)
- [Trino · Spilling properties](https://trino.io/docs/current/admin/properties-spilling.html)
- [Trino · Query management properties](https://trino.io/docs/current/admin/properties-query-management.html)
