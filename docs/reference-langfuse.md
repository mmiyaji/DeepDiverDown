# Langfuse による AI アプリの可観測性

## 1. 対象

LLM とエージェントの実行記録を収集し、保存・評価・調査する。

## 2. 機能配置と処理

アプリはモデル呼び出しやツール利用の記録を送信する。Web が受け取り、非同期 worker が処理し、観測データと設定等をそれぞれ保存する。運用者は画面で調査と評価を行う。

## 3. 設計上の注意

入力・出力に機微情報が含まれ得る。データ保存期間、権限、記録量、個別のストレージの障害とアップグレードを確認する。

## 4. 実装例

Langfuse の自己ホスト構成。Web と Worker、ClickHouse、PostgreSQL、Redis / Valkey と S3 互換の blob ストレージを組み合わせる。配置先のクラウドは固定しない。

| 機能 | 担い手 |
|---|---|
| AI アプリ | 計装した AI アプリ |
| 記録の受付・画面 | Langfuse Web |
| 非同期処理 | Langfuse Worker |
| 観測データ | ClickHouse |
| 運用・評価担当者 | 運用・評価担当者 |
| 処理待ち | Redis / Valkey |
| 設定と管理データ | PostgreSQL |
| イベントと添付の保管 | S3 互換 blob ストレージ |

この例では利用者が Langfuse、ClickHouse、PostgreSQL と Redis / Valkey をホスト群で運用する。S3 互換ストレージの提供元と配置は未選定で、Amazon S3 を意味しない。利用者がデータ、設定、認証とバックアップを管理する。複数資料を組み合わせた未検証例であり、AI モデルの提供先と実行場所は仮定しない。

[Langfuse architecture](https://langfuse.com/handbook/product-engineering/architecture)、[Self-hosting infrastructure](https://langfuse.com/self-hosting/configuration/scaling)。

## 5. 実装例：AWS の EKS / Fargate・Langfuse v4

Langfuse の公式 AWS Terraform の構成例。EKS の Fargate に Helm chart v2 を使って Langfuse v4 の Web と Worker を配置する。ClickHouse の Kubernetes Operator と cert-manager も配置し、ClickHouse と Keeper の永続ボリュームを EFS CSI で割り当てる。Langfuse v4 の ClickHouse は 25.12 以降が必要。

| 機能配置 | 実装での担い手 |
|---|---|
| AI アプリと運用・評価担当者 | SDK で計装したアプリと Web UI の利用者。ALB 経由で接続する |
| 記録の受付と画面 | Fargate 上の Langfuse Web Pod |
| 非同期処理 | Fargate 上の Langfuse Worker Pod |
| 観測データ | EKS の ClickHouse。Keeper と共に EFS に永続化する |
| 処理待ち | ElastiCache for Redis |
| 設定と管理データ | Aurora PostgreSQL Serverless v2 |
| イベントと添付の保管 | Amazon S3 |

EKS の制御プレーンは AWS 管理 VPC にあり、利用者は API と公開設定を操作できるがサーバーへ直接アクセスしない。AWS が Fargate と各マネージドサービスの基盤を運用し、利用者が Pod、アプリ設定、データと権限を管理する。Aurora、ElastiCache、S3、EFS、ALB は EKS クラスタ外の独立サービスである。公式資料を組み合わせた構成で、本リポジトリでは動作検証していない。対応バージョン、EFS 設定と障害復旧を導入時に確認する。

Web は S3 にイベントを保存し、その参照を Redis のジョブキューへ送る。Worker はキューから受け取った参照で S3 のイベントを読み、ClickHouse に書き込む。Web は ClickHouse を観測データの照会に使う。EKS、Fargate、Aurora、ElastiCache、S3、EFS は AWS の管理サービスで、Langfuse と ClickHouse のバージョン更新、データ復旧手順、監視は構成の運用者が管理する。Langfuse のコアは MIT ライセンスで、一部の追加ガバナンス機能には商用ライセンスを使う。

- [EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)
- [Langfuse AWS Terraform v4](https://langfuse.com/self-hosting/deployment/aws)
- [Langfuse platform architecture](https://langfuse.com/handbook/product-engineering/architecture)
- [ClickHouse requirements for Langfuse v4](https://langfuse.com/self-hosting/deployment/infrastructure/clickhouse)
- [Langfuse self-hosting license](https://langfuse.com/resources/engineering/clarifications)
