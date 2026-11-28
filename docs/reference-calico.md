# Calico の概要（ポリシー・Felix・Typha・BIRD・CNI・データプレーン）

2026年11月28日に公式資料を取得して確認した内容である。

## 1. 概要

Calico は Kubernetes などに使うネットワークとネットワークポリシーの製品である。Kubernetes では CNI プラグインとして Pod に IP を割り当て、ポリシーで通信を制御する。GitHub のリポジトリ（projectcalico/calico）は Apache-2.0 ライセンスと表示されている。公式ドキュメントの最新版は Calico Open Source 3.33 と案内されている。有償・クラウド版の Calico Cloud もある。最新リリースの日付と CNCF での位置づけは未確認。

- [About Calico](https://docs.tigera.io/calico/latest/about/)
- [projectcalico/calico](https://github.com/projectcalico/calico)

## 2. コンポーネント

- Felix: エンドポイントのあるノードごとに動き、経路・ACL・インターフェースの設定をカーネルに反映する。状態の異常も報告する。
- BIRD: BGP デーモン。Felix がカーネルの経路表に入れた経路を他のノードへ配る。大規模ではルートリフレクターにもなる。
- confd: データストアの BGP 設定を見て BIRD の設定ファイルを作り、再読込させる。
- Typha: データストアと Felix・confd の間に入り、状態をキャッシュして 1 本の接続で多数のクライアントに変更を配る。既定でインストールされるが、既定では設定されない。
- calico-node: Felix・BIRD・confd をまとめて各ノードで動かす。`CALICO_NETWORKING_BACKEND=none` のポリシー専用モードでは BIRD と confd は動かない。
- calico-kube-controllers: Kubernetes API を監視し、policy・namespace・serviceaccount・workloadendpoint・node の各コントローラーで Calico リソースを更新する。
- データストア: Kubernetes API（追加のデータストアが不要）か etcd（非 Kubernetes 環境や複数クラスタ向け）。
- calicoctl: Calico のオブジェクトを操作する CLI。データストアへの到達性が要る。

[Calico component architecture](https://docs.tigera.io/calico/latest/reference/architecture/overview)

## 3. ネットワークポリシー

NetworkPolicy は namespace に属し、同じ namespace のエンドポイントだけを対象にする。GlobalNetworkPolicy は namespace を持たず、Pod・VM・ホストのインターフェースなど任意のエンドポイントに適用できる。エンドポイントはワークロードエンドポイント（Pod や VM）とホストエンドポイントに分かれる。

`spec.selector` で対象を選び、規則の source・destination に selector・namespaceSelector・CIDR（`nets`）を書く。ingress と egress は別々に定義し、`types` を省略すると規則の有無から決まる。動作は Allow、Deny、Log。`order` は小さい値から先に評価する。Kubernetes の Pod は Kubernetes の意味づけに従い、ポリシーが当たると許可した通信だけが通る。それ以外のエンドポイントは、ポリシーが無くても既定で拒否になる。変更は新しい接続に即座に効き、既存の接続は再接続後に反映される。Pass の動作と tiers の評価は取得した資料に記載がなく未確認。

[Calico network policy](https://docs.tigera.io/calico/latest/network-policy/get-started/calico-policy/calico-network-policy)

## 4. データプレーン

機能表に載るデータプレーンは eBPF、Windows、nftables、iptables、VPP。コンポーネントの資料では Felix が iptables で通信を制御する構成が説明されている。他のデータプレーンの動作・制約・版ごとの対応は未確認。

## 5. CNI プラグインと IPAM

CNI プラグインは各ノードに入り、標準の CNI 設定から呼ばれる。IPAM プラグインが Calico の IP プールのリソースから Pod の IP を割り当てる。

## 6. 運用の入口

管理者は kubectl または calicoctl でポリシーと IP プールを操作する。Calico API サーバーを使うと `projectcalico.org/v3` のリソースを kubectl で扱える。Istio 向けには Dikastes が L3 から L7 のポリシーを適用する（本図では扱わない）。

## 7. 実装例：自前の Kubernetes クラスタ

| 機能 | 具体的な担い手 |
| --- | --- |
| 管理者 | kubectl・calicoctl |
| データストアとポリシー | Kubernetes API サーバーに保存した NetworkPolicy と Calico のリソース |
| 状態の配信 | calico-typha |
| 規則・経路の反映、BGP | calico-node（Felix・BIRD・confd） |
| データプレーン | Linux カーネル（iptables） |
| Pod の接続 | Calico CNI プラグインと IPAM |

利用者が自前のサーバーでクラスタ、ノード、Calico を運用する構成。公式資料に基づく代表例であり、導入事例や動作検証済みの構成ではない。ノード数、BGP のピア構成、eBPF など別のデータプレーンは未確認。
