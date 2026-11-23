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

[MCP Toolbox introduction](https://googleapis.github.io/mcp-toolbox/)、[MCP Toolbox repository](https://github.com/googleapis/mcp-toolbox)。
