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

利用者が LangGraph と更新ツールを実行するホスト、永続チェックポイント、承認画面、認証、外部更新の権限と観測先を管理する。永続ストアと業務システム・トレース基盤の製品や提供元は未選定。複数資料を組み合わせた未検証の代表例であり、構成例の認証、承認画面、更新先は採用環境で実装する。参考資料 [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)、[durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution)、[OpenTelemetry](https://opentelemetry.io/blog/2026/genai-observability/)。


## 5. 実装例：Step Functions・Lambda・Amazon Bedrock

Step Functions Standard ワークフローで変更案を保存し、担当者の承認を待つ。承認された案件だけを専用 Lambda で更新する。

| 機能 | 担い手 |
| --- | --- |
| 提案と承認待ち | AWS 管理の Step Functions Standard と Lambda。Bedrock を提案生成に使う。 |
| 承認者の識別と判定 | Cognito と API Gateway が JWT とルートのスコープを検証する。承認 API の Lambda が案件への権限と提案の版を照合する。 |
| 永続化と更新 | DynamoDB に承認状態を保持する。承認経路の更新 Lambda だけに案件テーブルの書き込み権限を付ける。 |
| 観測 | CloudWatch に相関 ID、判定、結果を記録する。 |

AWS は各サービスの基盤を運用し、利用者がワークフロー、Lambda のコード、Bedrock のモデル選択、アクセス権、テーブル、ログと承認画面を設定・管理する。Lambda の実行ホストや Bedrock の内部構成は公開された操作範囲を超えて仮定しない。複数の公式資料を組み合わせた未検証の代表構成であり、権限、期限切れ、再試行と復旧の動作を導入時に検証する。

タスクトークンはサーバー側だけで保管し、承認者には案件へのアクセスを許可した範囲で変更案を表示する。拒否・期限切れは更新経路に進めない。案件の版を条件にした更新と、操作 ID の未登録を条件にした記録の追加を同じ DynamoDB トランザクションで実行する。再試行時に操作記録があれば同じ内容か照合して結果を返す。保持期間を過ぎた操作や別システムへの副作用まで保証する仕組みではない。実行履歴への IAM アクセスを限定し、ログに依頼本文・資格情報・タスクトークンを出力しない設定を行う。

公式資料

- [Step Functions のタスクトークン待機](https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html)
- [API Gateway の JWT Authorizer](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [Amazon Bedrock Converse](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html)
- [DynamoDB トランザクション](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html)
- [Step Functions と CloudWatch Logs](https://docs.aws.amazon.com/step-functions/latest/dg/cw-logs.html)
