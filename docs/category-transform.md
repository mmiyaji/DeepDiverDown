# 変換とオーケストレーションの違い

| 観点 | dbt | Apache Airflow | AWS Glue | Azure Data Factory | Google Cloud Dataflow |
| --- | --- | --- | --- | --- | --- |
| 特徴 | **SQL の変換** を依存順に管理 | **Python の DAG** で依存関係を定義 | **Data Catalog 連携** の ETL | **コピーと制御フロー** を 1 つに | **Beam** でバッチとストリームを共通化 |
| 処理の実行先 | **ウェアハウス** が SQL を実行 | Executor 経由の **Worker** | **Spark ワーカー**（DPU 単位） | **Integration Runtime** | **ワーカー VM** |
| 順序の決め方 | ref・source の **依存グラフ** | DAG の依存を **Scheduler** が判定 | **トリガー** でジョブを起動 | パイプライン内の **アクティビティ** と依存 | Beam の **実行グラフ** を融合して最適化 |
| 動かし方 | 自前 CI の **dbt Core** または dbt Cloud | 自前（Celery 等）または **MWAA** | **サーバーレス** | Azure の **マネージド**、私設網は自前 IR | **フルマネージド** |
| 得意な処理 | ウェアハウス内の **ELT 変換** | **バッチの順序制御** と再試行 | S3 などの **形式変換** | 多様なストアの **コピー** | **ストリーム集計** と BigQuery 出力 |
| つまずきやすい点 | **自前でデータを処理しない** | **Scheduler とメタデータ DB** が要 | ブックマークは **入力側だけ** 追跡 | Data Flow は **クラスター起動を待つ** | Streaming Engine は Java で **指定が必要** |

dbt は変換 SQL を作って投げる側で、処理はウェアハウスが担います。Airflow と Azure Data Factory は処理の順序を管理し、AWS Glue と Google Cloud Dataflow は変換処理そのものを実行します。

## 選び方

- ウェアハウス内の変換を SQL とテストで管理する → **dbt**
- 複数のシステムにまたがるバッチの順序と再試行を Python で組む → **Apache Airflow**
- S3 のデータを Spark で変換し、Athena から同じ定義で読む → **AWS Glue**
- Azure 上の多様なデータストアの間でコピーし、ノーコードで変換する → **Azure Data Factory**
- Pub/Sub のイベントを集計して BigQuery に出す → **Google Cloud Dataflow**

対応するデータソース、料金、配置方式、バージョンごとの機能は、各社の資料と契約で確認します。

## 公式資料

- [dbt Materializations](https://docs.getdbt.com/docs/build/materializations)
- [dbt Incremental models](https://docs.getdbt.com/docs/build/incremental-models)
- [dbt Snapshots](https://docs.getdbt.com/docs/build/snapshots)
- [Airflow Scheduler](https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/scheduler.html)
- [Airflow Celery Executor](https://airflow.apache.org/docs/apache-airflow-providers-celery/stable/celery_executor.html)
- [AWS Glue How it works](https://docs.aws.amazon.com/glue/latest/dg/how-it-works.html)
- [AWS Glue job bookmarks](https://docs.aws.amazon.com/glue/latest/dg/monitor-continuations.html)
- [Azure Data Factory Integration runtime](https://learn.microsoft.com/en-us/azure/data-factory/concepts-integration-runtime)
- [Azure Data Factory Mapping data flows](https://learn.microsoft.com/en-us/azure/data-factory/concepts-data-flow-overview)
- [Dataflow Streaming Engine](https://docs.cloud.google.com/dataflow/docs/streaming-engine)
- [Dataflow pipeline lifecycle](https://docs.cloud.google.com/dataflow/docs/pipeline-lifecycle)
