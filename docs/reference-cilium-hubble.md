# Cilium と Hubble の通信ポリシーと観測

## 1. モデルの範囲

同じ名前空間のチェックアウト Pod、集計 Pod、注文 API Pod を使い、TCP 8080 宛ての通信を比べる。Cilium のポリシー適用と Hubble の観測を有効にした架空のクラスタを想定する。

出典 [Kubernetes Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)、[Introduction to Cilium & Hubble](https://docs.cilium.io/en/stable/overview/intro/)、[Network Observability with Hubble](https://docs.cilium.io/en/stable/observability/hubble/)

## 2. Kubernetes NetworkPolicy の条件

NetworkPolicy は `podSelector` で注文 API Pod を選び、Ingress でチェックアウト Pod のラベルと TCP 8080 を許可する。選ばれた Pod の Ingress は許可ルールに従う。この例では集計 Pod を別途許可するポリシーや、送信元の通信を制限する Egress ポリシーはない。実際には複数の NetworkPolicy の許可が加算され、送信元が Egress で隔離されていればそちらも許可が必要になる。

出典 [Kubernetes Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)

## 3. Cilium での適用

NetworkPolicy を実施するネットワークプラグインとして Cilium を使う。図では Cilium の eBPF データパスで制御される通信をひとつの部品にまとめる。チェックアウト Pod の接続は Ingress の条件に合い、集計 Pod から来たパケットは許可されず破棄される。

出典 [Kubernetes Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)、[Introduction to Cilium & Hubble](https://docs.cilium.io/en/stable/overview/intro/)

## 4. フローの観測経路

Hubble は Cilium のネットワークイベントを観測できる。ノードの Hubble でローカルのフローを参照でき、Relay は複数ノードの Hubble API をまとめて CLI などに提供する。

出典 [Introduction to Cilium & Hubble](https://docs.cilium.io/en/stable/overview/intro/)、[Network Observability with Hubble](https://docs.cilium.io/en/stable/observability/hubble/)、[Inspecting Network Flows with the CLI](https://docs.cilium.io/en/stable/observability/hubble/hubble-cli/)

## 5. Hubble で判定を確かめる

許可例では対象フローの転送を `FORWARDED` として追う。拒否例では宛先 Pod と `--verdict DROPPED` で絞り、`Policy denied` のイベントを確認する。TCP の転送イベントから HTTP や注文処理の成功までは判断できない。表示中のフローに該当イベントがなければ、観測範囲とフィルターも確認する。

出典 [Inspecting Network Flows with the CLI](https://docs.cilium.io/en/stable/observability/hubble/hubble-cli/)

## 6. 実装例：Kubernetes の Cilium Agent と Hubble Relay
Kubernetes に Cilium と Hubble Relay を配置し、注文 API への許可・拒否フローを確かめる例。

| 機能配置 | この例での担い手 |
|---|---|
| チェックアウトの実行単位 | checkout Deployment の Pod |
| 集計処理の実行単位 | report Deployment の Pod |
| 注文 API の着信ポリシー | NetworkPolicy マニフェスト |
| ノードのパケット転送・判定 | Cilium Agent DaemonSet / eBPF / Hubble |
| 注文 API の実行単位 | order-api Deployment の Pod |
| ノードのフロー観測 | Cilium Agent DaemonSet / eBPF / Hubble |
| 複数ノードの観測集約 | Hubble Relay Deployment |
| フロー確認クライアント | hubble CLI |

- **kubectl による Relay の port-forward**。検証用に API 経由で Relay のポートへ接続する。

port-forward は確認用の接続例。Hubble の verdict は通信の可否を説明するために使い、アプリケーションの正常性は別のテストで測る。

公式資料
- [Hubble Observability Setup](https://docs.cilium.io/en/stable/observability/hubble/setup/index.html)
- [Hubble Architecture](https://docs.cilium.io/en/stable/observability/hubble/)
- [Kubernetes Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
