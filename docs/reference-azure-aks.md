# Azure AKS マネージド境界とノード更新

## 1. 範囲
Azure Kubernetes Service（AKS）のマネージドコントロールプレーン、ノードプール、デプロイとノード置換を示す。採用するのは通常の AKS（Standard tier の設計例）で、仮想ノードや Virtual Machine Scale Sets 直接管理はこの図の主役にしない。

出典 [AKS core concepts](https://learn.microsoft.com/azure/aks/core-aks-concepts)・[Create node pools](https://learn.microsoft.com/azure/aks/create-node-pools)

## 2. マネージド境界
Azure は AKS のコントロールプレーンを管理し、API server とスケジューラ等の Kubernetes 管理コンポーネントを提供する。利用者はワークロード、ネットワーク、ID、ノードプールの構成とアップグレード方針を管理する。エージェントノードは利用者のサブスクリプション側で動き、ノードプールの VM/VMSS ライフサイクルを AKS が自動化する。

出典 [AKS core concepts](https://learn.microsoft.com/azure/aks/core-aks-concepts)・[AKS architecture](https://learn.microsoft.com/azure/architecture/reference-architectures/containers/aks-start-here)

## 3. 採用するノード方式
system node pool を基盤用、user node pool をアプリ用に分ける方式を採用する。実際のノード数・VM SKU・ゾーン・autoscaler 範囲は未確定で、モデルに replica 数は置かない。AKS Virtual Machine Scale Sets はプールの実装詳細であり、アプリからは Kubernetes node pool として見える。

出典 [Create node pools](https://learn.microsoft.com/azure/aks/create-node-pools)・[Use system node pools](https://learn.microsoft.com/azure/aks/use-system-pools)

## 4. API とデプロイ
運用者は Azure API/CLI でクラスターやプールを管理し、Kubernetes API で Deployment を適用する。AKS コントロールプレーンが Pod を system/user node pool にスケジュールし、Azure Container Registry（ACR）からイメージを取得する。Service と Azure Load Balancer が利用者向け入口になる。

出典 [AKS core concepts](https://learn.microsoft.com/azure/aks/core-aks-concepts)・[Use ACR with AKS](https://learn.microsoft.com/azure/aks/cluster-container-registry-integration)

## 5. 更新・置換
AKS のフルアップグレードはコントロールプレーンを先に更新し、その後各ノードプールを順番に更新する。ノードプール更新では cordon/drain と新 VM の作成を伴い、PDB や十分な余剰容量が中断を左右する。コントロールプレーンのみの更新はノードプールを更新しないため、両者を同じ操作と仮定しない。

出典 [Upgrade AKS control plane](https://learn.microsoft.com/azure/aks/upgrade-aks-control-plane)・[Node image upgrade](https://learn.microsoft.com/azure/aks/node-image-upgrade)

## 6. 論理図の読み方
管理者から Azure/ Kubernetes API を経て AKS 境界へ入り、コントロールプレーンから system pool、user pool、ワークロードへ下る。ACR はイメージ供給、Load Balancer は公開境界である。system/user の分離は責務の境界であり、具体的な VM 台数や配置を確定するものではない。

出典 [Use system node pools](https://learn.microsoft.com/azure/aks/use-system-pools)

## 7. シナリオ：同じ順序の API・デプロイ・置換
1. **受付** — 運用者が Azure/ Kubernetes API にクラスター設定または Deployment を送る。
2. **配置** — AKS コントロールプレーンが Pod を user pool（必要なら system pool）へ割り当て、ACR からイメージを取得する。
3. **公開** — Service と Azure Load Balancer がワークロードを外部へ公開する。
4. **置換** — フルアップグレードではコントロールプレーンの後、node pool を順番に drain・新 VM 作成・再スケジュールする。

## 8. 参考資料
- [AKS core concepts](https://learn.microsoft.com/azure/aks/core-aks-concepts)
- [Create node pools](https://learn.microsoft.com/azure/aks/create-node-pools)
- [Use system node pools](https://learn.microsoft.com/azure/aks/use-system-pools)
- [Upgrade the AKS control plane](https://learn.microsoft.com/azure/aks/upgrade-aks-control-plane)

## 9. 実装例：AKS Standard・ACR・Load Balancer
AKS のシステムプールとユーザープールを分け、ユーザープール上の注文 API を LoadBalancer Service で公開する例。

| 機能配置 | この例での担い手 |
|---|---|
| 運用者 | kubectl と Microsoft Entra ID |
| マネージド制御 API | AKS マネージド制御プレーン |
| 基盤用ノード群 | Azure VM Scale Set（System） |
| アプリ用ノード群 | Azure VM Scale Set（User） |
| 注文 API の実行単位 | 注文 API Deployment / Pod |
| アプリ公開・振り分け | Azure Standard Load Balancer |
| コンテナイメージの保管 | Azure Container Registry |

- **注文 API の LoadBalancer Service**。クラウド側ロードバランサーと Kubernetes 側エンドポイントを対応させる。

ユーザープールへの配置はマニフェストで指定する。システムプールへのアプリ配置を厳格に防ぐ場合は taint と toleration の設計も必要。

公式資料
- [AKS core concepts](https://learn.microsoft.com/azure/aks/core-aks-concepts)
- [AKS baseline architecture](https://learn.microsoft.com/en-us/azure/architecture/reference-architectures/containers/aks/baseline-aks)
- [Use a Standard Load Balancer in AKS](https://learn.microsoft.com/en-us/azure/aks/load-balancer-standard)
