# RKE2 の基本アーキテクチャ

## 1. クラスターの役割

RKE2 は Kubernetes のディストリビューションで、ノードの役割に応じて Kubernetes のコンポーネントを起動・監視する。図では固定登録アドレスを持つ構成を例にし、RKE2 Server と Agent の役割を分ける。Rancher Manager は複数クラスターの管理を担う別の製品で、この経路で Pod を配置するのは Kubernetes のスケジューラーである。

## 2. 固定登録アドレスと制御プレーン

Agent は固定アドレスを通じて Server に登録し、kubelet は Agent のクライアント側負荷分散を介して API に接続する。Server 側の Kubernetes API、コントローラー、スケジューラーが希望状態を扱い、etcd にクラスターの状態を保持する。図の Server と etcd は論理的な役割を表す。

## 3. Agent で注文 API を起動

Deployment が注文 API の Pod を用意し、スケジューラーが配置条件を満たすノードを選ぶ。選ばれた Agent の kubelet と containerd が Pod のコンテナを起動する。Agent からのハートビートが途絶えた場合、制御プレーンが Node の状態を監視する。別の適格なノードと利用可能な制御プレーンがあれば、コントローラーが不足分の Pod を作り、再配置できる。

## 公式資料

- [RKE2 · Architecture](https://docs.rke2.io/architecture)
- [RKE2 · High Availability](https://docs.rke2.io/install/ha)
- [SUSE Rancher Manager · Rancher Architecture](https://ranchermanager.docs.rancher.com/reference-guides/rancher-manager-architecture/)
- [Kubernetes · Node heartbeats](https://kubernetes.io/docs/concepts/architecture/nodes/#node-heartbeats)

## 4. 実装例：RKE2 の高可用性構成
データセンター内の仮想マシンに 3 台の server と agent を配備し、外部ロードバランサーで登録先を固定する例。

| 機能配置 | この例での担い手 |
|---|---|
| デプロイ担当 | kubectl を使う運用端末 |
| 固定登録アドレス | 外部 L4 ロードバランサー |
| クラスタ制御部・API | rke2-server VM × 3 |
| クラスタ状態ストア | rke2-server VM × 3 |
| ノード参加・実行エージェント | rke2-agent VM |
| 注文 API の実行単位 | 注文 API Deployment / Pod |

- **ノード登録トークン**。同じクラスターへ agent を参加させるため、登録時にトークンを渡す。

TLS の SAN に固定アドレスを含める。トークンは秘密情報として扱う。RKE2 の構成自体は Rancher Manager なしでも成立する。

公式資料
- [RKE2 High Availability](https://docs.rke2.io/install/ha)
- [RKE2 Architecture](https://docs.rke2.io/architecture)
