# Apache Kafka の基本アーキテクチャ

## 1. 分散ログの構成

Kafka はイベントを Topic ごとに保持する。Topic は複数の追記ログ（パーティション）から成り、各パーティションのログを Broker が保持する。この図では Topic `orders` に P0・P1・P2 があり、それぞれのリーダーが Broker 1・2・3 に分散している。複製係数は3の例。Controller はメタデータを管理し、レコードの読み書きは Broker が受け持つ。

出典 [Apache Kafka Design](https://kafka.apache.org/44/design/design/)・[KRaft](https://kafka.apache.org/44/operations/kraft/)

## 2. Producer の書き込み

Producer はパーティションを決め、メタデータからそのリーダーを調べて送信する。図では P0 のリーダー Broker 1 に追記する。キーはパーティション選択に使える。レコードに付くオフセットと読み出し順序はパーティション内で意味を持つ。

出典 [Apache Kafka Protocol](https://kafka.apache.org/44/design/protocol/)・[Producer Configs](https://kafka.apache.org/44/configuration/producer-configs/)

## 3. 複製と書き込み応答

フォロワーはリーダーからログを取得し、自分のコピーに追記する。ISR はリーダーと、リーダーに追随しているレプリカの集合。図の複製の矢印はデータが移る方向を示す。図の例では `acks=all`、`min.insync.replicas=2` とする。成功応答には必要な最小 ISR 数を満たし、その時点の ISR が追記を確認している必要がある。

出典 [Apache Kafka Design](https://kafka.apache.org/44/design/design/)・[Producer Configs](https://kafka.apache.org/44/configuration/producer-configs/)

## 4. Consumer Group の読み出し

Consumer は Broker から自分でデータを取りに行く。通常の Consumer Group では、同一グループ内で1つのパーティションを1つの Consumer が担当する。図では Consumer 1 が P0・P1、Consumer 2 が P2 を担当する。参加者が増減すると割り当てが見直される。別グループは、それぞれの進捗で同じログを読める。

出典 [Apache Kafka Design](https://kafka.apache.org/44/design/design/)

## 5. 進捗の保存と再読込

Consumer は次に読む位置をオフセットとしてコミットできる。リクエストは Group Coordinator の Broker が受け、内部 Topic `__consumer_offsets` に保存する。図では Broker 2 が Coordinator の例。読んだレコードも保持されている間は、位置を戻して読み直せる。

出典 [Apache Kafka Design](https://kafka.apache.org/44/design/design/)・[Apache Kafka Protocol](https://kafka.apache.org/44/design/protocol/)

## 6. リーダー障害からの切り替え

P0 のリーダー Broker 1 が停止し、Broker 2 と Broker 3 が ISR に残っている例。KRaft Controller が Broker 2 を新リーダーに選出する。Producer はメタデータを取得し直し、必要に応じて新リーダーへ再送する。Consumer も新リーダーに接続し直す。書き込みを継続できるかは、新リーダーの選出と残存 ISR が設定を満たすかに依存する。

出典 [Apache Kafka Design](https://kafka.apache.org/44/design/design/)・[KRaft](https://kafka.apache.org/44/operations/kraft/)・[Producer Configs](https://kafka.apache.org/44/configuration/producer-configs/)

## 7. パーティションのログの中身

パーティションは Broker のディスク上で `<topic>-<partition>/` ディレクトリになり、その中は**セグメント**の並びである。各セグメントは先頭オフセット（20 桁）を名前に持つ `.log`（レコードバッチ本体）、`.index`（オフセット → ファイル内位置の疎な索引）、`.timeindex`（時刻 → オフセット）の組で、末尾の 1 つだけが追記中の**アクティブセグメント**になる。`segment.bytes`（既定 1 GiB）や `segment.ms` に達すると閉じて新しいセグメントが始まり、保持期限（`retention.ms`、既定 7 日）や容量上限は**閉じたセグメント単位**で削除される。

ログ上の位置として、末尾の **LEO**（Log End Offset）、全 ISR に複製済みの境界である **High Watermark**、Consumer Group ごとの**コミット済みオフセット**（`__consumer_offsets` に保存）がある。Consumer は High Watermark までしか読めず、コミット済みオフセットと High Watermark の差がコンシューマーラグになる。読み取りは `.index` で開始位置を引き、`.log` を順に読む（多くの場合 OS のページキャッシュから返る）。出典 [Apache Kafka Design](https://kafka.apache.org/documentation/#design)、[Topic Configs](https://kafka.apache.org/documentation/#topicconfigs)

## 8. Consumer Group のリバランスと ISR の追い付き

Consumer Group にメンバーが加わる・抜けると、Group Coordinator がパーティションの担当を割り当て直す（リバランス）。担当が移ったパーティションは、新しい担当がコミット済みオフセットから読み始める。協調的リバランス（CooperativeStickyAssignor）では、動かす必要のある担当だけを移し、他の担当は読み続けられる。複製では、フォロワーがリーダーのログを取り込んで追い付き、遅れすぎたフォロワーは ISR から外れる。リーダーが停止すると、ISR に残るフォロワーが新しいリーダーに選ばれ、外れていたフォロワーは新リーダーから追い付いて ISR に戻る。出典 [Apache Kafka Design](https://kafka.apache.org/documentation/#design)、[Consumer Configs](https://kafka.apache.org/documentation/#consumerconfigs)

## 9. 実装例：分離 KRaft クォーラムの Kafka

Kafka のデータブローカー群と KRaft コントローラー群を別プロセスにする概念例。実行ホストやネットワークを特定した導入構成ではない。具体的な AWS の実行環境は §10 を参照。図の P0・P1・P2 は注文トピックの分割で、トピック設定とコンシューマーグループは別に管理する。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| イベント送信元 | KafkaProducer | 注文キーに基づく対象パーティションへレコードを送る。 |
| クラスターのメタデータ管理 | KRaft コントローラー群 | 専用プロセスでメタデータログのクォーラムを構成する。 |
| ログノード 1 · P0 リーダー | Kafka Broker 1 | P0 の最初のリーダーを担当する。 |
| ログノード 2 · P1 リーダー | Kafka Broker 2 | P1 のリーダーと P0 のフォロワーとして開始する。 |
| ログノード 3 · P2 リーダー | Kafka Broker 3 | P2 のリーダーと P0 のフォロワーとして開始する。 |
| 購読プロセス 1 | KafkaConsumer 1 | 同じ group.id でパーティションを分担する。 |
| 購読プロセス 2 | KafkaConsumer 2 | グループ内で割り当てられた分割を読む。 |

実装で加わる部品を以下に示す。

- orders のトピック設定。この例では 3 パーティション・複製係数 3 とし、書き込み時の確認は acks と min.insync.replicas の組み合わせで決まる。

公式資料

- [Apache Kafka Design](https://kafka.apache.org/44/design/design/)
- [Apache Kafka Protocol](https://kafka.apache.org/44/design/protocol/)
- [KRaft](https://kafka.apache.org/44/operations/kraft/)
- [Producer Configs](https://kafka.apache.org/44/configuration/producer-configs/)

## 10. 実装例：AWS（Amazon MSK と ECS on Fargate）

同じ AWS アカウントの VPC で、3 つの AZ に Standard ブローカーを配置した MSK Provisioned に、ECS の Fargate タスクから接続する。例では注文トピックを 3 パーティション・複製係数 3 とし、KRaft モードを使う。

| 機能 | 担い手 | 設定・動作 |
| --- | --- | --- |
| イベント送信 | ECS の送信サービスが起動する Fargate タスク | Java Producer がパーティションのリーダーへ追記する |
| 分散ログとメタデータ管理 | Amazon MSK Provisioned | Standard ブローカー間でログを複製し、KRaft がメタデータとリーダーを管理する。MSK が Kafka 基盤を運用する |
| 下流の購読 | ECS の購読サービスが起動する 2 つの Fargate タスク | 2 タスクの `group.id` をそろえ、Kafka のグループ内でパーティションを分担する |
| アプリの配置 | Amazon ECS、AWS Fargate、Amazon ECR | ECS サービスが指定数のタスクを維持し、Fargate がタスク起動時に ECR から対応するイメージを取得する |

Kafka クライアントは ECS タスクロールの認証情報を使い、IAM 認証のブローカーへ接続する。ECR からのイメージ取得にはタスク実行ロールを使う。ECR への通信経路（NAT または適切な VPC エンドポイント）と MSK の認証・ネットワーク設定が必要。MSK や Fargate の基盤は AWS が運用し、利用者はアプリ、トピック、権限、サービス設定を管理する。MSK の枠は論理的所属を示し、コントローラーの内部ネットワーク配置を表すものではない。図のブローカー番号とリーダーの割り当ては例示で、切り替わるブローカーは稼働状態とレプリカの状態に依存する。これは公式資料を組み合わせた代表例であり、実在の導入事例や動作検証済みの構成ではない。

- [MSK Provisioned クラスターの作成](https://docs.aws.amazon.com/msk/latest/developerguide/create-cluster-console.html)
- [Amazon MSK と KRaft](https://docs.aws.amazon.com/msk/latest/developerguide/metadata-management.html)
- [Amazon MSK の IAM アクセス制御](https://docs.aws.amazon.com/msk/latest/developerguide/iam-access-control.html)
- [Amazon ECS のサービス定義](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service_definition_parameters.html)
- [Amazon ECS の IAM ロール](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/security-iam-roles.html)

- [Fargate タスクのネットワーク](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html)
- [ECS タスク実行 IAM ロール](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html)

自前例の Linux ホスト、プロセス、設定、データとネットワークは利用者が管理する。ホスト配置や構成は公式機能を組み合わせた例であり、具体的な環境での接続、権限、障害復旧は未検証。
