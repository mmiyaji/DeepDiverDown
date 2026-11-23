# Snowflake Cortex Agents の分析と文書検索

## 1. 対象

指標と文書を利用して質問に答える構成例。利用者の権限と検索結果の範囲を確認する。

## 2. 機能配置

利用者が質問し、エージェントが権限を確認する。指標ツールは分析データを問い合わせ、文書検索は関連文書と出典を返す。実行を記録し、担当者が結果を評価する。認証連携とアクセス権は採用環境に合わせて実装する。

## 3. 実装例

Snowsight から Cortex Agent に売上と関連文書を尋ねる例。モデル実行とツールの調整は Snowflake の Cortex Agent が担う。

| 機能 | 担い手 |
|---|---|
| 利用者と認可 | Snowsight の認証済みセッションと Snowflake ロール。Agent、Analyst、Search、Warehouse に必要な権限を付与する。 |
| 指標の取得 | Cortex Analyst が売上の Semantic View から SQL を生成し、設定した Virtual Warehouse から Snowflake の分析テーブルを参照する。 |
| 文書検索 | Cortex Search が公開範囲を限定した Snowflake テーブルを索引化する。索引の元クエリの実行には Search 用 Warehouse を使う。 |
| 実行の観測 | AI_OBSERVABILITY_EVENTS に記録されたイベントを監視権限のある評価担当が確認する。 |

Snowflake が Cortex Agent、Search、Warehouse とデータサービスの基盤を運用し、利用者は Agent の設定、Semantic View、文書の公開範囲、ロールと権限、監視設定を管理する。公開されないモデル実行基盤や外部 LLM の配置は仮定しない。複数の公式資料を組み合わせた未検証の代表例であり、対象リージョン・権限・モデルと検索結果を導入時に検証する。

Agent を呼ぶロールに Agent と各ツールの利用に必要な権限を付与する。Cortex Analyst の SQL にはセッションロールの権限が適用される。ここで使う通常の Cortex Search は所有者権限で検索するため、Search の利用を許可されたロールが検索できる文書の範囲を、索引の入力と Search サービスへの権限で限定する。Agent の監視データからは、ログに含まれる利用者の質問やツール応答が参照され得る。マスキング前のイベントを読める権限は承認した監査用途に絞る。

- [Cortex Agent のツール設定](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-manage)
- [Cortex Agent の認証と権限](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-setup)
- [Cortex Search の所有者権限](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/query-cortex-search-service)
- [Cortex Agent のリクエスト監視](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-monitor)

公式資料 [資料1](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents)・[資料2](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-agents)。
