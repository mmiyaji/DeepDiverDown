# ネットワークとポリシーの違い

Kubernetes の Pod 間通信を制御する CNI とネットワークポリシーを比べる

| 観点 | Cilium | Calico |
| --- | --- | --- |
| 特徴 | **eBPF で NetworkPolicy を実施し、Hubble でフローを観測する**。Kubernetes の NetworkPolicy を Cilium が適用する | **Kubernetes 向けの CNI とネットワークポリシー**。Felix がカーネルへ反映し、BGP で経路を配る |
| データモデル・実行モデル | Pod ラベルと Ingress ルールで判定する。各ノードの Cilium Agent（DaemonSet）がパケットの転送と判定を担う | ポリシーと IP プールを Calico リソースとして保存し、各ノードの Felix が反映する |
| 一貫性・耐久性の仕組み | 台数や冗長化は未記載 | データストア（Kubernetes API か etcd）に保存し、Typha が変更を配る |
| 拡張のしかた | NetworkPolicy を足す。Hubble Relay で複数ノードのフローをまとめる | kubectl・calicoctl で selector と order を指定し、Allow・Deny・Log を書く |
| 運用の形態 | 利用者が Cilium・Relay・ポリシーを管理する。例は Amazon EKS | 自前クラスタで calico-node、Typha、kube-controllers を運用する |
| 得意な用途 | Pod 間の通信の許可・拒否の確認 | Pod 間の通信制御、ノード間の BGP 経路配布 |
| 注意点 | 転送イベントから HTTP の成功までは判断できない。許可は加算される | eBPF など他のデータプレーンの動作と制約は **未確認**。Pass・tiers の評価も **未確認** |
| ライセンス | 未確認（docs に記載なし） | Apache-2.0（GitHub の表示） |

内容は 2026 年 11 月時点の公式資料に基づく。確認できなかった点は「未確認」と書く。

## 選び方

- NetworkPolicy の判定結果を Hubble でフロー単位に確かめる → **Cilium**
- 複数ノードのフローを Relay でまとめて見る → **Cilium**
- ポリシーを selector と order で書き、Allow・Deny・Log を使い分ける → **Calico**
- ノード間の経路を BGP で配る → **Calico**

## 公式資料

- [Kubernetes Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Introduction to Cilium & Hubble](https://docs.cilium.io/en/stable/overview/intro/)
- [Network Observability with Hubble](https://docs.cilium.io/en/stable/observability/hubble/)
- [About Calico](https://docs.tigera.io/calico/latest/about/)
- [projectcalico/calico](https://github.com/projectcalico/calico)
