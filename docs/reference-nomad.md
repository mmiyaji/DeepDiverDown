# Nomad のジョブスケジューリング

## 1. ジョブとクライアント

Nomad のジョブは、どのノードで実行するかではなく、実行したいタスク群を宣言する。クライアントは利用可能な計算資源を持つマシン上でタスクを実行・管理する。

出典 [How Nomad job scheduling works](https://developer.hashicorp.com/nomad/docs/concepts/scheduling/how-scheduling-works)・[Glossary](https://developer.hashicorp.com/nomad/docs/glossary)

## 2. 評価とアロケーション

望ましい状態または実際の状態が変わると Evaluation が作られる。スケジューラーは評価を処理し、タスクグループとクライアントノードの対応を Allocation として計画する。Allocation は「どのノードでタスク群を実行するか」を表し、サービススケジューラーが望ましい状態とのずれを調整する。

出典 [How Nomad job scheduling works](https://developer.hashicorp.com/nomad/docs/concepts/scheduling/how-scheduling-works)・[Glossary](https://developer.hashicorp.com/nomad/docs/glossary)

## 3. 注文 API のデプロイ

service ジョブに注文 API の task group と count を定義して登録する。スケジューラーはまず制約、データセンター、ドライバー、ノードの健全性で実行可能なノードを絞り、次に bin packing、affinity、anti-affinity で順位付けする。最上位のノードが Allocation plan に追加される。

出典 [How Nomad job scheduling works](https://developer.hashicorp.com/nomad/docs/concepts/scheduling/how-scheduling-works)・[Advanced job scheduling](https://developer.hashicorp.com/nomad/docs/job-scheduling)

## 4. 失敗時の置き換え

既存 Allocation の停止・更新・移行や新規 Allocation の作成は、評価に対する scheduler の計画で決まる。サーバーが plan を処理して Allocation を作成し、クライアントがそれを受けて実行する。service ジョブの Deployment は update ブロックで許可した数ずつ変更を進め、健全性を監視して次の評価を発行する。

出典 [How Nomad job scheduling works](https://developer.hashicorp.com/nomad/docs/concepts/scheduling/how-scheduling-works)・[Glossary](https://developer.hashicorp.com/nomad/docs/glossary)

## 5. 配置方針の確認点

既定の scheduler は bin packing で資源利用率を高め、task group の複数インスタンスには自動 anti-affinity を適用して同一ノードへの集中を抑える。必要なら spread でデータセンター、ラック、ノード属性にまたがる分散を指定する。Allocation（割り当て）と scheduler（評価から計画を作る機構）は別の概念として扱う。

出典 [Advanced job scheduling](https://developer.hashicorp.com/nomad/docs/job-scheduling)

## 6. 実装例：Nomad の Docker ドライバーと Consul
自己管理の Nomad server と複数の client VM に、注文 API を Docker コンテナとして段階展開する例。

| 機能配置 | この例での担い手 |
|---|---|
| 注文 API ジョブ | 注文 API の Nomad jobspec |
| 配置の再評価 | Nomad server VM 群 |
| 配置先の決定 | Nomad server VM 群 |
| クライアントへの作業割当 | Nomad server VM 群 |
| 実行ノード | Nomad client VM 群の Docker driver |
| 更新の進行管理 | Nomad server VM 群 |

- **Consul サービス登録とヘルスチェック**。HTTP ヘルスチェックの判定をローリング更新に使う。

更新並列数とヘルス条件は jobspec で定義する。タスクの配置可否は Docker driver の起動条件と各 VM の容量にも依存する。

公式資料
- [Nomad rolling updates](https://developer.hashicorp.com/nomad/docs/job-declare/strategy/rolling)
- [Nomad scheduling](https://developer.hashicorp.com/nomad/docs/concepts/scheduling/how-scheduling-works)
- [Docker task driver](https://developer.hashicorp.com/nomad/docs/drivers/docker)
