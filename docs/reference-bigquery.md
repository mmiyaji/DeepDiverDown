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
