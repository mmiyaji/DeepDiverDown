# Spot Ocean による Kubernetes の容量管理

## 1. 対象
Spot by NetApp Ocean を使い、Kubernetes の Pod の要求と制約に応じてクラスタのノード容量を管理する構成。Ocean は余剰容量を提供するクラウドではなく、クラウド上の容量を管理する外部サービスである。

## 2. 機能配置と処理
クラスタ内のコントローラーが Pod やノードの状態を容量管理サービスに伝える。管理サービスは Virtual Node Group（VNG）の制約と Pod の要求を考慮してインスタンスを選び、クラウドにノード容量を要求する。コントローラーは交換時にノードを drain し、Kubernetes は停止した Pod を利用可能なノードへ再配置する。VNG は機種、配置や制約を整理する設定単位であり、それ自体が物理ノードではない。

## 3. 設計上の注意
スポット容量の不足や突然の中断、Pod の終了猶予、PodDisruptionBudget、アフィニティ、状態の保存、余裕容量、権限とコストを考慮する。ドレインや事前の置換は常に成功する保証ではなく、代替容量が利用できることも前提にできない。headroom は追加の容量と費用を伴う。対象クラウドごとに機能や設定は異なるため、この図の AWS 構成を他のクラウドにも自動的に適用できると考えない。

## 4. 実装例：Ocean と Amazon EKS / EC2
Spot Ocean の外部サービスと、AWS アカウントの EKS クラスタ内の Ocean Controller を分離する。Controller はクラスタの状態を報告し、Ocean のオートスケーラーは VNG の設定と Pod 要求に応じて EC2 ノードを確保する。クラウド API の権限や Ocean との接続、配置条件、通常容量の利用方針を設定する。選択・交換・drain は状況や設定に依存する。

| 機能 | 担い手 |
|---|---|
| クラスタの観測と drain | 顧客 VPC の EKS 内に配備した Ocean Controller v2 |
| 容量の判断と VNG 設定 | 外部の Spot Ocean サービス |
| 実行・再配置 | EKS と EC2 ワーカーノード上の Pod |
| 容量の起動 | AWS EC2 と Ocean の連携 |
| ワーカーノードのルートディスク | VNG の起動設定に従って EC2 に割り当てる Amazon EBS |

Ocean SaaS は連携した AWS アカウントの IAM ロールを使って EC2 容量を取得する。VNG で候補の機種、サブネット、ラベル、必要に応じてルートボリュームのブロックデバイス設定を管理する。Pod の割り当ては AWS 管理の EKS コントロールプレーン、コンテナの実行は顧客 VPC の EC2 ワーカー上で行う。ルートボリュームはノードの OS と作業領域に使い、置換後に必要なアプリデータは別の永続ストレージに保存する。

EKS コントロールプレーンは AWS 管理 VPC にあり、顧客アカウント内の VPC にはワーカーノードがある。利用者は Kubernetes API やクラスタ設定を操作できるが、AWS 管理の制御プレーンサーバーに直接アクセスしない。利用者は Ocean の設定と連携ロール、Controller の配備と権限、ノードやアプリの設定を管理する。図の AWS サービス領域は論理的な提供元を示し、制御プレーンが顧客 VPC 内にあるという意味ではない。この図は複数の公式資料を組み合わせた代表構成で、実環境での動作は未検証。

- [Spot Ocean Controller v2](https://docs.flexera.com/spot/ocean/tutorials/spot-kubernetes-controller/ocean-controller-two-intro)
- [Spot と AWS アカウントの IAM 接続](https://docs.flexera.com/spot/connect-your-cloud-provider/first-account/aws-manually)
- [VNG とルートボリューム設定](https://docs.flexera.com/spot/ocean/features/vngs/attributes-and-actions-per-vng)
- [Amazon EKS の管理 VPC と顧客 VPC](https://docs.aws.amazon.com/eks/latest/best-practices/subnets.html)

[Spot Ocean Kubernetes ガイド](https://spot.io/wp-content/uploads/2024/09/Guide_Automating_Kubernetes_infrastructure.pdf)、[AWS の VNG ワークショップ](https://labs.spot.io/ocean/ocean_workshop/vng_workshop/vng_workshop_instructions.html)、[Headroom](https://labs.spot.io/ocean/ocean_workshop/headroom/headroom_overview.html)。
