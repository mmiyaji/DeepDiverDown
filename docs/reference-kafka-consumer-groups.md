# Kafka：Consumer Group とリバランス

Apache Kafka 4.4 の公式ドキュメントを基準に、Consumer Group がパーティションを分担し、メンバーの増減で担当を組み替える流れを追う。前提は「Apache Kafka の基本アーキテクチャ」。

## 1. 対象と前提

- 対象は 6 パーティションの Topic を読む Consumer Group。Consumer 1・2 で読み、Consumer 3 の参加と Consumer 1 の離脱を追う。
- ログの構造は 1 つ目の図、複製は 2 つ目の図で扱う。

## 2. グループと担当

- 同じ `group.id` の Consumer が 1 つのグループになる。グループ内では、1 つのパーティションを同時に 1 つの Consumer だけが読む。
- 別のグループは、それぞれの位置で同じ Topic を読める。

## 3. offset のコミット

- Consumer は次に読む offset を commit する。Group Coordinator の Broker が受けて、内部 Topic `__consumer_offsets` に保存する。
- `enable.auto.commit` の既定は true（定期的にバックグラウンドでコミット）。保存された位置がないときの開始位置は `auto.offset.reset`（既定 `latest`）で決まる。
- トランザクションを使う処理では、`enable.auto.commit=false` と `isolation.level=read_committed` にする。

## 4. リバランスの契機

- メンバーの参加・離脱、購読する Topic のパーティション数の変更などで、グループが担当を組み替える。
- `classic` プロトコル（既定の `group.protocol`）では、ハートビートが `session.timeout.ms`（既定 45 秒）を超えて途絶える、または `poll()` の間隔が `max.poll.interval.ms`（既定 5 分）を超えると、離脱とみなす。ハートビートの既定間隔は 3 秒。
- `group.protocol=consumer` を指定すると、タイムアウトとハートビート間隔はブローカー側の設定（`group.consumer.session.timeout.ms` など）になり、割り当てはサーバー側のアサイナー（`group.remote.assignor`）が行う。

## 5. 割り当て戦略

- `partition.assignment.strategy` の既定は RangeAssignor と CooperativeStickyAssignor の並び。選べるのは Range、RoundRobin、Sticky、CooperativeSticky で、独自実装もできる。
- 協調的な戦略（CooperativeSticky）は、動かす必要のあるパーティションだけを移し、ほかは読み続ける。図では Consumer 3 が加わると P2 と P5 だけが移る。

## 6. 静的メンバーシップ

- `group.instance.id` を設定すると静的メンバーになり、再起動のような短い停止でリバランスを起こさずに済む。セッションタイムアウトを長めにして使う。
- 担当が移ったパーティションは、新しい担当がコミット済み offset から読み始める。

## 7. 実装例：AWS（Amazon MSK と ECS on Fargate）

ECS の購読サービスが複数の Fargate タスクを維持する。タスクは同じ VPC の MSK Provisioned から共通の `group.id` で読み取る。VPC の枠はタスクのネットワークインターフェースとブローカーの接続範囲を示す。ECS のサービス制御は VPC の枠の外に描く。図ではクラスターのブローカー群を一つの部品にまとめている。

| 機能 | 担い手 |
| --- | --- |
| Consumer 1〜3 | 購読サービスの Fargate タスク（`group.id` は共通） |
| Group Coordinator、パーティションのログ | MSK の Standard ブローカー |
| コミット済み offset | MSK 上の内部 Topic `__consumer_offsets` |
| タスク数の維持 | Amazon ECS のサービス |

ECS がタスクを増減させると、グループのメンバーが変わりリバランスが起きる。AWS が MSK・ECS・Fargate の基盤を運用し、利用者はアプリ、`group.id`、タスク数、IAM 権限を設定する。利用者はブローカーへの接続をセキュリティグループで許可する。公式資料を組み合わせた例で、実環境では未検証。

- [Amazon ECS のサービス定義](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service_definition_parameters.html)
- [MSK の IAM アクセス制御](https://docs.aws.amazon.com/msk/latest/developerguide/iam-access-control.html)
- [MSK Provisioned クラスターの作成](https://docs.aws.amazon.com/msk/latest/developerguide/create-cluster-console.html)
- [Fargate タスクのネットワーク](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html)
- [MSK Provisioned への接続](https://docs.aws.amazon.com/msk/latest/developerguide/client-access.html)

## 未確認

- `consumer` プロトコルのリバランスの詳細（段階、ブロッキングの有無）は、確認した資料の範囲では扱っていない。
- MSK でのブローカー側のグループ設定の既定値は未確認。
- 図の「担当が移る」結果は協調的な戦略の説明用の例で、実際の割り当てはアサイナーと購読状態に依存する。

## 公式資料

- [Apache Kafka Design](https://kafka.apache.org/44/design/design/)
- [Consumer Configs](https://kafka.apache.org/44/configuration/consumer-configs/)
- [Apache Kafka Protocol](https://kafka.apache.org/44/design/protocol/)
