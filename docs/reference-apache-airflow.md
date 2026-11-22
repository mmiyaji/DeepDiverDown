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
