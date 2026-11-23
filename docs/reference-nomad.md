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

## 6. 実装例：AWS（Nomad と Consul on EC2）
自己管理の Nomad server と複数の client VM に、注文 API を Docker コンテナとして段階展開する例。

| 機能配置 | この例での担い手 |
|---|---|
| 注文 API ジョブ | 注文 API の Nomad jobspec |
| 配置の再評価と決定 | 3 AZ に配置した EC2 上の Nomad server 群 |
| クライアントへの作業割当と更新管理 | EC2 上の Nomad server 群 |
| 実行ノード | EC2 上の Nomad client と Docker driver |
| イメージの配布 | Amazon ECR |
| 制御状態の永続化 | Nomad server のデータディレクトリを置く専用 EBS |

- **Consul サービス登録とヘルスチェック**。HTTP ヘルスチェックの判定をローリング更新に使う。

更新並列数とヘルス条件は jobspec で定義する。タスクの配置可否は Docker driver の起動条件と各 VM の容量にも依存する。

同じリージョン・VPC の別々の 3 AZ に Nomad server を1台ずつ配置する。各 Nomad client は同一ホスト上の Consul agent にサービスと HTTP チェックを登録する。Consul server 群が登録情報を管理し、Nomad はチェック結果を更新の判定に使う。Docker はクライアントの IAM 権限と ECR Credential Helper を用いて、jobspec で指定されたイメージを取得する。Nomad、Consul、Docker の更新とクラスタの状態は運用者が管理する。

利用者は EC2 のゲスト OS、Nomad、Consul、Docker と jobspec を管理し、Nomad API や CLI でジョブを投入する。AWS は EC2・EBS・ECR のサービス基盤を運用するが、利用者はインスタンスの OS 更新、EBS データとバックアップ、ECR のイメージ・IAM 権限を管理する。ECR は VPC 内の Nomad クラスタではなく独立したサービスである。

この例は複数の公式資料を組み合わせた代表構成であり、実在の導入例や動作検証済み構成ではない。ネットワーク経路、Credential Helper の設定、権限、Consul と Nomad の対応バージョンを導入時に検証する。

公式資料
- [Security in Amazon EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security.html)
- [Nomad rolling updates](https://developer.hashicorp.com/nomad/docs/job-declare/strategy/rolling)
- [Nomad scheduling](https://developer.hashicorp.com/nomad/docs/concepts/scheduling/how-scheduling-works)
- [Docker task driver](https://developer.hashicorp.com/nomad/docs/drivers/docker)
- [Nomad の本番リファレンス構成](https://developer.hashicorp.com/nomad/docs/deploy/production/reference-architecture)
- [Nomad のディスク要件](https://developer.hashicorp.com/nomad/docs/deploy/production/requirements)
- [Nomad と Consul の統合](https://developer.hashicorp.com/nomad/docs/networking/consul)
- [Amazon ECR の認証](https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html)
- [Amazon EBS ボリュームのアタッチ](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-attaching-volume.html)
