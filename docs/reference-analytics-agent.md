# 指標と文書を使う分析エージェント

## 1. 対象

売上と返品率を集計し、返品理由の文書を探して、数値と出典を添えて回答する構成例。利用者の権限、指標の定義、検索結果の範囲を確認する。

## 2. 機能配置と処理

利用者の質問を受けたエージェントが認証・権限を確認する。指標の定義と問合せは分析用データを集計し、文書の検索は索引から関連する文書と出典を返す。エージェントは対象期間と出典を回答に添え、実行履歴を観測する。評価担当者は数値、出典、アクセス制御、失敗時の結果を確認する。

dbt Semantic Layer は指標の定義と問合せの仕組みを提供する。文書検索は別の検索ツールで行う。アクセス制御とユーザー識別は、両方のツールへ渡す方法を採用環境に合わせて設計する。

## 3. 評価と運用

集計期間、指標定義と数値の整合性、検索結果の関連性、利用者が参照できる資料だけを回答に含めたかを評価する。検索結果に記載された内容は外部データとして扱い、指示として無条件に実行しない。実行記録には質問や検索結果が含まれる場合があるため、記録範囲と保持期間を定める。外部操作を伴う場合は、実行主体、承認、再試行時の重複を設計する。

## 4. 実装例：ECS 上のエージェント・dbt・Databricks

異なるサービスを組み合わせる概念例。エージェントアプリが dbt Semantic Layer に指標を問い合わせ、Databricks AI Search の検索ツールを呼び出す。認証、認可、ネットワーク、サービス間の実装は採用環境に合わせて構成する。

| 機能 | 担い手の例 |
|---|---|
| 質問と回答 | 利用者の分析画面、エージェント実行アプリ |
| 利用者とツールの権限 | アプリの認証と権限 |
| 指標とデータ | dbt Semantic Layer、分析ウェアハウス |
| 文書検索 | Databricks AI Search ツール、AI Search インデックス、文書を格納する Delta テーブル |
| 実行の観測と評価 | OpenTelemetry Collector・追跡基盤、評価担当者 |
| 記録の管理 | ログの記録・保持方針 |

参考資料 [dbt Semantic Layer](https://docs.getdbt.com/docs/use-dbt-semantic-layer/dbt-sl)、[Databricks のエージェント検索ツール](https://docs.databricks.com/gcp/en/agents/custom-agents/unstructured-retrieval-tools)、[AI Search の索引](https://docs.databricks.com/aws/en/ai-search/ai-search)、[OpenTelemetry の AI エージェント観測](https://opentelemetry.io/blog/2025/ai-agent-observability/)。


### 具体的な実行基盤

AWS の ECS/Fargate タスクに自作エージェントと OpenTelemetry Collector のサイドカーを配置し、Collector から設定したテレメトリーを CloudWatch に送る。利用者のログインには Cognito User Pool を使う例だが、トークンの検証と利用者の認可はアプリで行う。dbt Semantic Layer は Databricks SQL Warehouse に指標クエリを発行し、Databricks AI Search は Delta テーブルから構築したインデックスを検索する。dbt と Databricks のアカウント、トークン、接続と権限は個別に構成する。

| 機能 | 実装上の配置 |
| --- | --- |
| エージェント実行 | Amazon ECS の Fargate タスク内の自作アプリ |
| ログイン | Amazon Cognito User Pool とアプリでの認可 |
| 指標クエリ | dbt Semantic Layer と Databricks SQL Warehouse |
| 注文・返品 | Databricks 上の Delta テーブル |
| 文書検索 | Databricks AI Search と索引元の Delta テーブル |
| 観測 | ECS サイドカーの OpenTelemetry Collector と CloudWatch |

AWS が ECS と Fargate の基盤を運用し、利用者はタスク定義、アプリ、収集設定、認証情報と権限を管理する。Fargate の基盤ホストには利用者は直接接続できない。dbt platform と Databricks は AWS アカウントとは別のサービス境界として扱い、各アカウントで設定とアクセスを管理する。複数の公式資料を組み合わせた代表構成で、本リポジトリではサービス間の接続・認可や動作を検証していない。

利用者の権限が dbt と Databricks に自動伝播するわけではない。認証方式、委任、サービス間接続、ログに含む質問や結果のマスキングと保持期間、評価を実装・検証する。生成モデルの選定や呼び出し先は図の対象外であり、特定のモデルサービスを仮定しない。

[dbt Semantic Layer 対応プラットフォーム](https://docs.getdbt.com/guides/sl-qs)、[Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools.html)、[CloudWatch OpenTelemetry](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/GettingSetup.html)、[ECS Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)、[Fargate security](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-security-considerations.html)。
