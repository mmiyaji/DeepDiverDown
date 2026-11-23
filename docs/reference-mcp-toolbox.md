# MCP Toolbox for Databases

## 1. 対象

エージェントから定義済みツールを通してデータベースへ安全にアクセスする。

## 2. 機能配置と処理

MCP クライアントがツールを発見・呼び出し、サーバーが設定された接続先と問い合わせを使って結果を返す。ツール設定とデータベースを分けて管理する。

## 3. 設計上の注意

アクセス権は DB とツールの設定に依存する。読み取り専用化、認証、許可する SQL、機密情報とクエリ負荷を明示する。

## 4. 実装例

MCP Toolbox のカスタムツールを PostgreSQL に接続し、MCP クライアントから問い合わせる自己運用例。クラウドサービスを前提にしない。

| 機能 | 担い手 |
|---|---|
| エージェント / MCP クライアント | エージェント / MCP クライアント |
| MCP ツールサーバー | MCP Toolbox |
| データベース | PostgreSQL |
| 問い合わせ結果 | 問い合わせ結果 |
| 接続・ツール定義 | Toolbox 設定 |
| ツール管理者 | ツール管理者 |

この例では利用者が Toolbox と PostgreSQL を別のホストで運用し、SQL 定義、認証、DB データとバックアップを管理する。MCP クライアントの実行先や AI モデルの提供元は未指定である。公式資料を組み合わせた未検証の例であり、DB 権限と通信を導入時に確認する。

[MCP Toolbox introduction](https://googleapis.github.io/mcp-toolbox/)、[MCP Toolbox repository](https://github.com/googleapis/mcp-toolbox)。

## 5. 実装例：Google Cloud の Cloud Run・Cloud SQL

Apache-2.0 の MCP Toolbox コンテナを同じ Google Cloud プロジェクトの Cloud Run に配置し、Cloud SQL for PostgreSQL の読み取りツールを提供する。この例は Toolbox v1.16 の構成形式を使う。

| 機能配置 | 実装での担い手 |
|---|---|
| エージェント・クライアント | Cloud Run の呼び出し権限を持つ MCP クライアント |
| MCP サーバー | Cloud Run に配置した Toolbox コンテナ |
| データベース | Cloud SQL for PostgreSQL |
| 問い合わせ結果 | MCP 応答を受け取るクライアント |
| 接続・ツール定義 | Secret Manager からファイルとしてマウントした `tools.yaml` |
| ツール管理者 | 設定ファイルと Cloud Run のリビジョンを管理する運用者 |

Google が Cloud Run・Cloud SQL・Secret Manager の基盤を運用する。利用者はサービスとリビジョン、実行 ID、シークレット、DB ユーザーとデータを設定・管理する。モデル API はこの構成では指定していない。複数の公式資料を組み合わせた未検証の例で、権限、プライベート接続と対応版を導入時に検証する。

Toolbox の `cloud-sql-postgres` ソースは Go Connector で暗号化接続を開く。Cloud Run の実行サービスアカウントには対象のシークレットを読める権限と Cloud SQL 接続権限を付与し、DB へのログイン権限と表の読み取り権限を設定する。プライベート IP を使う場合は Cloud Run から対象 VPC へ接続する。Google Cloud がコンテナ実行と DB 基盤を管理し、運用者が公開するツールの SQL、入力パラメータ、DB 権限、コンテナの更新を管理する。

- [MCP Toolbox v1.16 — Cloud Run](https://mcp-toolbox.dev/v1.16.0/documentation/deploy-to/cloud-run/)
- [MCP Toolbox v1.16 — Cloud SQL for PostgreSQL Source](https://mcp-toolbox.dev/v1.16.0/integrations/cloud-sql-pg/source/)
- [Cloud SQL connections from Cloud Run](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud Run secrets](https://cloud.google.com/run/docs/configuring/services/secrets)
- [MCP Toolbox license](https://github.com/googleapis/mcp-toolbox/blob/main/LICENSE)
