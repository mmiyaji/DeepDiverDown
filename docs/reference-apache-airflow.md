# Apache Airflow のワークフローアーキテクチャ

## 1. 範囲
取り込み、変換、品質チェックを DAG と Task の依存関係でスケジュールする例を示す。

出典 [Architecture Overview](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html)

## 2. DAG と Task
DAG は Task と依存関係を表し、順序とデータフローを定義する。Task はデータ取得、分析、外部システム起動などを実行できる。

## 3. Scheduler と Executor
Scheduler はスケジュールを発火し、Task を Executor に提出する。Executor の種類や実行形態は構成により異なる。

## 4. 実行と再試行
Worker が Task を実行し、失敗時はリトライ設定に従って再試行する。メタデータDBはDAGと実行状態を保持する。

## 5. シナリオ
図は DAG、Scheduler、Executor、Worker、Metadata DB、Raw ingest、Transform、Quality check の8ノードで、依存順と失敗後の再試行を示す。

## 6. 参考資料
- [Architecture Overview](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html)

## 7. 実装例：Airflow CeleryExecutor と Redis

Airflow 3 のスケジューラーと Celery ワーカーを分け、Redis にタスクをキューイングする例。DAG の解析は専用プロセスで行い、タスクの実行状態は Execution API を経由してメタデータ DB に保存する。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 作業手順の依存グラフ | Python の DAG ファイル | 取込・変換・検査のタスクと依存関係を定義する。 |
| スケジューラー、タスクの配布 | Airflow Scheduler と CeleryExecutor | 依存関係を見て実行可能なタスクを Redis に送る。 |
| タスクの実行プロセス、元データの取り込み、データ変換、品質検査 | Airflow Celery Worker と三つの業務タスク | キューからタスクを受け取り、必要な依存ライブラリーと接続で処理する。 |
| 実行メタデータの保存先 | Airflow API Server と PostgreSQL メタデータ DB | Execution API がタスクの実行状態を受け取り、メタデータ DB に記録する。 |

実装で加わる部品を以下に示す。

- Redis Celery ブローカー。CeleryExecutor から受け取った実行依頼をキューで保持する。Airflow の実行履歴はメタデータ DB に保存する。
- Airflow DAG Processor。Python の DAG を解析してシリアライズした定義をメタデータ DB に渡す。Scheduler はその定義に基づいてタスクをスケジュールする。

公式資料

- [Airflow Architecture Overview](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html)
- [Airflow Celery Executor](https://airflow.apache.org/docs/apache-airflow-providers-celery/stable/celery_executor.html)
- [DAG Serialization](https://airflow.apache.org/docs/apache-airflow/stable/dag-serialization.html)
- [Airflow Security Model](https://airflow.apache.org/docs/apache-airflow/stable/security/security_model.html)
