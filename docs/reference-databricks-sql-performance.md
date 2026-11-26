# Databricks SQL：実行プロファイル・Photon・キャッシュ

## 1. 調査の範囲

SQL Warehouse で実行し、ファイル統計、Photon、実行時の計画調整、キャッシュを経て、Query Profile でどこに時間がかかるかを切り分ける。Delta のファイル配置の詳細は Liquid Clustering の図で扱う。2026 年 11 月時点の公開資料に基づく。内部部品は公開資料に基づく論理的な役割。 対象は AWS 上の Unity Catalog 管理 Delta テーブルと Serverless SQL Warehouse の説明用構成であり、すべての Databricks や Iceberg テーブルの実装を意味しない。実環境での性能検証は行っていない。

## 2. 表の状態とデータ読み取り

- **SQL の発行（SQL Warehouse）**：注文日で絞った集計 SQL を SQL Warehouse に発行する。Serverless、Pro、Classic は機能と運用境界が異なる。
- **テーブルの解決・権限**：管理テーブルとアクセス権を解決する。
- **計画と実行時の調整**：統計から計画し、対象クエリでは実行時統計を使って物理戦略を調整する。Warehouse の同時実行が多いと、実行前にキューで待つ場合がある。
- **保存済みの結果**：条件を満たすクエリ結果を再利用できる。ローカルとサーバーレスのリモート結果キャッシュを区別する。
- **候補ファイルの読み取り**：ファイル統計で候補を絞り、必要な列を読み取る。
- **結合・集計・再分配**：Photon は対応する演算をベクトル化する。非対応の処理は別の実行経路を使う。
- **実行資源内のデータキャッシュ**：読み込んだ Parquet データのコピーをローカルディスクに保持する。対象ファイル変更や計算資源の終了により無効になる。
- **実行の観測**：Query Profile でスキャン、行数、時間、shuffle や spill を確認する。
- **データ配置の保守**：管理テーブルでは Predictive Optimization が対象条件に従い OPTIMIZE・VACUUM・ANALYZE 等を実行する。
- **表の状態とファイル統計**：Delta transaction log の状態から有効なデータファイルを特定し、ファイルごとの統計で対象を絞る。
- **列指向の保存ファイル**：表のデータを Parquet ファイルに保存する。ファイルの値域と配置が data skipping に影響する。
- **配置方針**：Liquid Clustering のキーによりファイル配置を調整する。AUTO は対象管理テーブルと Predictive Optimization などの条件が必要。

Delta の transaction log はコミットとファイルの追加・削除を記録し、スナップショットの有効ファイルを決める。data skipping は対象列のファイル単位の最小値・最大値、null 数等で不必要なファイルを避ける。統計がない列では効果が限られる。Parquet の読み取りは必要列を対象にする。リンクは公開資料に基づく論理関係であり、内部 RPC を断定しない。

## 3. 実行エンジンと計画

Photon は C++ 実装のベクトル化エンジンであり、対応演算を高速化する。対応しない演算では別の実行経路へフォールバックする。SIGMOD 2022 論文はバッチ処理、メモリ管理と Spark との統合を解説するが、執筆時点の実装説明であり現在のすべての内部挙動の保証ではない。AQE は対象となる非ストリーミングクエリについて shuffle / broadcast の実行時統計を使い、結合戦略、パーティション統合や skew 対応を調整し得る。常に実行計画が変わるわけではなく、AQE は実行時に join 順序を変更しない。

## 4. 結果とデータのキャッシュ

SQL Warehouse のローカル結果キャッシュは計算クラスタの寿命に依存する。リモート結果キャッシュはサーバーレスのみで、ウェアハウスの停止・再開をまたいで保持され得るが、その読み出しにも稼働中のウェアハウスが必要。基表の更新などで無効になる。ディスクキャッシュは取得した Parquet データのローカルコピーで、結果キャッシュとは異なる。停止・再起動で消え、データ変更にも追随する。

## 5. 配置・保守・診断

Liquid Clustering はフィルター対象のキーに沿ってデータを配置する。手動キーと自動キーは区別し、自動キー選択には対象管理テーブル、対応ランタイム、Predictive Optimization の条件がある。Predictive Optimization は Unity Catalog 管理テーブルを対象に serverless jobs compute で OPTIMIZE、VACUUM、ANALYZE 等を実行し、追加計算費用を伴う。Query Profile のファイル数、スキャン量、演算子の行数、shuffle、spill と実行待ちを調べ、キャッシュ・負荷・データ量を揃えて比較する。

## 6. 実装例：AWS と Serverless SQL

利用者の BI クライアントから Databricks に SQL を送り、Databricks 管理のサーバーレス計算と Unity Catalog、顧客 AWS アカウントの S3 管理ストレージ上の Delta ログ・データを使う。実行プレーン内部は論理的な表現。S3 とサーバーレス計算を同じ運用境界と見なさない。管理テーブルへの権限、ストレージ接続、機能・リージョン・利用可能なランタイムと保守費用を確認する。

| 機能配置 | この例の担い手 | 内容 |
| --- | --- | --- |
| SQL の発行 | BI クライアント | 注文日で絞った集計 SQL を発行する。 |
| テーブルの解決・権限 | Unity Catalog | 管理テーブルとアクセス権を解決する。 |
| 計画と実行時の調整 | SQL の計画と AQE | 統計から計画し、対象クエリでは実行時統計を使って物理戦略を調整する。 |
| 保存済みの結果 | SQL Warehouse の結果キャッシュ | 条件を満たすクエリ結果を再利用できる。ローカルとサーバーレスのリモート結果キャッシュを区別する。 |
| 候補ファイルの読み取り | Photon のファイルスキャン | ファイル統計で候補を絞り、必要な列を読み取る。 |
| 結合・集計・再分配 | Photon と対応しない演算 | Photon は対応する演算をベクトル化する。非対応の処理は別の実行経路を使う。 |
| 実行資源内のデータキャッシュ | Warehouse のディスクキャッシュ | 読み込んだ Parquet データのコピーをローカルディスクに保持する。対象ファイル変更や計算資源の終了により無効になる。 |
| 実行の観測 | SQL Query Profile | Query Profile でスキャン、行数、時間、shuffle や spill を確認する。 |
| データ配置の保守 | Predictive Optimization と OPTIMIZE | 管理テーブルでは Predictive Optimization が対象条件に従い OPTIMIZE・VACUUM・ANALYZE 等を実行する。 |
| 表の状態とファイル統計 | S3 上の Delta ログと統計 | Delta transaction log の状態から有効なデータファイルを特定し、ファイルごとの統計で対象を絞る。 |
| 列指向の保存ファイル | S3 上の Delta Parquet ファイル | 表のデータを Parquet ファイルに保存する。ファイルの値域と配置が data skipping に影響する。 |
| 配置方針 | Delta の Liquid Clustering 設定 | Liquid Clustering のキーによりファイル配置を調整する。AUTO は対象管理テーブルと Predictive Optimization などの条件が必要。 |

## 未確認

実環境の性能、キャッシュの命中率、キュー待ちの時間は未検証。性能に関する数値は Databricks の自己申告であり、ここでは載せていない。Photon の内部実装は 2022 年の論文時点の説明で、現在の挙動は未確認。

## 公式資料・動画・カンファレンス

- [Data skipping](https://docs.databricks.com/aws/en/tables/data-skipping)
- [Delta Lake protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)
- [Photon](https://docs.databricks.com/aws/en/compute/photon)
- [Photon SIGMOD 2022](https://www.databricks.com/de/wp-content/uploads/2022/07/Photon-A-Fast-Query-Engine-for-Lakehouse-Systems.pdf)
- [Adaptive query execution](https://docs.databricks.com/aws/en/optimizations/aqe)
- [Liquid clustering](https://docs.databricks.com/aws/en/tables/clustering)
- [Predictive optimization](https://docs.databricks.com/aws/en/optimizations/predictive-optimization)
- [Query caching](https://docs.databricks.com/aws/en/sql/user/queries/query-caching)
- [Query Profile](https://docs.databricks.com/aws/en/sql/user/queries/query-profile)
- [SQL Warehouse の種類](https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-types)
- [Performance best practices](https://docs.databricks.com/aws/en/lakehouse-architecture/performance-efficiency/best-practices)
- [Data + AI Summit: Liquid Clustering](https://answers.databricks.com/delta-lake-liquid-clustering-lightning-fast-queries-massive-datasets-2w50YGvW8TM)
- [Optimizing MERGE Performance using Liquid Clustering](https://www.youtube.com/watch?v=yZmrpXJg-G8)
- [Managed storage](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)
- [Serverless architecture](https://docs.databricks.com/aws/en/security/network/serverless-network-security/serverless-compute)

動画は公開説明・カンファレンスの公開内容を調査の入口として用い、確認できない映像中の詳細を断定していない。
