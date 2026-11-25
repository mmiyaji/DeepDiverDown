# Apache Kafka の基本アーキテクチャ

Apache Kafka 4.4 の公式ドキュメントを基準に、イベントが Producer から Broker のログに書かれ、Consumer Group に読まれるまでの主要な部品を示す。ログの中身、複製、グループの担当割り当て、Streams、Connect は「仕組みの深掘り」の各図で扱う。

## 1. 対象と読み方

- Kafka はイベントを Topic に追記して保持する分散ログで、処理エンジンではない。集計や変換は Kafka Streams などのクライアント側で行う。
- 図の Topic `orders` は 3 パーティション・複製係数 3 の例。P0・P1・P2 のリーダーを Broker 1・2・3 に分けて置いている。台数と配置は説明用の例。
- 学ぶ順序は、ログとセグメント、複製と ISR、Consumer Group、Kafka Streams、Kafka Connect。

## 2. Topic・パーティション・Broker

- Topic は複数のパーティションに分かれる。パーティションは追記専用の順序付きログで、順序が保証されるのはパーティション内だけである。
- 各パーティションには複製（レプリカ）があり、そのうち 1 つがリーダーとして読み書きを受ける。残りのフォロワーはリーダーのログを取り込む。
- Broker はパーティションのレプリカを保持して、クライアントの要求を受けるサーバー。リーダーは Broker 間に分散させる。

## 3. Producer の書き込み

- Producer はメタデータから対象パーティションのリーダーを調べ、その Broker に直接送る。パーティションはキーのハッシュなどで選ぶ。
- `acks` で成功とみなす条件を選ぶ。`acks=all` では ISR 全員が受けるまで応答を待つ。詳細は「Kafka：レプリケーションと ISR・障害復旧」。

## 4. Consumer Group の読み出しとオフセット

- Consumer は Broker からデータを取りに行く（pull）。同じグループでは、1 つのパーティションを同時に 1 つの Consumer が読む。別のグループは、それぞれの位置で同じログを読める。
- 次に読む位置は offset で表し、Consumer が commit すると、Group Coordinator の Broker が内部 Topic `__consumer_offsets` に保存する。担当の割り当ては「Kafka：Consumer Group とリバランス」で扱う。

## 5. KRaft Controller とメタデータ

- KRaft モードでは、Controller がクラスターのメタデータ（Topic、パーティション、リーダー、ISR）をメタデータログとして Raft で複製して持つ。`process.roles` で `broker`、`controller`、または両方を指定できる。
- 重要な環境では Controller を専用ノードにする（combined モードは推奨されない）。Controller は 3 台か 5 台で、過半数が生きている間は動き続ける。
- Broker と Controller は `controller.quorum.bootstrap.servers` で Controller に接続する。

## 6. ログの保存

- パーティションのログは Broker のディスク（`log.dirs`）にセグメントファイルの並びとして置く。セグメントの構造、offset、保持と削除は「Kafka：パーティションとログセグメント・offset」で扱う。
- データは消費されても削除されず、保持設定（時間・サイズ）に従って古いセグメントから消える。

## 7. リーダー障害からの切り替え

- Broker が止まると、Controller が ISR に残るフォロワーから新しいリーダーを選ぶ。Producer と Consumer はメタデータを取り直して新しいリーダーへ接続する。
- 書き込みを続けられるかは、残る ISR が `min.insync.replicas` を満たすかに依存する。

## 8. 実装例：分離 KRaft クォーラムの Kafka（自前）

Broker 群と KRaft Controller 群を別ホストで動かす構成。実行ホストとネットワークは利用者が管理するデータセンター（オンプレミス）として描く。具体的な拠点や台数を特定した導入構成ではない。

| 機能 | 担い手 |
| --- | --- |
| Producer | Java の KafkaProducer |
| Controller | 専用ホスト上の KRaft Controller プロセス |
| Broker 1〜3 | Linux ホスト上の Kafka Broker プロセス |
| ログ保存 | 各 Broker ホストのローカルディスク（`log.dirs`） |
| Consumer | 同じ `group.id` の KafkaConsumer |

Topic `orders` の設定（3 パーティション、複製係数 3）は Controller が管理するメタデータとして保持される。ホスト、ディスク、ネットワーク、更新は利用者が運用する。図は公式機能を組み合わせた例で、実環境での動作は未検証。

- [KRaft](https://kafka.apache.org/44/operations/kraft/)
- [Apache Kafka Design](https://kafka.apache.org/44/design/design/)
- [Producer Configs](https://kafka.apache.org/44/configuration/producer-configs/)

## 9. 実装例：AWS（Amazon MSK と ECS on Fargate）

同じ AWS アカウントの VPC で、3 つの AZ に Standard ブローカーを置いた MSK Provisioned に、ECS の Fargate タスクから接続する。KRaft モードを使う。

| 機能 | 担い手 |
| --- | --- |
| Producer | ECS の送信サービスが起動する Fargate タスク |
| Broker 1〜3、ログ保存 | Amazon MSK Provisioned の Standard ブローカー |
| Controller | MSK が管理する KRaft Controller |
| Consumer | ECS の購読サービスが起動する 2 つの Fargate タスク |
| アプリの配置 | Amazon ECS、AWS Fargate、Amazon ECR |

クライアントは ECS タスクロールの認証情報で IAM 認証のブローカーへ接続する。ECR からのイメージ取得にはタスク実行ロールを使い、ECR への経路（NAT または VPC エンドポイント）が要る。AWS が MSK と Fargate の基盤を運用し、利用者はアプリ、トピック、権限、サービス設定を管理する。MSK の枠は論理的な所属を示し、Controller のネットワーク上の配置は表さない。ブローカー番号とリーダーの割り当ては例示。公式資料を組み合わせた代表例で、動作検証済みの導入事例ではない。

- [MSK Provisioned クラスターの作成](https://docs.aws.amazon.com/msk/latest/developerguide/create-cluster-console.html)
- [Amazon MSK と KRaft](https://docs.aws.amazon.com/msk/latest/developerguide/metadata-management.html)
- [MSK の IAM アクセス制御](https://docs.aws.amazon.com/msk/latest/developerguide/iam-access-control.html)
- [Amazon ECS のサービス定義](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service_definition_parameters.html)
- [Amazon ECS の IAM ロール](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/security-iam-roles.html)

## 未確認

- MSK のレプリカの AZ 間配置の既定、ストレージの種類。
- MSK 管理の Controller の台数と配置。図の Controller の台数は KRaft の資料の推奨（3 または 5）に基づく例。

## 公式資料

- [Apache Kafka Design](https://kafka.apache.org/44/design/design/)
- [Apache Kafka Protocol](https://kafka.apache.org/44/design/protocol/)
- [KRaft](https://kafka.apache.org/44/operations/kraft/)
- [Producer Configs](https://kafka.apache.org/44/configuration/producer-configs/)
- [Consumer Configs](https://kafka.apache.org/44/configuration/consumer-configs/)
