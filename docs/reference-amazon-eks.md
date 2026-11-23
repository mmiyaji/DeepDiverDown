# Amazon EKS マネージド境界とノード更新

## 1. 範囲
Amazon EKS の API 受付、AWS が管理する Kubernetes コントロールプレーン、利用者が選ぶデータプレーンの境界を示す。ここでは EKS のマネージドノードグループを採用し、ノードは利用者の AWS アカウント内で動くが、EC2 Auto Scaling グループとノード更新のライフサイクルは EKS に委ねる。

出典 [EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)・[Managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)

## 2. マネージド境界
AWS が API server、scheduler、controller manager、etcd を含むコントロールプレーンの可用性・スケール・障害ノード交換を管理する。利用者は Kubernetes オブジェクト、IAM、VPC、ワークロード、ノードグループの設定を管理する。マネージドノードグループではノードのプロビジョニング、ドレイン、更新・終了も EKS が自動化するが、EC2、Auto Scaling、ネットワークは利用者アカウント側の資源である。

出典 [EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)・[Managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)

## 3. 採用するノード方式
採用方式は EKS managed node group（複数 Availability Zone）とする。自己管理ノードや Fargate、EKS Auto Mode はこの図の選択外である。ノード台数・サブネット・インスタンスタイプは未確定であり、モデルに台数を事実として記録しない。

出典 [Managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)

## 4. API とデプロイ
運用者は AWS API/CLI または Kubernetes API に接続し、Deployment などの desired state を送る。コントロールプレーンがスケジューリングし、managed node group の EC2 ノード上で Pod が起動する。コンテナイメージは ECR から取得し、Service/Load Balancer 経由で利用者へ公開する。

出典 [Managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)・[EKS User Guide](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html)

## 5. 更新・置換
コントロールプレーン更新と managed node group 更新は別操作である。ノードグループ更新を開始すると EKS はノードを順次置き換え、Pod をドレインして可用性を保つ。ノード障害時は有効化した node auto repair が検知したノードを置換する。Pod の PDB、容量、更新設定は利用者が検証すべき前提である。

出典 [Update a managed node group](https://docs.aws.amazon.com/eks/latest/userguide/update-managed-node-group.html)・[Managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)

## 6. 論理図の読み方
上段の利用・管理境界から API、コントロールプレーン、ノードグループ、ワークロードへ下る。ECR は実行時のイメージ供給元、Load Balancer は公開境界として別ティアに置く。青い cluster 境界は EKS のクラスタ、node tier は利用者アカウント内のデータプレーンを意味する。

出典 [EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)

## 7. シナリオ：同じ順序の API・デプロイ・置換
1. **受付** — 運用者が EKS/Kubernetes API に Deployment の desired state を送る。
2. **配置** — コントロールプレーンが Pod を managed node group の利用可能な EC2 ノードへ割り当て、ECR からイメージを取得する。
3. **公開** — Service/Load Balancer がワークロードを外部へ公開する。
4. **置換** — ノード更新または auto repair が対象ノードをドレインし、新ノードを登録して Pod を再配置する。

## 8. 参考資料
- [EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)
- [Managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [Update a managed node group](https://docs.aws.amazon.com/eks/latest/userguide/update-managed-node-group.html)
- [What is Amazon EKS?](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html)

## 9. 実装例：EKS Managed Node Group と ALB
AWS の EKS クラスタで、プライベートサブネットの Managed Node Group に注文 API を置き、Ingress で公開する例。

| 機能配置 | この例での担い手 |
|---|---|
| 運用者 | kubectl と IAM の運用ロール |
| マネージド制御 API | Amazon EKS マネージド制御プレーン |
| アプリ用の管理対象ノード群 | Managed Node Group の EC2 |
| 注文 API の実行単位 | 注文 API Deployment / Pod |
| アプリ公開・振り分け | Application Load Balancer |
| コンテナイメージの保管 | Amazon ECR リポジトリ |
| 実行状態の監視 | CloudWatch Container Insights |

- **AWS Load Balancer Controller**。Ingress を監視し、ALB とターゲット登録を調整する。

制御プレーンは AWS 管理 VPC で稼働し、顧客 VPC や顧客アカウント内の EC2 ノードとは別の運用境界にある。利用者は権限に応じて Kubernetes API とクラスタ設定を操作し、公開・プライベート API エンドポイントを設定できるが、制御プレーンのサーバー自体には直接アクセスしない。図の外枠は両者を含む AWS のサービス領域を表し、単一の顧客アカウントや VPC を意味しない。[EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)

この例は複数の公式資料を組み合わせた代表構成であり、実在の導入例や動作検証済みの構成ではない。EKS は Managed Node Group のノード作成と更新を支援し、利用者が設定、修正済み AMI の適用開始、アプリとコントローラーを管理する。

ALB の IP ターゲット方式を選ぶ。公開ステップではコントローラーによるターゲットの調整と、ALB から Pod IP への HTTP 転送を示す。コントローラーの IAM 権限とサブネットの選択を確認する。

公式資料
- [Amazon EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [Application Load Balancers on EKS](https://docs.aws.amazon.com/eks/latest/userguide/alb-ingress.html)
- [CloudWatch Observability EKS add-on](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/install-CloudWatch-Observability-EKS-addon.html)
