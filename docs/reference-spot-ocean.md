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
| クラスタの観測と drain | EKS 内の Ocean Controller |
| 容量の判断と VNG 設定 | 外部の Spot Ocean サービス |
| 実行・再配置 | EKS と EC2 ワーカーノード上の Pod |
| 容量の起動 | AWS EC2 と Ocean の連携 |

[Spot Ocean Kubernetes ガイド](https://spot.io/wp-content/uploads/2024/09/Guide_Automating_Kubernetes_infrastructure.pdf)、[AWS の VNG ワークショップ](https://labs.spot.io/ocean/ocean_workshop/vng_workshop/vng_workshop_instructions.html)、[Headroom](https://labs.spot.io/ocean/ocean_workshop/headroom/headroom_overview.html)、[EKS ノードグループ](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)。
