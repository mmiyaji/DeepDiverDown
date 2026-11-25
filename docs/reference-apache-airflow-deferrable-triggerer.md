# Apache Airflow：Deferrable タスクと Triggerer

## 1. 対象

Deferrable オペレーターが待機を Triggerer に渡し、完了イベントで Worker に戻るまでを扱う。根拠は Airflow 安定版（stable）のドキュメントである。バージョン依存の記述は未確認と明記する。

## 2. defer() で Worker を手放す

通常のオペレーターやセンサーは、待っている間も Worker スロットを占有する。Deferrable オペレーターは `self.defer(trigger, method_name, kwargs, timeout)` を呼ぶ。これは `TaskDeferred` 例外を送出し、オペレーターを Worker から外す。Task Instance は `deferred` になる。待機中は Worker スロットを占有せず、既定ではプールスロットも占有しない。再開時に引き継がれるのは、`method_name` と `kwargs` で渡した値だけである。

## 3. Triggerer と asyncio

Trigger は別プロセスの Triggerer で動く。Scheduler とは別に、最低 1 つの Triggerer が必要である。Trigger は非同期の Python コードで、1 つのプロセスで多数を動かせる。待機中の呼び出しは `await` する必要があり、ブロッキング呼び出しは Triggerer 全体を止める。`run()` は `TriggerEvent` を `yield` する。

## 4. イベントから再開まで

TriggerEvent が出ると、Scheduler が Task Instance を再度キューに入れる。Worker は `method_name`（next_method）を `context` と `event` 付きで呼ぶ。そのメソッドから戻ると Task が完了する。`defer()` の `timeout` を超えると Task Instance は失敗する。`execution_timeout` は deferred の時間を含む総実行時間に掛かる。

## 5. 制約と冗長化

- defer できるのはクラスベースのオペレーターである。PythonOperator や TaskFlow の関数は defer できない。
- Trigger の `__init__` 引数はシリアライズ可能にする。Trigger は複数回動く場合があるため、DB への行追加などの副作用を避ける。
- Trigger を変更したら Triggerer を再起動する。Trigger を DAG bundle に置くことはできない。
- 複数の Triggerer を動かすと、ロックとハートビートで分担する。1 つが停止すると、その Trigger は別の Triggerer に再割り当てされる。
- 1 つの Triggerer の既定上限は 1000 個である。

## 6. 参考資料

- [Deferring Operators and Triggers](https://airflow.apache.org/docs/apache-airflow/stable/authoring-and-scheduling/deferring.html)
- [Airflow Tasks](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/tasks.html)
- [Airflow Scheduler](https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/scheduler.html)

## 7. 実装例：自前の Celery Executor・Triggerer・PostgreSQL

自前 Linux 上で Scheduler と CeleryExecutor、Celery Worker、Triggerer を別プロセスで動かす。PostgreSQL が deferred の状態、Trigger、TriggerEvent を保持する。Redis と API Server の経路は図 1（Scheduler と Executor）に任せ、本図では省く。

| 機能 | 担い手 |
| --- | --- |
| 最初の実行、再開した実行 | Celery Worker |
| メタデータ DB | PostgreSQL |
| Triggerer、Trigger の非同期処理 | Airflow Triggerer |
| Scheduler、Executor | Airflow Scheduler と CeleryExecutor |
| 待機対象 | 運用者の環境にある外部システム |

Trigger の起動数、Triggerer の台数、実機の動作は未検証である。

## 公式資料

- [Deferring Operators and Triggers](https://airflow.apache.org/docs/apache-airflow/stable/authoring-and-scheduling/deferring.html)
- [Airflow Celery Executor](https://airflow.apache.org/docs/apache-airflow-providers-celery/stable/celery_executor.html)
- [Airflow Architecture Overview](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html)
