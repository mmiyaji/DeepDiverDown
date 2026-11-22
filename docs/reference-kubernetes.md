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
