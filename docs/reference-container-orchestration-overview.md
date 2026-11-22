# コンテナオーケストレーションのリファレンス

同じステートレスな注文 API を題材に、何を宣言し、どこで起動し、停止を検知したときに何が置き換わるかを比較する。サイドバーの「コンテナオーケストレーション」から各構成図とシナリオを開ける。

| 分類 | リファレンス | 図で確認するポイント |
|---|---|---|
| Kubernetes | [Kubernetes](reference-kubernetes.md) | Deployment、スケジューラー、kubelet、Service の分担 |
| Kubernetes ディストリビューション | [Red Hat OpenShift](reference-openshift.md) | Kubernetes のワークロードと OpenShift の Route・Ingress の関係 |
| Kubernetes ディストリビューション | [K3s](reference-k3s.md) | Server、Agent、データストアの構成 |
| Kubernetes ディストリビューション | [RKE2](reference-rke2.md) | 固定登録アドレス、Server、Agent、etcd の分担 |
| マネージド Kubernetes | [Amazon EKS](reference-amazon-eks.md) | AWS が管理する制御プレーンとワーカー側の責任分担 |
| マネージド Kubernetes | [Azure AKS](reference-azure-aks.md) | Azure が管理する制御プレーンとノードプール |
| マネージド Kubernetes | [Google GKE](reference-google-gke.md) | Standard と Autopilot で異なるノード管理の範囲 |
| 独自 API のオーケストレーター | [Amazon ECS](reference-amazon-ecs.md) | Task Definition、Service、Task と実行容量の分担 |
| 独自 API のオーケストレーター | [HashiCorp Nomad](reference-nomad.md) | Job、Task Group、Allocation と Server・Client の分担 |
| 独自 API のオーケストレーター | [Docker Swarm](reference-docker-swarm.md) | Manager が Service の希望状態に合わせて Task を配置する流れ |

サイドバーの **「プロダクトを比較」** を開き、上部の **「左を変更」** または **「右を変更」** から候補を選ぶ。2つの構成図と、制御プレーン、実行単位と配置、運用の違いを表で確認できる。

## 見比べるポイント

- **希望状態**。Kubernetes では Deployment が Pod のテンプレートと希望数を持つ。ECS、Nomad、Swarm ではそれぞれの API が実行単位と希望状態を表現する。
- **運用の責任範囲**。マネージド Kubernetes の各教材では、クラウド事業者が管理する制御プレーンと、利用者が設定する実行環境やワークロードを分けている。
- **障害時の復旧**。再配置には、制御プレーンが機能し、配置条件を満たす実行先に空きがあることが必要。コンテナの再作成と永続データの復旧はそれぞれ確認する。

公式資料は各リファレンスに記載している。
