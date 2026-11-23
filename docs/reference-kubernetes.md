# Kubernetes の基本アーキテクチャ

## 1. 読み方と範囲

Kubernetes の標準的な制御プレーン、ワーカーノード、Pod、Service を使い、注文 API を配置する流れを示す。図は説明用の論理構成であり、特定クラスタの台数・ネットワーク・可用性を表すものではない。

出典 [Cluster Architecture](https://kubernetes.io/docs/concepts/architecture/)・[Workloads](https://kubernetes.io/docs/concepts/workloads/)

## 2. API への投入

利用者は `kubectl apply` などで Deployment の望ましい状態を API サーバーへ送る。API サーバーはクラスタの API 入口であり、Deployment は Pod を直接管理せず ReplicaSet を介して管理する。

出典 [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)

## 3. スケジューリングと Pod の起動

Deployment Controller は指定された Pod の状態を確認し、必要な ReplicaSet を整える。Scheduler は未配置の Pod をノードへ割り当て、各ノードの kubelet がコンテナランタイムを通じて Pod を起動する。これらは API サーバーを介して状態を読み書きする論理的な引き渡しとして図示している。配置先や再配置はクラスタの状態と設定に依存する。

出典 [Cluster Architecture](https://kubernetes.io/docs/concepts/architecture/)・[Pods](https://kubernetes.io/docs/concepts/workloads/pods/)・[Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)

## 4. Service 経由の注文 API

Service は Pod の一時的な IP を利用者から隠し、ラベルに一致する Pod 群へのネットワーク入口を提供する。注文 API のクライアントは、個別 Pod 名ではなく Service 名を宛先にする。

出典 [Service](https://kubernetes.io/docs/concepts/services-networking/service/)

## 5. Worker 障害を観察する

注文 API を載せた worker node の障害は、kubelet の heartbeat や Node Ready 状態を API サーバー側の制御プレーンが観察して扱う。失われた Pod が Controller に直接通知するわけではない。Controller は差分を検知して新しい Pod を作成し、Scheduler は配置可能なノードを選ぶ。実際の復旧可否や時間はノード数、リソース、設定に依存し、図はこの再調整の経路を示す。

出典 [Workloads](https://kubernetes.io/docs/concepts/workloads/)・[Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)

## 6. ロールアウトの確認

Deployment の更新では新しい ReplicaSet を作り、古い Pod を段階的に置き換える。`kubectl rollout status` などで状態を確認でき、問題がある場合は Deployment の履歴を使ったロールバックを検討する。

出典 [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)

## 7. 実装例：kubeadm と stacked etcd
オンプレミスの仮想マシンで、kubeadm の stacked etcd 構成を使って注文 API を動かす例。

| 機能配置 | この例での担い手 |
|---|---|
| 構成の投入クライアント | kubectl |
| API サーバー | コントロールプレーンVM × 3 |
| レプリカ調整 | コントロールプレーンVM × 3 |
| 配置先の決定 | コントロールプレーンVM × 3 |
| クラスタ状態ストア | 各制御 VM の static Pod の etcd とローカル永続ディスク |
| ノード実行エージェント | worker VM の kubelet と containerd |
| 注文 API の実行単位 | 注文 API Deployment / Pod |
| 注文 API の内部公開 | ClusterIP Service |

- **API 用 TCP ロードバランサー**。同一 DNS 名から各 API サーバーの 6443 番ポートへ接続を振り分ける。

コントロールプレーン間の通信と Pod ネットワークを開通させ、CNI を別途選定する。etcd を別の VM 群へ置く external etcd 構成も選べる。

kubeadm の既定のローカル etcd は各制御 VM の `/var/lib/etcd` に状態を保持する。この例では永続ディスク上に置く。API 用 TCP ロードバランサーの共有アドレスを `ControlPlaneEndpoint` に使い、運用端末と worker から到達できるようにする。

利用者は VM、kubeadm と Kubernetes の設定・更新、CNI、ロードバランサー、証明書、etcd のバックアップを運用する。kubectl から認証・認可に応じて Kubernetes API のリソースを操作する。CNI の実装はこの例では未選定で、導入時に選択してクラスタ全体に設定する。API 用ロードバランサーはクラスタ外にある。

複数の公式資料を組み合わせた代表構成で、実在の導入例や動作検証済み構成ではない。VM 数、ネットワーク実装、イメージ供給元、バックアップ先は導入時に決定する。

公式資料
- [Cluster Networking](https://kubernetes.io/docs/concepts/cluster-administration/networking/)
- [Creating Highly Available Clusters with kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/high-availability/)
- [Kubernetes Components](https://kubernetes.io/docs/concepts/overview/components/)
- [Service](https://kubernetes.io/docs/concepts/services-networking/service/)
- [kubeadm の LocalEtcd 設定](https://kubernetes.io/docs/reference/config-api/kubeadm-config.v1beta4/)
