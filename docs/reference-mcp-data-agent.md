# MCP を使うデータ分析エージェント

## 1. 対象

指標と文書を利用して質問に答える構成例。利用者の権限と検索結果の範囲を確認する。

## 2. 機能配置

利用者が質問し、エージェントが権限を確認する。指標ツールは分析データを問い合わせ、文書検索は関連文書と出典を返す。実行を記録し、担当者が結果を評価する。認証連携とアクセス権は採用環境に合わせて実装する。

## 3. 実装例

各機能の担い手を示す。実行履歴の記録範囲と保持方針を設定する。

| 機能 | 担い手 |
|---|---|
| 利用者 | 利用者 |
| MCP クライアント | MCP クライアント |
| 認可サーバー | 認可サーバー |
| 指標ツール | 指標ツール |
| 分析データ | 分析データ |
| 文書検索ツール | 文書検索ツール |
| 文書データ | 文書データ |
| 実行トレース | 実行トレース |
| 運用担当 | 運用担当 |

この例は利用者が MCP ホストとツール実行基盤を別々に管理し、認可、ツール権限、データと観測先を設定する。外部 LLM API を使う想定だが、モデルと提供元、データ保存先の製品・配置は未選定である。複数の公式資料を組み合わせた未検証の代表構成で、認証・認可とデータ範囲は導入時に検証する。

公式資料 [資料1](https://modelcontextprotocol.io/docs/learn/architecture)・[資料2](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)。


## 4. 実装例：ECS on Fargate の MCP クライアントと読取ツール

ECS on Fargate で MCP ホストと2つの読取専用 MCP サーバーを運用する。Bedrock が回答を組み立て、検索と指標の取得はホストが実行する。

| 機能 | 担い手 |
| --- | --- |
| MCP クライアントと LLM | Fargate 上のホスト。Bedrock のツール提案を検証し、サーバーへ MCP 要求を発行する。 |
| 認可 | Cognito の事前登録済み OAuth クライアントとリソース別スコープ。MCP サーバーが JWT を検証する。 |
| 指標 | 専用 Fargate タスクが Athena の固定ワークグループで許可した集計を取得する。 |
| 検索 | 別の Fargate タスクが、RDS PostgreSQL の文書を検索する。 |
| 観測 | CloudWatch Logs へ判定と実行結果を送る。 |

AWS が Fargate、Bedrock、Athena、RDS 等の基盤を運用し、利用者はエージェントと各ツールのコード、タスク、認証・認可、データとログを管理する。ホスト・指標・検索は別 Fargate タスクで、基盤ホストへの直接アクセスは仮定しない。複数の公式資料を組み合わせた未検証の代表構成であり、トークンの audience、認証連携、権限とサービス間接続は導入時に検証する。

各 MCP サーバーに Protected Resource Metadata を公開し、クライアントは認可コードと PKCE を使って対象サーバーの URI を指定する。サーバーは発行者、署名、有効期限、対象サーバーを示す aud、ツールのスコープを検証し、利用者ごとのデータ範囲をサーバー側で判定する。下流 AWS API の呼び出しにはツールごとの IAM タスクロールを使う。JWT を下流へ転送せず、SQL とクエリ結果の S3 領域もサーバー側で制限する。モデルへの入力から資格情報と不要な本文を除き、CloudWatch ログに含める項目と Bedrock のモデル呼び出しログ設定を確認する。

公式資料

- [Fargate security](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-security-considerations.html)
- [MCP の HTTP 認可仕様](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [Cognito のスコープとリソースバインディング](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-define-resource-servers.html)
- [Bedrock のクライアント側ツール利用](https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use-client-side.html)
- [Athena のワークグループ](https://docs.aws.amazon.com/athena/latest/ug/workgroups-manage-queries-control-costs.html)
- [PostgreSQL の全文検索](https://www.postgresql.org/docs/current/functions-textsearch.html)
- [Bedrock モデル呼び出しのログ設定](https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html)
