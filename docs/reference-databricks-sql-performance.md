# Databricks SQL の実行プロファイルとファイル配置

## 1. 計測の目的

日付と顧客で絞った注文集計を例に、キューの待ちと実行処理を分けて調べる。以下の図は計画を単純化したもの。

## 2. SQL Warehouse と Photon

SQL Warehouse は SQL の実行先。Serverless、Pro、Classic は機能と運用境界が異なる。Photon は対応する処理をベクトル化するエンジンで、クエリで対応しない演算は別の実行経路になり得る。

## 3. プロファイル

実行プロファイルから各演算子と処理時間、読んだデータ量、シャッフルを確認する。絞り込みが効かないスキャンと、大きな結合の再分配を区別する。

## 4. ストレージ上の最適化

Liquid clustering はテーブルのデータ配置を条件列に合わせて最適化する選択肢。利用可能なテーブル種別、既存の配置との互換性、保守コストを確認する。対応する Unity Catalog 管理テーブルでは predictive optimization による保守を別に検討できる。

## 図で確認するシナリオ

- **日付を絞った集計でスキャンを確認** — 同じ条件でクエリを実行し、実行時の条件を揃える。 → スキャンの作業量をプロファイルで確認する。 → 配置の保守後に同条件で再計測し、読んだ量の違いを見る。
- **結合の待ちと再分配を調べる** — 複数のテーブルを使う集計を実行する。 → 再分配が大きい演算子と入力行数を調べ、次に見直す条件を決める。

## 公式資料

- [SQL Warehouse の種類](https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-types)
- [Photon](https://docs.databricks.com/aws/en/compute/photon)
- [クエリプロファイル](https://docs.databricks.com/aws/en/sql/user/queries/query-profile)
- [Liquid clustering](https://docs.databricks.com/aws/en/tables/clustering)
- [Predictive optimization](https://docs.databricks.com/aws/en/optimizations/predictive-optimization)
