# K3s によるエッジクラスタ

## 1. 対象

エッジ環境に自主管理の K3s クラスタを配置する構成例。

## 2. 機能配置と処理

管理者が K3s サーバーの Kubernetes API を使い、エージェント上のワークロードを管理する。単一サーバー構成では SQLite を利用できる。

## 3. 設計と利用上の注意

図は単一サーバーの例であり高可用構成ではない。オフライン時のデータ保持・再送はワークロードや別の仕組みの設計が必要。

## 4. 実装例：単一サーバーの自主管理 K3s

K3s Server、SQLite と Agent を使う最小構成例。クラウド提供サービスは仮定しない。

| 機能 | 担い手 |
|---|---|
| 運用者 | 運用者 |
| 管理サーバー | K3s Server |
| エッジノード | K3s Agent |
| 現場の処理 | エッジ処理 Pod |
| クラスタ状態 | SQLite |
| 現場センサー | センサー |

この例は現場の別々の Server ホストと Agent ホストで構成する。利用者がホスト、K3s、ネットワーク、ワークロードと SQLite のバックアップを管理し、権限に応じて Kubernetes API を操作する。クラウドサービスは前提としない。構成は公式資料を組み合わせた例で、実在の導入例や動作検証済みの構成ではない。

[K3s architecture](https://docs.k3s.io/architecture)、[K3s datastore](https://docs.k3s.io/datastore)。

## 5. 実装例：Ubuntu サーバーと Raspberry Pi の現場 LAN

現場の同じプライベート LAN に、Ubuntu 24.04 Server の x86-64 管理ホストと、Ubuntu 24.04 arm64 の Raspberry Pi を置く。管理ホストは単一の K3s Server、Pi は K3s Agent として systemd で動かす。現場処理の Pod は arm64 イメージを使い、Pi を配置先に選ぶ。

| 機能配置 | 実装での担い手 |
|---|---|
| 運用とクラスタ管理 | 運用 PC の kubectl と Ubuntu 上の K3s Server |
| エッジ実行 | Raspberry Pi の K3s Agent、kubelet、containerd |
| クラスタ状態の永続化 | 管理ホストの SSD 上の内蔵 SQLite |
| データ取得 | Pod 内のアプリケーションと現場 LAN のセンサー |

Agent は Server の TCP 6443 に接続する。既定の Flannel VXLAN を選ぶ場合、ノード間の Pod ネットワークには UDP 8472 が必要であり、現場ネットワーク内に限定する。単一サーバーなので管理データをバックアップする。接続が途切れた際の観測値の蓄積や再送を要する場合は、Pod 側の保存先と再送処理を設計する。SQLite はクラスタ状態の保存先であり、観測値の保存先とは別である。

利用者が両ホストの OS、K3s、API 接続、センサー連携とバックアップを運用する。この構成は複数の公式資料を組み合わせた未検証の例であり、実在の導入例ではない。Pi の対応機種、イメージ、センサープロトコルと復旧手順は導入時に確認する。

- [K3s architecture](https://docs.k3s.io/architecture)
- [K3s requirements and ports](https://docs.k3s.io/installation/requirements)
- [K3s Flannel network options](https://docs.k3s.io/installation/network-options)
- [K3s datastore backup and restore](https://docs.k3s.io/datastore/backup-restore)
