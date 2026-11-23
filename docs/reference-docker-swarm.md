# Docker Swarm mode のサービススケジューリング

## 1. サービスと望ましい状態

Swarm mode ではサービス定義が望ましい状態になり、サービスにはイメージ、コマンド、ネットワーク、資源、更新方針、レプリカ数を指定する。manager のオーケストレーターがその状態を実現する。

出典 [How services work](https://docs.docker.com/engine/swarm/how-swarm-mode-works/services)・[Swarm mode](https://docs.docker.com/engine/swarm/)

## 2. タスク割り当てと scheduler

サービスをデプロイすると、オーケストレーターが task slot を作り、scheduler が各 task slot を埋めるノードを選ぶ。task は ASSIGNED、PREPARING、RUNNING などの状態を進み、container は task の実体である。これは service の desired state（レプリカ数）と、task をノードへ割り当てる scheduler を区別するモデルである。

出典 [How services work](https://docs.docker.com/engine/swarm/how-swarm-mode-works/services)

## 3. 注文 API のデプロイ

注文 API を replicated service として作成し、レプリカ数、ポート、overlay network、resource reservation、placement constraint を指定する。scheduler は条件を満たす worker に task を割り当てる。global service は条件に合う各ノードに 1 task なので、replicated の注文 API とは異なる。

出典 [Deploy services to a swarm](https://docs.docker.com/engine/swarm/services)

## 4. 障害時の置き換え

HTTP listener task が health check に失敗またはクラッシュすると、オーケストレーターは task と container を除き、desired state に従う新しい replica task を作る。ノードを drain すると scheduler は実行中 task を利用可能な worker へ再割り当てする。

出典 [How services work](https://docs.docker.com/engine/swarm/how-swarm-mode-works/services)・[Administer and maintain a swarm](https://docs.docker.com/engine/swarm/admin_guide/)

## 5. ローリング更新

service update の rolling update は scheduler が更新対象を指定された並列度で順に処理する。更新 task が RUNNING になれば次へ進み、失敗時は更新を一時停止できる。運用では replicas、placement constraints、UpdateConfig、障害時の再配置を確認する。

出典 [Apply rolling updates to a service](https://docs.docker.com/engine/swarm/swarm-tutorial/rolling-update)

## 6. 実装例：Docker Engine と routing mesh
Docker Engine の manager / worker VM 間で注文 API をローリング更新し、公開ポートから同じ名前で到達する例。

| 機能配置 | この例での担い手 |
|---|---|
| レプリカ数と設定の宣言 | docker service のサービス仕様 |
| 配置制御の入口 | Docker Engine の Swarm manager VM 3台 |
| 実行先の決定 | Raft で選ばれた Swarm manager のリーダー |
| 管理状態の永続化 | 各 manager の永続ディスク上の Docker データディレクトリ |
| コンテナの実行単位 | worker VM 上の注文 API Service タスク |
| コンテナ実行ノード | worker VM 上の Docker Engine |
| ローリング更新方針 | Service の UpdateConfig |

- **ingress routing mesh**。タスクの有無に関係なく到達したノードから、実行中のサービスのタスクへ接続を転送する。
- **コンテナレジストリ**。配備するイメージをノードから取得可能にする。

routing mesh を使う ingress 公開の例。host モードで公開する構成では転送経路が変わる。イメージが private の場合は必要な認証を用意する。

manager VM 3台を用意し、各ノードの Docker データディレクトリの `swarm` 以下に Raft の状態を保持する。通常運用で必要な過半数を維持し、復旧用のバックアップを別に保管する。注文 API はステートレスなタスクとして扱う。

利用者は VM、Docker Engine、manager と worker、Service 設定、アクセス権とバックアップを管理する。manager の Docker CLI または API から Service と更新設定を操作する。routing mesh はノードで公開ポートを受け、実行中のタスクへ送る。レジストリの提供先と運用主体は未指定であり、Swarm クラスタの外に示す。

複数の公式資料を組み合わせた代表構成であり、実在の導入例や動作検証済み構成ではない。worker 数、ネットワーク、レジストリ、イメージ認証とバックアップ先は導入時に決定する。

公式資料
- [Swarm services](https://docs.docker.com/engine/swarm/services/)
- [Swarm mode routing mesh](https://docs.docker.com/engine/swarm/ingress/)
- [Rolling updates](https://docs.docker.com/engine/swarm/swarm-tutorial/rolling-update/)
- [Docker Swarm manager の運用とバックアップ](https://docs.docker.com/engine/swarm/admin_guide/)
