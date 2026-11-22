# OpenShift の基本アーキテクチャ

## 1. 読み方と範囲

OpenShift Container Platform で注文 API をプロジェクトに配置し、Service と Route で公開する流れを示す。OpenShift は Kubernetes の API とワークロード概念を基礎に、認証・イメージ・ルートなどのプラットフォーム機能を組み合わせる。図は説明用の論理構成である。

出典 [OpenShift Container Platform 4.21 Building applications](https://docs.redhat.com/en/documentation/openshift_container_platform/4.21/html-single/building_applications/index)・[Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)

## 2. プロジェクトと API への投入

利用者はプロジェクト（Kubernetes namespace に相当する作業領域）を選び、`oc apply` などで Deployment を API サーバーへ送る。API サーバーはリソースを受け付け、Controller が宣言された状態を調整する。

出典 [OpenShift Container Platform 4.21 Building applications](https://docs.redhat.com/en/documentation/openshift_container_platform/4.21/html-single/building_applications/index)

## 3. Deployment から Pod へ

Deployment は注文 API の Pod テンプレートを管理し、Controller と Scheduler が Pod をノードへ配置する。ノード上の kubelet とコンテナランタイムが Pod を起動するため、具体的な配置や更新結果はクラスタの状態と設定に依存する。

出典 [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)・[Kubernetes Cluster Architecture](https://kubernetes.io/docs/concepts/architecture/)

## 4. Service と Route

Service は注文 API Pod への内部の入口を提供する。OpenShift の Route は Service をホスト名で外部公開するリソースであり、DNS の設定とルーターの構成は別途必要になる。

出典 [OpenShift Container Platform 4.21 Building applications](https://docs.redhat.com/en/documentation/openshift_container_platform/4.21/html-single/building_applications/index)

## 5. worker 障害時の再調整

注文 API Pod が worker の障害で失われると、Deployment の望ましい状態と実際の状態に差が生じる。Controller と Scheduler が差分を処理し、新しい Pod を配置できるかは残存ノード、リソース、スケジューリング条件に依存する。OpenShift が常に同じ時間で復旧するという意味ではない。

出典 [Kubernetes Workloads](https://kubernetes.io/docs/concepts/workloads/)・[Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)

## 6. 更新の確認

Deployment の更新では新しい ReplicaSet を作り、ロールアウトの状態を確認できる。OpenShift では `oc rollout status` などの CLI で進行を観察し、必要なら履歴に基づくロールバックを検討する。

出典 [OpenShift Container Platform 4.21 Building applications](https://docs.redhat.com/en/documentation/openshift_container_platform/4.21/html-single/building_applications/index)・[Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
