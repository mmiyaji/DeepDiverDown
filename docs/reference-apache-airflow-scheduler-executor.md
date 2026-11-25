# Apache Airflow：Scheduler と Executor のタスク実行

## 1. 対象

Scheduler が DAG Run と Task Instance を進め、Executor を経て Worker で実行し、状態をメタデータ DB に残すまでを扱う。根拠は Airflow 安定版（stable）のドキュメントである。バージョン依存の記述は未確認と明記する。

## 2. DAG Run の作成

Scheduler は常駐サービスとして動き、新しい DAG Run が必要な DAG を確認して作る。最初の Run はタスクの最小 `start_date` を基準にし、以降は DAG のタイムテーブルに従う。Scheduler の判断にはシリアライズされた DAG 定義を使う。

## 3. Task Instance の選定と提出

Scheduler は DAG Run の一部を調べ、実行可能な Task Instance を選ぶ。選定ではプールや並行数の上限を守る。1 回の反復で scheduled にする数は、空いているプールスロットまでである。選ばれた Task Instance は設定された Executor に提出される。この区間は、複数の Scheduler でもプール行のロック（`SELECT ... FOR UPDATE`）で 1 つずつ通る。

Task Instance の標準的な状態遷移は `none` → `scheduled` → `queued` → `running` → `success` である。失敗時は `failed` か、再試行が残る場合の `up_for_retry` になる。`up_for_retry` は後で再スケジュールされる。

## 4. Executor から Worker へ

`queued` は Executor に割り当てられ、Worker を待つ状態である。Executor の種類と実行形態は構成で決まる。キューを挟む種類（例：CeleryExecutor は Redis などのブローカーを使う）では、Worker が待ち行列から実行依頼を取得する。キューを持たない種類の経路は本図では扱わない。

## 5. 状態の書き込み

Worker は Task を実行し、状態を報告する。Airflow 3 の概要図の実装例に合わせ、報告は API Server の Execution API を経由してメタデータ DB に保存するとした。Airflow 2 系の書き込み経路は未確認である。Scheduler が停止したと判定されると、`scheduler_health_check_threshold` に基づき、その Scheduler の running と queued のタスクを別の Scheduler が引き取る。

## 6. 参考資料

- [Airflow Scheduler](https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/scheduler.html)
- [Airflow Tasks](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/tasks.html)
- [Airflow Architecture Overview](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html)

## 7. 実装例：自前の Celery Executor と Redis

自前 Linux 上で Scheduler、API Server、Celery Worker、Redis、PostgreSQL を動かす。Scheduler プロセス内の CeleryExecutor が実行依頼を Redis に送り、Celery Worker が取得する。

| 機能 | 担い手 |
| --- | --- |
| メタデータ DB | PostgreSQL |
| DAG Run の作成、Task Instance の選定 | Airflow Scheduler |
| Executor | Scheduler 内の CeleryExecutor |
| 実行依頼の待ち行列 | Redis Celery ブローカー |
| Worker | Celery Worker（複数台可） |
| 状態の受け口 | API Server の Execution API |

台数、ブローカーの冗長化、実機の動作は未検証である。接続は概要図の実装例と同じ前提に合わせた。

## 公式資料

- [Airflow Scheduler](https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/scheduler.html)
- [Airflow Celery Executor](https://airflow.apache.org/docs/apache-airflow-providers-celery/stable/celery_executor.html)
- [Airflow Architecture Overview](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html)
