# BigQuery のストレージ・コンピュート分離アーキテクチャ

## 1. 範囲
BigQuery のマネージド分析基盤を、利用者、管理インターフェース、ストレージ、クエリ実行の関係として示す。BigQuery はインフラを利用者がプロビジョニングせずに使うサーバーレスのデータ分析サービスである。

出典 [BigQuery overview](https://cloud.google.com/bigquery/docs/introduction)

## 2. リソース階層
Google Cloud の組織・フォルダ・プロジェクトに加え、BigQuery 固有のデータセットがテーブルやビューをまとめる。プロジェクトはジョブの実行、権限、割り当て、課金の境界として使える。

出典 [Introduction to the resource hierarchy](https://cloud.google.com/bigquery/docs/resource-hierarchy)

## 3. ストレージ層
BigQuery のストレージは管理サービスで、分析向けの列指向形式でテーブルデータを保持する。ストレージは自動的に割り当てられ、複数のゾーンへの複製によって耐久性と可用性を支える。

出典 [Overview of BigQuery storage](https://cloud.google.com/bigquery/docs/storage_overview)

## 4. コンピュート層
クエリエンジンはストレージから必要なデータを読み、複数のワーカーへ処理を分散し、結果を集約する。ストレージとコンピュートは独立してリソースを割り当てられるため、データ量とクエリ需要を別々に伸縮できる。

出典 [BigQuery overview](https://cloud.google.com/bigquery/docs/introduction)・[Overview of BigQuery storage](https://cloud.google.com/bigquery/docs/storage_overview)

## 5. 取り込みとクエリ
データは Cloud Storage からのバッチロードや Storage Write API などで取り込める。取り込まれたテーブルをクエリジョブが読み、処理結果を返す。具体的な取り込み方式、スキーマ、ジョブ割り当ては利用側で選択する。

出典 [BigQuery overview](https://cloud.google.com/bigquery/docs/introduction)

## 6. クエリ実行グラフ
クエリは複数の Stage（ステージ）からなる実行グラフへ変換され、各ステージの work unit を Slot（スロット）が並列実行する。ステージ間の中間データは高速な分散 Shuffle 層を介して渡され、クエリの進行に応じて実行計画が動的に調整される。

出典 [Query plan and timeline](https://cloud.google.com/bigquery/docs/query-plan-explanation)・[Overview of BigQuery analytics](https://cloud.google.com/bigquery/docs/query-overview)

## 7. シナリオ
図は Client、Query stages、Dataset、Managed storage、Slots / stage workers、Distributed shuffle、BI user の7ノードで、ロードしたテーブルをステージ、スロット、シャッフルで処理する流れを表す。

出典 [BigQuery overview](https://cloud.google.com/bigquery/docs/introduction)・[Query plan and timeline](https://cloud.google.com/bigquery/docs/query-plan-explanation)

## 8. 参考資料
- [BigQuery overview](https://cloud.google.com/bigquery/docs/introduction)
- [Overview of BigQuery storage](https://cloud.google.com/bigquery/docs/storage_overview)
- [Introduction to the resource hierarchy](https://cloud.google.com/bigquery/docs/resource-hierarchy)
- [Query plan and timeline](https://cloud.google.com/bigquery/docs/query-plan-explanation)
- [Overview of BigQuery analytics](https://cloud.google.com/bigquery/docs/query-overview)

## 9. 実装例 BigQuery と Cloud Storage の受注分析

Cloud Storage から同一ロケーションの BigQuery データセットへロードし、分析プロジェクトのクエリに予約を割り当てる例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| ジョブ実行クライアント | bq CLI を使う投入端末 | 受注ファイルの URI と出力テーブル名を指定する。 |
| CSV の取り込み | BigQuery のロードジョブ | Cloud Storage から受注ファイルを取り込む。 |
| SQL 計画とステージ分割 | BigQuery ジョブとクエリ計画 | ジョブを受け付け、クエリのステージを作る。 |
| 分析者 | BigQuery Studio | 分析プロジェクトに対する権限を使ってクエリする。 |
| 分析テーブルの名前空間・管理された列指向ストレージ | BigQuery sales データセットと管理表 | ロケーションを設定し、受注データを BigQuery の管理ストレージに保持する。 |
| 並列クエリ実行枠・分散シャッフル | BigQuery の分析用予約と実行 | 分析プロジェクトにクエリジョブの予約割当を付け、実行時のステージとシャッフルはクエリ計画で確認する。 |

容量予約と分析用の割当は入力 CSV の保存や管理表と独立して設定する。データセットのロケーションと予約の割当要件をそろえる。シャッフルはクエリ計画から観測する。

運用者が `bq load` で登録したロードジョブが Cloud Storage の CSV を読み、BigQuery の管理テーブルに書き込む。分析者は BigQuery Studio から SQL を送信する。容量管理者はデータセットと同じロケーションに予約を作成し、分析クエリを実行するプロジェクトへ `QUERY` タイプを割り当てる。この例のロードジョブは `PIPELINE` の予約を割り当てず、既定の共有枠を使う。

- [BigQuery の予約割り当て](https://docs.cloud.google.com/bigquery/docs/reservations-assignments)
- [BigQuery のバッチロードと容量](https://docs.cloud.google.com/bigquery/docs/batch-loading-data)

出典 [BigQuery overview](https://cloud.google.com/bigquery/docs/introduction)、[Overview of BigQuery storage](https://cloud.google.com/bigquery/docs/storage_overview)、[Introduction to the resource hierarchy](https://cloud.google.com/bigquery/docs/resource-hierarchy)、[Query plan and timeline](https://cloud.google.com/bigquery/docs/query-plan-explanation)、[Overview of BigQuery analytics](https://cloud.google.com/bigquery/docs/query-overview)、[BigQuery のワークロード管理](https://docs.cloud.google.com/bigquery/docs/reservations-intro)、[Cloud Storage の CSV をロード](https://docs.cloud.google.com/bigquery/docs/loading-data-cloud-storage-csv)

この例は分析・データ・予約を同一プロジェクトに置く選択である。Google が BigQuery と Cloud Storage の基盤を運用し、利用者はロード・クエリ API、データセットと表、QUERY 予約と割り当て、IAM 権限を操作する。クエリ計画は確認できるが、内部ワーカーやストレージサーバーへの直接アクセスは想定しない。ロードジョブは既定の共有スロットプールを使い、QUERY 予約と区別する。対象データと予約のロケーション、具体的 IAM と実行性能は未指定で、公式資料を組み合わせた未検証例である。

## 10. 深掘りと Iceberg テーブル
2026 年 11 月時点で、BigLake は「Lakehouse for Apache Iceberg（旧 BigLake）」の名称で扱われる。Iceberg テーブルのデータは利用者の Cloud Storage に置き、BigQuery と外部エンジンが REST カタログで共有する（名称の対応は公式資料で未確認の部分がある）。詳細は次の図で扱う。
- [クエリ実行とスロット](reference-bigquery-dremel-slots.md)
- [Capacitor とストレージの最適化](reference-bigquery-storage-optimization.md)
- [Iceberg レイクハウス（旧 BigLake）](reference-bigquery-lakehouse-iceberg.md)
