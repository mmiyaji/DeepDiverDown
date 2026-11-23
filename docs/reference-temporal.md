# Temporal のワーカー障害とリプレイ

## 1. モデルの範囲

架空の注文 API は注文ごとの Workflow を開始する。Workflow は決済の Activity を予約し、結果を受けて注文処理を完了する。Workflow Worker と Activity Worker は図上で分ける。

出典 [Temporal Event History](https://docs.temporal.io/encyclopedia/event-history)、[Understanding Temporal](https://docs.temporal.io/evaluate/understanding-temporal)

## 2. タスクと Event History

Workflow Worker が Workflow Task を処理し、Activity の予約などのコマンドを Temporal Service に返す。Temporal Service がイベントを永続化し、Worker は対応する Task Queue をポーリングする。構成図では Workflow Task と Activity Task の取得先を一つにまとめ、見取り図では決済に関わる代表的な履歴を示す。

出典 [Temporal Event History](https://docs.temporal.io/encyclopedia/event-history)、[Understanding Temporal](https://docs.temporal.io/evaluate/understanding-temporal)

## 3. Worker の停止と決定的リプレイ

Temporal Service に決済 Activity の完了が記録された後で Workflow Worker A が停止する。Worker B は新たにタスクを取り、Event History を使って Workflow コードを再実行し状態を復元する。Workflow コードは同じ履歴に沿うコマンドを出せる決定的な構成にする。完了済み Activity の結果は履歴から得られ、リプレイによる外部呼び出しは発生しない。

出典 [Temporal Event History](https://docs.temporal.io/encyclopedia/event-history)、[Temporal Workflow Definition](https://docs.temporal.io/workflow-definition)、[Understanding Temporal](https://docs.temporal.io/evaluate/understanding-temporal)

## 4. Activity の完了報告と再試行

外部決済が成功した直後に Activity Worker が停止すると、Temporal に Activity の完了が記録されていない場合がある。タイムアウトと再試行ポリシーの条件を満たせば、Activity は再実行される。これは履歴を読む Workflow のリプレイとは別の処理である。

出典 [Temporal Activity Definition](https://docs.temporal.io/activity-definition)、[Temporal Retry Policy](https://docs.temporal.io/encyclopedia/retry-policies)

## 5. 外部決済の冪等性

決済 Activity には決済操作を一意に識別するキーを渡し、再試行でも同じキーを送る。例の決済 API は同じキーで新たな決済を作らず、初回の成功結果を返す契約を持つ。外部状態と Activity の完了記録は別々に更新されるため、重複した副作用を防ぐには外部操作の冪等性が必要になる。

出典 [Temporal Activity Definition](https://docs.temporal.io/activity-definition)、[Temporal Retry Policy](https://docs.temporal.io/encyclopedia/retry-policies)

## 6. 実装例：自己管理 Temporal と PostgreSQL
Kubernetes の Temporal Service と PostgreSQL を使い、注文処理の Worker と決済 Worker を別のワークロードで実行する例。

| 機能配置 | この例での担い手 |
|---|---|
| 注文 API | Temporal SDK を使う注文 API |
| 実行履歴・タスクの制御 | Temporal Server の Frontend・History・Matching |
| 永続的な実行履歴 | PostgreSQL の Persistence スキーマ |
| ワークフロー・アクティビティの作業待ち行列 | Temporal Server の Frontend・History・Matching |
| 注文処理の実行担当 A | 注文 Worker Pod A |
| 注文処理の実行担当 B | 注文 Worker Pod B |
| 決済処理の実行担当 | 決済 Worker Deployment |
| 外部決済 API | 外部決済 API（架空） |

- **PostgreSQL の Visibility スキーマ**。Web UI / CLI で実行一覧を絞り込むための参照データを保持する。

この例では利用者が Kubernetes ノード上の Temporal Server・注文 API・Worker と、クラスタ外の PostgreSQL ホストを運用する。利用者がデータ、バックアップ、アクセスとワークロードの設定を管理する。複数の公式資料を組み合わせた未検証の代表例で、ノード、DB 製品版、ストレージと接続条件は導入時に確認する。

注文 Worker は同じ Deployment の Pod の例で、B への割り当ては固定されない。Persistence と Visibility のスキーマを用意し、外部決済の冪等性は決済先との契約で確保する。

公式資料
- [Self-hosted Temporal Service](https://docs.temporal.io/self-hosted-guide)
- [Temporal Visibility setup](https://docs.temporal.io/self-hosted-guide/visibility)
- [Temporal Task Queues](https://docs.temporal.io/task-queue)


## 7. 実装例：Amazon EKS 上の Temporal と RDS PostgreSQL

Temporal Server と注文用 Worker を Amazon EKS の EC2 ノードで運用する。RDS PostgreSQL に実行履歴と Visibility を分けて永続化する。

| 機能 | 担い手 |
| --- | --- |
| タスクの制御 | EKS 上の Temporal Frontend、History、Matching。注文用と決済用の Worker Deployment が Frontend をポーリングする。 |
| 実行履歴 | RDS for PostgreSQL の Persistence データベース。 |
| 実行検索 | 同じ RDS インスタンスの別の Visibility データベース。 |
| 決済 | クラスター外の決済 API。Activity から同じ注文操作キーを送る。 |

EKS の制御プレーンは AWS 管理 VPC 内にあり、利用者は API と公開設定を操作できるが、そのサーバーへ直接アクセスしない。AWS は RDS の基盤を運用し、利用者はデータ、接続、認証とバックアップ設定を管理する。RDS は EKS クラスタ外の独立サービスである。複数の公式資料を組み合わせた未検証の代表例であり、バージョン互換性、権限、ネットワーク、バックアップと復元を導入時に検証する。

公式 Helm チャートで外部 PostgreSQL を指定し、Temporal Server に対応する Persistence と Visibility のスキーマを適用する。Kubernetes と Temporal Server の運用は利用者が担当し、Temporal Cloud のサービス境界はこの構成に含まれない。Worker から Frontend の gRPC 接続を TLS とクライアント認証で保護し、RDS では専用ユーザー、TLS と接続元制限を使う。Worker B は再配置の例であり、割り当て先は固定しない。決済側の操作キー契約がない場合、Temporal の Activity 再試行だけで二重請求を防げるという前提は置かない。

公式資料

- [EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)
- [RDS security](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.html)
- [Temporal の自己管理構成](https://docs.temporal.io/self-hosted-guide)
- [Temporal の公式 Helm チャート](https://github.com/temporalio/helm-charts/blob/main/README.md)
- [Temporal Visibility の対応データベース](https://docs.temporal.io/self-hosted-guide/visibility)
- [Temporal の本番構成チェックリスト](https://docs.temporal.io/self-hosted-guide/production-checklist)
- [EKS マネージドノードグループ](https://docs.aws.amazon.com/eks/latest/userguide/create-managed-node-group.html)
