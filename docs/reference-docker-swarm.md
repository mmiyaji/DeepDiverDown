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
