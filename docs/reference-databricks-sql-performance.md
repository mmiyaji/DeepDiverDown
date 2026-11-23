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

## 5. 実装例 Databricks Serverless SQL のクエリ調査

注文の管理 Delta テーブルを Serverless SQL Warehouse で読み、Query Profile と履歴を使って改善前後を調べる例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 注文集計 SQL | Databricks SQL Editor | 条件と集計が明示された注文クエリを実行する。 |
| SQL 実行の計算資源・最適化された演算エンジン・結合・再分配 | Serverless SQL Warehouse と Photon | 対応するスキャン・結合を処理し、必要な並列実行と再分配をサービス側で行う。 |
| 列指向テーブルのデータファイル | Unity Catalog 管理 Delta テーブル | 注文日の絞り込みに利用できる統計とファイルを持つ。 |
| クエリの演算子プロファイル | Databricks Query Profile | 時間や読み取り行数などの演算子指標を確認する。 |
| テーブル保守 | Liquid Clustering のテーブル設定 | 注文日などのアクセス条件を踏まえてクラスタリング方法を選ぶ。 |

スキャンの対象範囲と並行負荷を個別に比較する。テーブルに適用できる保守機能と履歴の利用範囲は、Unity Catalog の管理形態や権限に従う。

この例の計算資源は Databricks 管理のサーバーレス環境で動く。注文表の実体は利用者の S3 に設定した Unity Catalog 管理ストレージに置く。分析者は SQL Warehouse の `CAN USE` と Unity Catalog のテーブル参照権限を持つ。Query Profile を確認するのはクエリの所有者、または Warehouse の `CAN MONITOR` 以上を持つ担当者とする。Predictive Optimization を有効にした場合、保守処理は Databricks のサーバーレス Jobs 計算資源で実行される。

- [Serverless SQL Warehouse の設定](https://docs.databricks.com/aws/en/admin/sql/serverless)
- [SQL Warehouse の権限](https://docs.databricks.com/aws/en/compute/sql-warehouse/create)
- [Unity Catalog 管理ストレージ](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)

出典 [SQL Warehouse の種類](https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-types)、[Photon](https://docs.databricks.com/aws/en/compute/photon)、[クエリプロファイル](https://docs.databricks.com/aws/en/sql/user/queries/query-profile)、[Liquid clustering](https://docs.databricks.com/aws/en/tables/clustering)、[Predictive optimization](https://docs.databricks.com/aws/en/optimizations/predictive-optimization)、[Query history system table](https://docs.databricks.com/aws/en/admin/system-tables/query-history)

Serverless SQL Warehouse は Databricks 管理のサーバーレス計算プレーンで SQL を実行し、管理テーブルの実ファイルはこの例では顧客 AWS アカウントの S3 管理ストレージに置く。利用者は権限に応じて Warehouse、SQL、クラスタリング設定とテーブル保守を指定し、Query Profile・履歴を確認できる。サーバーレス内部ノードを直接操作するものではない。性能と改善幅は例示であり実環境で未検証。[Databricks architecture](https://docs.databricks.com/aws/en/security/network/deployment-architecture/)、[Managed storage](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)
