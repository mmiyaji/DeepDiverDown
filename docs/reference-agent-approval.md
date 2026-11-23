# AI エージェントの承認・再開と観測

## 1. 対象

エージェントが業務システムの更新を提案し、人が対象と操作を確認してから実行する例。状態の保存、再開、外部操作と観測の責務を分ける。

## 2. 機能配置と処理

依頼を受けたエージェントは更新の対象と引数を提示し、承認待ちの状態を保存する。承認者が確認した結果を受け取り、実行主体の権限と対象を確認して更新ツールを呼び出す。トレースで実行と結果を確認する。却下時は外部更新を行わない。

## 3. 再試行と観測

承認済みの対象が変更された場合は再確認する。再開や再試行で外部操作が重複しないよう、操作ごとに重複防止キーと実行結果を管理する。記録する引数や結果の内容、機微情報の扱い、保持期間を決める。

## 4. 実装例：LangGraph と OpenTelemetry

LangGraph の interrupt は実行を停止し、チェックポインターを使って状態を保存する。再開には同じ thread ID と再開値を使う。再開時には中断したノードの先頭から実行されるため、副作用を伴う処理は再実行を考慮する。

| 機能 | 担い手の例 |
|---|---|
| 依頼と実行 | 利用者画面、LangGraph のグラフ |
| 承認 | 承認画面と担当者 |
| 状態保存 | チェックポインターと永続ストア |
| 外部更新 | 認可された更新ツール、業務システム、重複防止キー |
| 観測と評価 | OpenTelemetry のトレース基盤、評価担当者 |

構成例の認証、承認画面、更新先は採用環境で実装する。参考資料 [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)、[durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution)、[OpenTelemetry](https://opentelemetry.io/blog/2026/genai-observability/)。
