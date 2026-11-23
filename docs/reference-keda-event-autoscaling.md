# KEDA：イベント駆動の自動スケーリング

## 1. 位置付け

KEDA 2.21 はキュー長や Kafka の consumer lag などを元に Kubernetes ワークロードを伸縮する。イベント自体を配信・処理する製品ではない。ScaledObject は Deployment 等を、ScaledJob は実行ごとに作る Kubernetes Job を対象にする。イベントの配送、再試行、重複対策はイベントソースとアプリケーションの責任である。

## 2. 設定と認証

利用者は ScaledObject に scaleTargetRef、trigger、閾値、最小・最大レプリカを定義する。KEDA Operator がリソースを監視し HPA を生成・管理する。TriggerAuthentication などで scaler のイベントソースへの認証を設定し、処理 Pod の認証は別途設計する。Admission Webhook は KEDA リソースを検証する。

## 3. 0 から 1 への起動

Operator が scaler を使いイベントソースの活動を調べ、activation 閾値を超えれば対象を 0 から 1 にする。ScaledObject の pollingInterval の既定は 30 秒で、即時起動は保証されない。CPU / Memory trigger 単独ではゼロ時に参照する Pod の指標がなく、scale-to-zero は使えない。

## 4. 1 から N と縮退

HPA は Kubernetes API Server を介して KEDA Metrics Server の外部メトリクスを取得し、対象の希望レプリカ数を調整する。Metrics Server は Operator に問い合わせ、Operator の scaler が値を取得する。Deployment / ReplicaSet が Pod を増減する。HPA の同期間隔と KEDA のポーリングは別で、HPA の既定同期間隔は通常 15 秒。キャッシュ利用などにより取得経路や頻度が異なる。KEDA の cooldownPeriod は主にゼロへの縮退に適用される。

## 5. Kafka と SQS の注意点

Kafka scaler は consumer group の lag を利用する。通常は partition 数と maxReplicaCount で上限が制約され、`allowIdleConsumers` で変更可能。topic を省略し、履歴のない consumer group がゼロになると topic を発見できず再起動できない場合がある。SQS scaler はキューの可視メッセージ数に加えて既定では処理中数も対象にする。SQS のメトリクスは概算で、最終的にメッセージを取得・削除するのはアプリである。処理時間に合わせた visibility timeout、再配信時の冪等性、失敗時の DLQ を設計する。

## 6. ScaledJob と周辺技術

ScaledJob では Operator がイベント量と実行中の Job などに基づき Job を作成する。1 イベントにつき必ず 1 Job が作られるわけではなく、スケーリング戦略やジョブの処理方式に依存する。Knative Eventing の Broker / Trigger はイベントのルーティングを担い、KEDA の ScaledObject の trigger（指標を取得する定義）とは異なる。Knative Serving はリクエスト駆動の自動スケーリングを提供し、Knative Kafka コンポーネントが KEDA を使用できる構成もある。

## 7. 実装例：EKS・KEDA・SQS

AWS アカウント内に SQS キューと EKS クラスターを分け、EKS 内で KEDA Operator、Metrics Server、HPA、Deployment を動かす。KEDA scaler は AWS IAM Role for Service Accounts（IRSA）でキュー属性を読み、consumer Pod は別の権限でメッセージを受信・削除する。KEDA 自体がキューのメッセージを処理するわけではない。KEDA ScaledObject は SQS の queueURL、queueLength、activationQueueLength と対象 Deployment を指定する。ネットワーク、IAM、API の可用性とキュー設定は環境で構成する。

対応：キュー＝Amazon SQS、指標取得と起動＝EKS 内 KEDA Operator / SQS scaler、指標提供＝KEDA Metrics Server、レプリカ計算＝Kubernetes HPA、処理＝EKS 上の consumer Deployment、認証＝IRSA と IAM ロール。AWS と KEDA の公式資料を組み合わせた代表例であり、実機検証済み構成や導入事例ではない。

出典：[KEDA アーキテクチャ](https://keda.sh/docs/2.21/concepts/)、[ScaledObject](https://keda.sh/docs/2.21/reference/scaledobject-spec/)、[Kafka scaler](https://keda.sh/docs/2.21/scalers/apache-kafka/)、[SQS scaler](https://keda.sh/docs/2.21/scalers/aws-sqs/)、[AWS 認証](https://keda.sh/docs/2.21/authentication-providers/aws/)、[ScaledJob](https://keda.sh/docs/2.21/concepts/scaling-jobs/)、[Knative Broker](https://knative.dev/docs/eventing/brokers/)。
