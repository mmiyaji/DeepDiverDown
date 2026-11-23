# RisingWave のストリーミング SQL

## 1. 対象

イベントを継続的に取り込み、SQL の結果と状態を更新して提供する。

## 2. 機能配置と処理

イベントをストリームから取り込み、SQL で継続的に処理する。実体化ビューを更新し、利用者が問い合わせる。処理状態は永続ストレージを利用する。

## 3. 設計上の注意

イベント時刻、遅延、再処理、保存期間、ソース・出力先の対応、運用負荷を確認する。

## 4. 実装例

Kafka のストリームから RisingWave が実体化ビューを更新し、SQL クライアントが問い合わせる自己運用例。オブジェクトストレージは S3 互換であり提供元は指定しない。

| 機能 | 担い手 |
|---|---|
| イベントの入力 | Kafka トピック |
| 継続的な SQL 処理 | RisingWave ストリーム処理 |
| 更新されるビュー | RisingWave 実体化ビュー |
| 分析クライアント | SQL クライアント |
| 処理状態の保存 | S3 互換オブジェクトストレージ |

利用者が RisingWave の実行ホスト、メタストアと処理設定を管理する。例では PostgreSQL をメタストアとして選び、Kafka と S3 互換ストレージの提供元・実行場所は未選定とする。S3 互換は Amazon S3 を意味しない。公式資料を組み合わせた未検証の例で、接続と復旧を導入時に検証する。

[RisingWave Helm chart values](https://raw.githubusercontent.com/risingwavelabs/helm-charts/main/charts/risingwave/values.yaml)、[RisingWave](https://github.com/risingwavelabs/risingwave)、[RisingWave documentation](https://docs.risingwave.com/)。

## 5. 実装例：AWS の EKS・Amazon MSK・S3・RDS

公式 Helm チャートで RisingWave の Frontend、Compute、Meta、Compactor を Amazon EKS に配置する。Kafka の入力には Amazon MSK、Hummock の状態ストアには Amazon S3、Meta の PostgreSQL メタストアには RDS for PostgreSQL を使う。Helm の `stateStore` と `metaStore.postgresql` でそれぞれの接続先を指定する。

| 機能配置 | 実装での担い手 |
|---|---|
| イベントの入力 | Amazon MSK の Kafka トピック |
| 継続的な SQL 処理 | EKS の EC2 ノード上の RisingWave Compute |
| 更新されるビュー | Compute が維持する Hummock 上の実体化ビュー |
| 分析クライアント | SQL クライアントと RisingWave Frontend |
| 処理状態の保存 | Amazon S3 上の Hummock |
| クラスタ管理とメタデータ | RisingWave Meta と RDS for PostgreSQL。Compactor が S3 の SST を整理する |

EKS の制御プレーンは AWS 管理 VPC にあり、利用者は Kubernetes API と公開設定を操作できるが、サーバーへ直接アクセスしない。MSK、S3、RDS は EKS クラスタ外の独立サービスである。AWS がサービス基盤を運用し、利用者がデータ、認証と設定を管理する。複数の資料を組み合わせた未検証の例で、対応版とネットワーク、復旧を導入時に確認する。

MSK に合わせた認証とネットワーク接続を設定する。RDS に保存するのは RisingWave の管理メタデータで、実体化ビューの行は Hummock が管理する。AWS は Kubernetes と各マネージドサービスを提供し、Apache-2.0 の RisingWave の更新・設定・復旧は運用者が管理する。

- [EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)
- [RisingWave Helm deployment guide](https://risingwave.com/blog/streaming-database-kubernetes-deployment-guide/)
- [RisingWave Helm chart values](https://raw.githubusercontent.com/risingwavelabs/helm-charts/main/charts/risingwave/values.yaml)
- [RisingWave architecture design](https://risingwavelabs.github.io/risingwave/design/architecture-design.html)
- [RisingWave Kafka source and MSK](https://github.com/risingwavelabs/risingwave-docs/blob/main/integrations/sources/kafka.mdx)
- [RisingWave license](https://github.com/risingwavelabs/risingwave/blob/main/LICENSE)
- [EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
