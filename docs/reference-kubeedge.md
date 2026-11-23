# KubeEdge のクラウド・エッジ連携

## 1. 対象

KubeEdge の管理側とエッジ側のコンポーネント、およびワークロード配置を整理する。

## 2. 機能配置と処理

Kubernetes API と CloudCore の CloudHub が管理側で動作し、EdgeCore の EdgeHub が接続する。edged がエッジワークロードを実行する。

## 3. 設計と利用上の注意

管理側は特定のクラウド事業者を前提としない。切断時に利用できる機能と状態の同期は構成とワークロードに依存する。

## 4. 実装例：CloudCore と EdgeCore の配置

管理側 Kubernetes と現場端末を接続する例。クラウド事業者は固定しない。

| 機能 | 担い手 |
|---|---|
| クラスタ管理 API | Kubernetes API |
| 管理側ゲートウェイ | KubeEdge CloudCore / CloudHub |
| エッジ実行基盤 | KubeEdge EdgeCore / EdgeHub |
| 現場の処理 | エッジワークロード |
| 現場デバイス | 現場デバイス |

この例では管理側の Kubernetes ホスト群と現場エッジ端末を分ける。利用者が Kubernetes、CloudCore、EdgeCore、端末、接続と認証を運用し、権限に応じて Kubernetes API を操作する。管理側はクラウド事業者を仮定しない。複数資料を組み合わせた未検証の例であり、実在の導入例ではない。

[CloudHub](https://kubeedge.io/docs/architecture/cloud/cloudhub/)、[EdgeHub](https://kubeedge.io/docs/architecture/edge/edgehub/)。

## 5. 実装例：自主管理 Kubernetes と Ubuntu EdgeCore

管理区画の Ubuntu Kubernetes クラスタに `keadm init` で CloudCore を配置する。現場の Ubuntu ホストは containerd を用意して `keadm join` で参加させ、EdgeCore を systemd サービスとして起動する。管理側と現場側の KubeEdge は同じリリースを使い、対応する Kubernetes バージョンを選ぶ。

| 機能配置 | 実装での担い手 |
|---|---|
| クラスタ管理 | Kubernetes API Server と管理側 etcd |
| 管理側の接続 | CloudCore Pod の CloudHub |
| 端末の接続と実行 | EdgeCore の EdgeHub・edged と containerd |
| 端末メタデータ | MetaManager がローカルディスクの SQLite に保存 |
| 現場の観測処理 | 端末に配置する Pod と現場 LAN のデバイス |

この例は TLS WebSocket を選び、端末から管理側の CloudHub に接続する。Keadm の既定では CloudCore の TCP 10000 と証明書取得用の TCP 10002 を端末から到達できるようにし、参加認証を設定する。SQLite が持つ端末メタデータと、アプリが保存・再送すべき観測データは用途が異なる。切断中の実行は、同期済みの設定、ローカルのイメージや依存先が利用できることを前提とする。

管理側と現場側は別の物理区画で、CloudCore と API は管理側の Kubernetes、EdgeCore と containerd は現場端末上にある。利用者がホスト、Kubernetes、KubeEdge、接続認証とワークロードを管理する。Keadm 自体は Kubernetes やコンテナランタイムを導入しない。複数の公式資料を組み合わせた未検証の代表構成であり、実在の導入例ではない。ネットワーク、認証、機器プロトコルと対応バージョンは導入時に検証する。

- [Installing KubeEdge with Keadm](https://kubeedge.io/docs/setup/install-with-keadm/)
- [KubeEdge container runtime](https://kubeedge.io/docs/setup/prerequisites/runtime/)
- [KubeEdge EdgeHub](https://kubeedge.io/docs/architecture/edge/edgehub/)
- [KubeEdge MetaManager](https://kubeedge.io/docs/architecture/edge/metamanager/)
- [KubeEdge Edged](https://kubeedge.io/docs/architecture/edge/edged/)
- [Kubernetes control plane and etcd](https://kubernetes.io/docs/concepts/architecture/)
