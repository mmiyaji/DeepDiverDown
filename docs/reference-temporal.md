# Temporal のワーカー障害とリプレイ

## 1. モデルの範囲

架空の注文 API は注文ごとの Workflow を開始する。Workflow は決済の Activity を予約し、結果を受けて注文処理を完了する。Workflow Worker と Activity Worker は図上で分ける。

出典 [Temporal Event History](https://docs.temporal.io/encyclopedia/event-history)、[Understanding Temporal](https://docs.temporal.io/evaluate/understanding-temporal)

## 2. タスクと Event History

Workflow Worker が Workflow Task を処理し、Activity の予約などのコマンドを Temporal Service に返す。Temporal Service がイベントを永続化し、Worker は対応する Task Queue をポーリングする。構成図では Workflow Task と Activity Task の取得先を一つにまとめ、見取り図では決済に関わる代表的な履歴を示す。

出典 [Temporal Event History](https://docs.temporal.io/encyclopedia/event-history)、[Understanding Temporal](https://docs.temporal.io/evaluate/understanding-temporal)

## 3. Worker の停止と決定的リプレイ

Temporal Service に決済 Activity の完了が記録された後で Workflow Worker A が停止する。Worker B は新たにタスクを取り、Event History を使って Workflow コードを再実行し状態を復元する。Workflow コードは同じ履歴に沿うコマンドを出せる決定的な構成にする。完了済み Activity の結果は履歴から得られ、リプレイによる外部呼び出しは発生しない。

出典 [Temporal Event History](https://docs.temporal.io/encyclopedia/event-history)、[Temporal Workflow Definition](https://docs.temporal.io/workflow-definition)、[Understanding Temporal](https://docs.temporal.io/evaluate/understanding-temporal)

## 4. Activity の完了報告と再試行

外部決済が成功した直後に Activity Worker が停止すると、Temporal に Activity の完了が記録されていない場合がある。タイムアウトと再試行ポリシーの条件を満たせば、Activity は再実行される。これは履歴を読む Workflow のリプレイとは別の処理である。

出典 [Temporal Activity Definition](https://docs.temporal.io/activity-definition)、[Temporal Retry Policy](https://docs.temporal.io/encyclopedia/retry-policies)

## 5. 外部決済の冪等性

決済 Activity には決済操作を一意に識別するキーを渡し、再試行でも同じキーを送る。例の決済 API は同じキーで新たな決済を作らず、初回の成功結果を返す契約を持つ。外部状態と Activity の完了記録は別々に更新されるため、重複した副作用を防ぐには外部操作の冪等性が必要になる。

出典 [Temporal Activity Definition](https://docs.temporal.io/activity-definition)、[Temporal Retry Policy](https://docs.temporal.io/encyclopedia/retry-policies)
