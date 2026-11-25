# Kafka：レプリケーションと ISR・障害復旧

Apache Kafka 4.4 の公式ドキュメントを基準に、パーティションの複製が ISR で管理され、リーダー障害後に再び書き込めるようになるまでを追う。前提は「Apache Kafka の基本アーキテクチャ」。

## 1. 対象と前提

- 対象は複製係数 3 のパーティション P0。Broker 1 がリーダー、Broker 2・3 がフォロワーの例。
- ログの中身は前の図、グループの担当は次の図で扱う。

## 2. リーダーとフォロワー

- パーティションごとに 1 つのリーダーが読み書きを受け、フォロワーはリーダーのログを取り込んで自分のコピーに追記する。
- リーダーは Broker に分散させる。Producer は、メタデータから調べたリーダーへ送る。

## 3. ISR とコミット

- ISR（In-Sync Replicas）は、リーダーに追随しているレプリカの集合。Controller とのセッションが切れる、または遅れが `replica.lag.time.max.ms` を超えると外れる。
- レコードは ISR の全員が受けるとコミット済みになる。ISR が変わると、クラスターのメタデータに保存される。
- 図では Broker 3 が遅れて ISR から外れた状態から始める。

## 4. acks と min.insync.replicas

- Producer の `acks` は 0、1、all。`acks=1` ではリーダーが受けた時点で成功とし、`acks=all` では ISR 全員が受けるまで待つ。
- ISR が `min.insync.replicas` を下回ると、`acks=all` の書き込みは拒否される。値を大きくすると一貫性が優先され、可用性は下がる。

## 5. リーダー選出

- Broker が止まると、Controller が ISR のレプリカから新しいリーダーを選ぶ。
- ISR 外のレプリカをリーダーにできる `unclean.leader.election.enable` は、既定では一貫性を待つ側（無効）。有効にすると、止まらない代わりにデータを失う可能性がある。

## 6. 障害後の復旧

- Producer と Consumer は、メタデータを取り直して新しいリーダーへ接続し、必要なら再送する。
- 外れていたフォロワーは、新しいリーダーから取り込んで追い付くと ISR に戻る。
- 止まった Broker が復帰すると、フォロワーとして取り込み、追い付いたら ISR に戻る。

## 7. 実装例：AWS（Amazon MSK と ECS on Fargate）

3 つの AZ に Standard ブローカーを置いた MSK Provisioned のクラスターに、Fargate 上の Producer が書き込む例。複製、ISR、リーダー選出は MSK 内の Kafka が行う。

| 機能 | 担い手 |
| --- | --- |
| Producer | ECS の Fargate タスク |
| リーダー・フォロワー（Broker 1〜3） | MSK の Standard ブローカー |
| Controller | MSK が管理する KRaft Controller |

AWS が MSK と Fargate の基盤を運用し、利用者は Topic、複製係数、`min.insync.replicas`、権限、アプリを設定する。MSK の枠は論理的な所属で、ブローカーの AZ 配置や Controller のネットワーク配置は図に表さない。公式資料を組み合わせた例で、実環境では未検証。

- [MSK Provisioned クラスターの作成](https://docs.aws.amazon.com/msk/latest/developerguide/create-cluster-console.html)
- [Amazon MSK と KRaft](https://docs.aws.amazon.com/msk/latest/developerguide/metadata-management.html)
- [MSK の IAM アクセス制御](https://docs.aws.amazon.com/msk/latest/developerguide/iam-access-control.html)
- [Amazon ECS のサービス定義](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service_definition_parameters.html)

## 未確認

- `replica.lag.time.max.ms` と `min.insync.replicas` の既定値は、確認した Design のページに記載がなく、本文に書いていない。
- MSK のレプリカの AZ 間配置と、既定の複製係数・`min.insync.replicas` は未確認。
- 障害時の切り替えにかかる時間は未確認。

## 公式資料

- [Apache Kafka Design](https://kafka.apache.org/44/design/design/)
- [Producer Configs](https://kafka.apache.org/44/configuration/producer-configs/)
- [Broker Configs](https://kafka.apache.org/44/configuration/broker-configs/)
- [KRaft](https://kafka.apache.org/44/operations/kraft/)
