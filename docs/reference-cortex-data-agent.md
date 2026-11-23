# Snowflake Cortex Agents の分析と文書検索

## 1. 対象

指標と文書を利用して質問に答える構成例。利用者の権限と検索結果の範囲を確認する。

## 2. 機能配置

利用者が質問し、エージェントが権限を確認する。指標ツールは分析データを問い合わせ、文書検索は関連文書と出典を返す。実行を記録し、担当者が結果を評価する。認証連携とアクセス権は採用環境に合わせて実装する。

## 3. 実装例

各機能の担い手を示す。実行履歴の記録範囲と保持方針を設定する。

| 機能 | 担い手 |
|---|---|
| 利用者 | 利用者 |
| Cortex Agent | Cortex Agent |
| 利用者の権限 | 利用者の権限 |
| Cortex Analyst | Cortex Analyst |
| Snowflake の分析テーブル | Snowflake の分析テーブル |
| Cortex Search | Cortex Search |
| 検索対象の文書 | 検索対象の文書 |
| 実行の観測 | 実行の観測 |
| 評価担当 | 評価担当 |

公式資料 [資料1](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents)・[資料2](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-agents)。
