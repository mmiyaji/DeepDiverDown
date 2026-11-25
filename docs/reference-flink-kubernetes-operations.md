# Flink：Kubernetes 上の運用

Flink の stable 版ドキュメントと Flink Kubernetes Operator のドキュメントを基準に、Kubernetes 上での起動・HA・再開を追う。前提は「Flink：状態バックエンドとチェックポイント」。

## 1. 対象と前提

- 対象は Kubernetes 上の Flink の起動、Operator による管理、HA、チェックポイントからの再開。
- Flink SQL・Table API は扱わない。

## 2. native Kubernetes の仕組み

- Flink が Kubernetes API を直接使い、Deployment・Pod・ConfigMap・Service を作成・削除し、Pod と ConfigMap を監視する。TaskManager を必要に応じて確保・解放できる。
- JobManager は `kubernetes.cluster-id` の名前の Deployment で、restart policy は always。TaskManager は ResourceManager が要求する Pod で、restart policy は never。遊休は `resourcemanager.taskmanager-timeout` で解放される。
- 作られた資源は Deployment を owner reference に持つので、Deployment を消すと一緒に消える。
- 名前空間の service account に、Pod の作成・削除と leader の ConfigMap を扱う RBAC 権限が要る。

## 3. Application モードとイメージ

- 本番に推奨される Application モードは、`main()` をクラスタ上で動かす。`--target kubernetes-application` で提出し、終了時に Flink が資源を片付ける。
- ジョブの JAR は、公式イメージを元に `usrlib` に入れるか、成果物として上げるか、リモートの場所から JobManager が取得する。

## 4. Flink Kubernetes Operator

- Operator パターンで、希望のアプリケーションをカスタムリソースで宣言し、実際のクラスタを宣言に合わせ続ける。Application クラスタ、Session クラスタ、Session ジョブを Kubernetes の資源として扱う。
- ジョブの起動・停止・再開・アップグレード・削除、自動の再起動と復旧、安定しないアップグレードのロールバックを担う。セーブポイントとチェックポイントも宣言的に扱える。
- Helm で導入する。Operator 自身も leader 選出で高可用にできる。
- Flink 本体の ResourceManager はスロットと Pod の確保を担い、Operator はクラスタとジョブの宣言を保つ。役割が別である。

## 5. Kubernetes HA

- `high-availability.type` を `kubernetes` にし、`high-availability.storageDir` に復旧用メタデータの保存先（s3:// や hdfs://）、`kubernetes.cluster-id` にクラスタの識別子を指定する。
- 復旧に要る状態の本体は保存先にあり、ConfigMap はそこへのポインタを持つ。service account に ConfigMap の作成・編集・削除の権限が要る。
- Deployment を削除しても HA の ConfigMap は owner reference が無いので残り、再起動すると動いていたジョブは最新の成功したチェックポイントから復旧する。
- `kubernetes.jobmanager.replicas` を 1 より大きくすると standby の JobManager が起動する（HA が前提）。

## 6. アップグレードと再開

- 再開の元は、チェックポイント保存先（`execution.checkpointing.dir`）のチェックポイントか、セーブポイント。`externalized-checkpoint-retention` で、キャンセル時に保持するか削除するかを決める。
- Operator の概要は、状態を持つ・持たないアップグレードがあると述べるだけで、具体的なモードの名前と挙動は確認できていない。

## 7. シナリオ

リソースを適用する → Operator が Application クラスタを作る → JobManager が TaskManager Pod を要求し、Task が割り当てられ、HA の情報が残る → JobManager を失っても、HA の情報と最新のチェックポイントから再開する。

## 8. 実装例：EKS 上の Flink Kubernetes Operator と S3

EKS のノード上で Operator が Application クラスタを管理し、HA 保存先とチェックポイントを S3 に置く。

| 機能 | 担い手 |
| --- | --- |
| kubectl・Helm | 利用者の端末 |
| Kubernetes API・HA の ConfigMap | EKS の Kubernetes API |
| Operator | Operator Pod |
| JobManager・TaskManager | Flink の Pod（EC2 ノード上） |
| HA 保存先・チェックポイント | S3 |

加わる部品は EC2 ノードと、Pod に S3 のアクセスを付与する IAM ロール。AWS が EKS 制御プレーン・EC2・S3 の基盤を運用し、利用者が Operator・Flink の設定・イメージ・権限を管理する。Operator の RBAC と Helm の値、カスタムリソースの名前、イメージの置き場所、台数は未確認。実動作は未検証。

## 公式資料

- [Flink · Native Kubernetes](https://nightlies.apache.org/flink/flink-docs-stable/docs/deployment/resource-providers/native_kubernetes/)
- [Flink · Kubernetes HA Services](https://nightlies.apache.org/flink/flink-docs-stable/docs/deployment/ha/kubernetes_ha/)
- [Flink · Checkpointing](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/fault-tolerance/checkpointing/)
- [Flink Kubernetes Operator · Overview](https://nightlies.apache.org/flink/flink-kubernetes-operator-docs-stable/docs/concepts/overview/)
- [Amazon EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [IAM roles for service accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
