# イベント駆動のデータ管理エージェント

## 1. 対象と動向
継続的なデータイベントを受けてエージェントが状況を評価し、人の承認を経て必要な操作を行う構成。Gartner の 2026 年の公開発表では agentic data streaming と agentic data management を動向に挙げている。公開発表を参照しており、有料レポート全文は未参照。

## 2. 機能配置と処理
データ源がイベントを発行し、永続的なイベントログからコンシューマーが受け取る。アプリケーションはイベントをエージェントに渡して状態や状況を評価する。変更が必要なときは提案を記録し、管理者の承認を受け、許可されたツールで操作する。処理位置、実行状態、操作結果を保持して再開や監査に使う。

## 3. 設計上の注意
イベント受信をもって正しい自律判断や exactly-once の外部操作が保証されるわけではない。重複イベント、順序、遅延、再試行と再開、ツール権限、機微情報、誤判断を考慮し、書き込みを冪等に設計する。オフセットの確定と外部更新の整合を検討し、承認・停止・監視の手段を用意する。

## 4. 実装例：Kafka と LangGraph
Kafka のプロデューサーがイベントをトピックに発行し、アプリの Kafka コンシューマーが取得する。アプリが LangGraph を呼び出し、チェックポインターと interrupt を利用した承認待ち・再開を実装する。承認された操作はアプリが用意するツールで行う。Kafka と LangGraph の接続、オフセット確定、承認 UI、冪等性、アクセス制御は利用者側で実装するもので、製品間の標準機能として自動提供されるとは仮定しない。

| 機能 | 担い手 |
|---|---|
| イベント配信 | Kafka トピックとアプリのコンシューマー |
| 判断・状態 | LangGraph とチェックポインター |
| 承認と操作 | 承認担当者、アプリが用意するツール |
| 運用 | コンシューマーのオフセットと実行・操作ログ |

[Gartner 2026 発表](https://www.gartner.com/en/newsroom/press-releases/2026-06-16-gartner-identifies-the-top-trends-for-data-and-analytics)、[Kafka Consumer](https://kafka.apache.org/documentation/#consumerapi)、[LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)、[LangGraph durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution)。


## 5. 実装例：Amazon MSK と ECS 上の LangGraph・RDS

Amazon MSK のデータ品質イベントを ECS on Fargate で受信する。LangGraph が確認案件を起案し、担当者の承認後に台帳へ登録する。

| 機能 | 担い手 |
| --- | --- |
| イベントログと受信 | Amazon MSK の Kafka トピックと Fargate のコンシューマー。 |
| 評価と承認待ち | ECS の LangGraph アプリが Bedrock を呼び、RDS 上の PostgresSaver にスレッドの状態を保存する。 |
| 承認と操作 | API Gateway が Cognito のトークンを検証し、VPC Link と内部 ALB 経由で承認要求を ECS アプリに渡す。アプリが提案への権限・版を判定し、承認した案件を専用 Lambda が登録する。Lambda には RDS に接続する VPC 設定を付ける。 |
| 操作履歴 | RDS の操作台帳と、相関 ID を記録する CloudWatch Logs。 |

Kafka の自動コミットを無効にする。受信 DB への保存からオフセット確定までに中断すると再配信されうるため、同じイベント ID の重複受信を一意制約で処理する。別の処理担当と競合しないよう、処理待ちの取得と再開をスレッド単位で管理する。承認のない提案は登録しない。LangGraph が中断ノードを再実行しうるので、外部操作は承認後の別ノードに置く。案件と操作 ID の登録を同じ DB トランザクションに閉じる。Kafka から外部操作までの exactly-once は前提としない。MSK と RDS への認証とプライベート経路、承認 API への到達性、ログの保管項目は運用側で設定する。

公式資料

- [Amazon MSK への接続](https://docs.aws.amazon.com/msk/latest/developerguide/client-access.html)
- [Kafka Consumer のオフセット確定](https://kafka.apache.org/42/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html)
- [LangGraph の割り込みと再開](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph の永続化](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Amazon Bedrock Converse](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html)
- [API Gateway の JWT Authorizer](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [API Gateway HTTP API のプライベート統合](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-private.html)

汎用例では利用者のホストでコンシューマーと LangGraph を実行する。Kafka、チェックポイント保存先、管理対象ツールとモデル提供者の配置・運用主体は未指定であり、接続設定と永続化は利用者が設計する。AWS 例では AWS が各サービスの基盤を運用し、利用者はタスクと Lambda のコード、モデル・API・認証・ネットワークの設定、データと権限を管理する。Lambda は顧客 VPC に接続して RDS にアクセスするが、サービスの内部実行基盤を顧客が直接操作する意味ではない。API Gateway 自身が Cognito の公開鍵を使って JWT と設定済みスコープを検証する。各製品の資料を組み合わせた代表例であり、バージョン、認証・ネットワーク設定および再試行を含む通しの動作は未検証。
