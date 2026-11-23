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

公式 Docker Compose の試行環境を基に、ローカルホストのコンテナで Airflow、Redis と PostgreSQL を動かし、共有ボリューム上の入力と出力をタスクで扱う例。業務タスクと共有ボリュームの追加は動作未検証。公式 Compose は学習・探索用で、本番向けのセキュリティを保証しない。[Airflow Docker Compose](https://airflow.apache.org/docs/apache-airflow/stable/howto/docker-compose/index.html)

## 8. 実装例：Amazon MWAA・Fargate・S3

Amazon MWAA の Airflow 2 系 CeleryExecutor 環境で、S3 の受注データを取り込み、変換と品質検査を実行する例。

| 機能 | 担い手 |
| --- | --- |
| 依存グラフ | 利用者アカウントの S3 に置く DAG ファイル。 |
| タスク配布 | AWS が管理する Fargate 上の Scheduler と CeleryExecutor、および SQS。 |
| 取り込み・変換・品質検査 | MWAA の Fargate ワーカーで動く Airflow タスク。 |
| 実行メタデータ | AWS 管理の Aurora PostgreSQL。 |
| データとログ | 利用者側の S3 に受注データを置き、環境のログを CloudWatch Logs に送る。 |

対象の MWAA Airflow バージョンに合わせて DAG と Python の依存関係を固定する。運用者の IAM アクセスと MWAA の実行ロールを分け、実行ロールに必要な S3・SQS・CloudWatch への権限を付与する。AWS 管理のメタデータ DB へは環境内のコンポーネントがプライベート接続する。

公式資料

- [Amazon MWAA のネットワークとコンポーネント](https://docs.aws.amazon.com/mwaa/latest/migrationguide/mwaa-architecture.html)
- [Amazon MWAA の概要](https://docs.aws.amazon.com/mwaa/latest/userguide/what-is-mwaa.html)
- [Amazon MWAA の実行ロール](https://docs.aws.amazon.com/mwaa/latest/userguide/mwaa-create-role.html)

MWAA は Scheduler と Worker の Fargate、タスクキューとメタデータ DB を AWS が管理する領域で運用する。利用者は環境設定、DAG、依存関係、実行ロールや Airflow UI/API の許可を設定できるが、管理 DB や内部コンテナを直接管理するものではない。入力・出力を同一バケットの別プレフィックスとした処理は資料を組み合わせた例で、実動作は未検証。[AWS 共有責任](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
