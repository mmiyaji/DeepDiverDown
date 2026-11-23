# K3s の基本アーキテクチャ

## 1. 読み方と範囲

K3s の公式アーキテクチャにある server と agent の構成を、注文 API を配置する小さなクラスタとして読む。K3s の server は `k3s server` で起動するホスト、agent は `k3s agent` で起動するホストであり、図は選択した単一 server + agent トポロジーの説明用表現である。

出典 [K3s Architecture](https://docs.k3s.io/architecture)

## 2. Server と Agent

Server は K3s の control-plane と datastore を管理する。Agent は datastore や control-plane を持たず、server に登録される。公式説明では、server と agent の双方が kubelet、コンテナランタイム、CNI を実行する。

出典 [K3s Architecture](https://docs.k3s.io/architecture)

## 3. 注文 API の投入

利用者は server 上の K3s API を通じて Kubernetes リソースを操作する。注文 API の Deployment を適用すると、Kubernetes の通常の Controller と Scheduler が Pod の望ましい状態と配置を調整し、agent 側の kubelet とランタイムが Pod を起動する。

出典 [K3s Architecture](https://docs.k3s.io/architecture)・[Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)

## 4. Service 経由のアクセス

注文 API Pod には Service を介してアクセスする。Service のエンドポイントは Pod のライフサイクルに追随するため、クライアントは個別 Pod の IP や名前を固定的に扱わない。

出典 [Kubernetes Service](https://kubernetes.io/docs/concepts/services-networking/service/)

## 5. Agent 障害を観察する

Agent ホストが失われると、そのホスト上の注文 API Pod も影響を受ける。server 側の control-plane がクラスタ状態を扱い、Deployment の望ましい状態との差分を調整する。新しい Pod を配置できるか、復旧に要する時間は agent の構成、利用可能なリソース、設定に依存する。

出典 [K3s Architecture](https://docs.k3s.io/architecture)・[Kubernetes Workloads](https://kubernetes.io/docs/concepts/workloads/)

## 6. 実装例：K3s の組み込み etcd 構成
小規模なオンプレミス環境で、3 台の K3s server と複数の agent に注文 API を配備する例。

| 機能配置 | この例での担い手 |
|---|---|
| 構成の投入クライアント | kubectl |
| クラスタ制御部 | K3s server VM × 3 |
| クラスタ状態ストア | K3s server VM × 3 |
| ノード参加エージェント | K3s agent VM |
| ノード実行・ネットワーク | K3s agent VM |
| 注文 API の実行単位 | 注文 API Deployment |
| 注文 API の公開 | LoadBalancer Service / ServiceLB |

- **固定 API・登録アドレス**。外部 TCP ロードバランサーを介して server に接続する。

組み込み etcd の投票には過半数が必要。ServiceLB の使用ポートはホスト上で空けておき、API の登録先とアプリ公開の経路は個別に管理する。

公式資料
- [K3s High Availability Embedded etcd](https://docs.k3s.io/datastore/ha-embedded)
- [K3s Networking Services](https://docs.k3s.io/networking/networking-services)
