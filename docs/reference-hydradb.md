# HydraDB のオブジェクトストレージ型グラフ

## 1. 対象

グラフの問い合わせと非同期インデックスを分け、状態をオブジェクトストレージに保持する。

## 2. 機能配置と処理

問い合わせノードはグラフの読み書きと問い合わせを受ける。インデクサーは保存されたデータからインデックスを生成し、オブジェクトストレージに公開する。

## 3. 設計上の注意

S3 互換ストレージを AWS の S3 と同一視しない。レイテンシ、整合性モード、障害復旧、運用成熟度とライセンスを確認する。

## 4. 実装例

HydraDB の graph-node と graph-indexer が S3 互換オブジェクトストレージを共有する自己運用の例。具体的なストレージ製品と配置先は固定しない。

| 機能 | 担い手 |
|---|---|
| グラフ利用者 | Bolt / HTTPS クライアント |
| 問い合わせと更新 | HydraDB graph-node |
| 永続データとログ | S3 互換オブジェクトストレージ |
| インデックス構築 | HydraDB graph-indexer |
| 探索用インデックス | 保存されたグラフ索引 |

利用者が graph-node と graph-indexer の実行ホストと設定を管理する。S3 互換ストレージの製品・提供元・実行場所は未選定であり、Amazon S3 や AWS 所属とは扱わない。複数資料を組み合わせた未検証の例で、互換性、認証、永続性と復旧は採用時に確認する。

[HydraDB architecture](https://github.com/hydra-db/hydradb/blob/main/architecture.md)、[HydraDB](https://github.com/hydra-db/hydradb)。

## 5. 実装例：AWS の EKS・HydraDB Helm・S3

公開 Helm チャートで EKS 上に `graph-node` と独立した `graph-indexer` を配置する。チャートが説明する AWS の IRSA 構成を使い、Pod のサービスアカウントに S3 へアクセスする IAM ロールを関連づける。Bolt / HTTPS の接続先と公開用 TLS を構成する。

| 機能配置 | 実装での担い手 |
|---|---|
| グラフ利用者・問い合わせと更新 | Bolt / HTTPS クライアントと EC2 ノード上の `graph-node` Pod |
| 永続データとログ | Amazon S3 のバケット内の SlateDB WAL、マニフェストと SST |
| インデックス構築と公開 | EC2 ノード上の `graph-indexer` Pod。Amazon S3 に CSC インデックス世代と現在の世代への参照を公開する |

EKS の制御プレーンは AWS 管理 VPC にあり、利用者は Kubernetes API と公開設定を操作できるがサーバーに直接アクセスしない。AWS は S3 基盤を運用し、利用者がデータ、バケット設定、権限と HydraDB を管理する。S3 と STS は EKS クラスタ外の独立サービスである。複数の公式資料を組み合わせた未検証の構成で、対象版・アクセス経路・復旧を導入時に検証する。

Pod のローカル領域はキャッシュや一時処理に使う。HydraDB は AGPL-3.0 で、AWS は Kubernetes・仮想マシン・オブジェクトストレージを提供する。チャートの存在は構成の根拠となる。対象バージョンの運用実績、重大障害からの復旧、SLA は採用前の別評価となる。

- [EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)
- [HydraDB Helm chart and AWS networking](https://github.com/hydra-db/hydradb/blob/main/charts/hydradb/README.md)
- [HydraDB architecture](https://github.com/hydra-db/hydradb/blob/main/architecture.md)
- [HydraDB AGPL-3.0 license](https://github.com/hydra-db/hydradb/blob/main/LICENSE)
- [Amazon EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [IAM roles for service accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
