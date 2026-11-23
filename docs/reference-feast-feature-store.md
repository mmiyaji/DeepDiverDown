# Feast の特徴量ストアとオンライン推論

## 1. 対象

注文履歴から特徴量を作り、モデルの学習と注文時の推論で使う構成例。特徴量の時点と鮮度を追う。

## 2. 処理

特徴量の生成処理が注文履歴を整備する。特徴量の定義を登録し、履歴の特徴量から学習データを取得する。学習データは対象の過去時点に対応した値を使う。反映ジョブが特徴量をオンラインストアに書き、注文アプリの要求に応じて推論サービスがエンティティの最新値を取得する。モデルの配備は外部のモデルサーバーが担う。

## 3. 運用

学習時に予測対象の未来情報を混ぜない。オンライン特徴量の更新遅延、欠損、定義の版、モデルと特徴量の組み合わせを確認する。利用者の権限、推論の遅延、更新失敗後の再実行も設計する。

## 4. 実装例：Feast とモデルサーバー

Feast のレジストリ、オフラインストア、materialize ジョブ、オンラインストアと外部のモデルサーバーを組み合わせる例。実際のストアと実行基盤は採用環境に合わせて選ぶ。

| 機能 | 担い手 |
|---|---|
| 履歴と生成 | 注文履歴のバッチデータ、Spark / SQL |
| 特徴量の定義と学習 | Feast レジストリ、学習パイプライン |
| オンラインへの反映 | Feast materialize ジョブ |
| 特徴量の提供 | Feast オンラインストアと Feature Server |
| 推論 | 特徴量取得とモデルサーバー、注文アプリ |

利用者が Feast ジョブ、特徴量定義、学習・推論処理を実行する基盤と、オンライン・オフラインストアを選定し管理する。各製品、提供元、保存場所は未選定で、特定クラウドを仮定しない。公式資料を組み合わせた未検証の代表例で、時点結合、権限と復旧を導入時に確認する。

公式資料 [Feast の構成要素](https://docs.feast.dev/master/getting-started/components/overview)、[特徴量の提供と推論](https://docs.feast.dev/getting-started/architecture/model-inference)。


## 5. 実装例：Feast・Amazon Redshift・DynamoDB・SageMaker AI

Feast の履歴取得とオンライン参照を ECS on Fargate で実行し、Redshift と DynamoDB を使う。SageMaker AI がモデルの学習と推論を担う。

| 機能 | 担い手 |
| --- | --- |
| 特徴量の生成と履歴 | S3 の注文原本、Glue の Spark ETL、Redshift の履歴テーブル。 |
| 特徴量の定義 | S3 の Feast File Registry。 |
| 学習とモデル | ECS 上の Feast が Redshift で時点結合した結果を抽出して S3 に置き、SageMaker AI が学習する。 |
| オンライン反映と推論 | Feast が DynamoDB に最新値を反映する。推論 API がキーで最新値を取得し、SageMaker AI へ渡す。 |

AWS が Fargate と各マネージドサービスの基盤を運用し、利用者が Feast の設定、タスクとモデル、データ、権限を管理する。履歴抽出、materialize、推論 API はそれぞれ別タスクまたはサービスであり、利用者は Fargate の基盤ホストに直接接続しない。複数の公式資料を組み合わせた未検証の代表構成で、サービスの対応版とネットワーク、ジョブ起動と復旧を導入時に検証する。

利用する Feast のリリースで Redshift、DynamoDB、S3 Registry の組み合わせを確認する。Redshift Offline Store の S3 ステージング、Glue の一時領域、学習データとモデル成果物は用途ごとに分ける。Feast を動かす ECS のタスクロールは、Registry の参照、履歴抽出、オンライン反映、推論の処理ごとに分ける。Redshift・Glue・SageMaker AI にも、それぞれが使う S3 の領域を許可する。

公式資料

- [Fargate security](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-security-considerations.html)
- [Feast の AWS プロバイダー](https://docs.feast.dev/reference/providers/amazon-web-services)
- [Feast Redshift Offline Store](https://docs.feast.dev/reference/offline-stores/redshift)
- [Feast DynamoDB Online Store](https://docs.feast.dev/v0.58-branch/reference/online-stores/dynamodb)
- [Feast Registry](https://docs.feast.dev/v0.28-branch/getting-started/concepts/registry)
- [AWS Glue と Redshift の接続](https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-etl-connect-redshift-home.html)
- [SageMaker AI の学習データ](https://docs.aws.amazon.com/sagemaker/latest/dg/model-access-training-data.html)
- [SageMaker AI のリアルタイム推論](https://docs.aws.amazon.com/sagemaker/latest/dg/realtime-endpoints-test-endpoints.html)
- [ECS スタンドアロンタスク](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/standalone-tasks.html)
