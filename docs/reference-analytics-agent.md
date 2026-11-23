# 指標と文書を使う分析エージェント

## 1. 対象

売上と返品率を集計し、返品理由の文書を探して、数値と出典を添えて回答する構成例。利用者の権限、指標の定義、検索結果の範囲を確認する。

## 2. 機能配置と処理

利用者の質問を受けたエージェントが認証・権限を確認する。指標の定義と問合せは分析用データを集計し、文書の検索は索引から関連する文書と出典を返す。エージェントは対象期間と出典を回答に添え、実行履歴を観測する。評価担当者は数値、出典、アクセス制御、失敗時の結果を確認する。

dbt Semantic Layer は指標の定義と問合せの仕組みを提供する。文書検索は別の検索ツールで行う。アクセス制御とユーザー識別は、両方のツールへ渡す方法を採用環境に合わせて設計する。

## 3. 評価と運用

集計期間、指標定義と数値の整合性、検索結果の関連性、利用者が参照できる資料だけを回答に含めたかを評価する。検索結果に記載された内容は外部データとして扱い、指示として無条件に実行しない。実行記録には質問や検索結果が含まれる場合があるため、記録範囲と保持期間を定める。外部操作を伴う場合は、実行主体、承認、再試行時の重複を設計する。

## 4. 実装例：dbt と Databricks の組み合わせ

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
