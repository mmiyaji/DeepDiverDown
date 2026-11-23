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

## 7. 実装例：OpenShift と Ingress Controller
利用者が VMware vSphere に用意した RHCOS の制御 VM と worker VM 上で OpenShift を稼働させ、注文 API を標準の Ingress Controller から公開する例。

| 機能配置 | この例での担い手 |
|---|---|
| 構成の投入クライアント | oc CLI |
| クラスタ管理 API | API 用 L4 ロードバランサーと RHCOS の制御 VM |
| レプリカ調整・配置先の決定 | OpenShift コントロールプレーン |
| ノード実行エージェント | RHCOS worker の kubelet / CRI-O |
| 注文 API の実行単位 | 注文 API Deployment / Pod |
| 注文 API の内部公開 | 注文 API の ClusterIP Service |
| 外部公開ルート | アプリ用 L4 ロードバランサー、TLS Route、HAProxy Router |

- **apps ドメインのワイルドカード DNS**。Route のホスト名をアプリ用ロードバランサーに解決する。

TLS の終端方式は Route で選択する。エッジ終端を使う場合、Router からバックエンドまでの暗号化要件を別途決める。

API ロードバランサーは TCP 6443 を制御 VM に、アプリ用は TCP 80・443 を Router が稼働するノードに転送する。Router が Route に対する Service のエンドポイントを選び、対象 Pod へ送る。各制御 VM で稼働する etcd が永続ディスクにクラスタ状態を保持する。

この例では Router Pod は worker 上で動作し、API とアプリの L4 ロードバランサーおよび DNS はクラスタ外に配置する。利用者は vSphere の VM、ネットワーク、DNS とロードバランサーを用意・運用し、OpenShift の API とサポートされる設定を通じてクラスタやワークロードを管理する。RHCOS や OpenShift の管理対象コンポーネントを任意に直接変更できるとは仮定しない。

複数の公式資料を組み合わせた代表構成であり、実在の導入例や動作検証済み構成ではない。VM 容量、冗長化、ロードバランサー製品、TLS 終端方式は未確定。

公式資料
- [OpenShift Ingress and load balancing](https://docs.redhat.com/en/documentation/openshift_container_platform/4.21/html-single/ingress_and_load_balancing/index)
- [OpenShift Networking Operators](https://docs.redhat.com/en/documentation/openshift_container_platform/4.21/html-single/networking_operators/index)
- [OpenShift の vSphere ユーザー管理インフラ](https://docs.redhat.com/en/documentation/openshift_container_platform/4.21/html/installing_on_vmware_vsphere/user-provisioned-infrastructure)
