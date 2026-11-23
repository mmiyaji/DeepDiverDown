# Databricks Liquid Clustering：ファイル配置と Delta ログ

## 1. 対象と前提

Unity Catalog 管理 Delta テーブルを題材にする。図は公開情報から組み合わせた概念例であり、実際のファイル数、値域、実行順序や内部サービスの物理配置を保証しない。Managed Iceberg にも Liquid Clustering があるが、本図の Delta ログ形式は Iceberg にそのまま適用しない。

## 2. 構成と役割

- **設定・運用**：クラスタリング列や自動選択、手動 OPTIMIZE の方針を指定する。
- **クエリの傾向**：自動選択で検索条件などの傾向を分析する。実行中の個別検索と区別する。
- **キーの選択**：手動指定または対象環境の自動選択。自動選択は Predictive Optimization と条件を要し、キーが選ばれない場合もある。
- **配置方針の保存**：Delta の domainMetadata に delta.clustering と clusteringColumns を記録する。
- **再配置の実行**：対象ファイルを読みクラスタリング列に沿って再編成する。通常は増分で、FULL は必要に応じ既存の配置も見直す。
- **対象ファイルの選択**：クエリ条件とファイル統計から候補を絞る。範囲が重なるファイルは候補に残る。
- **効果・コストの確認**：スキャンしたファイル数や時間と、保守の実行履歴・費用を比較する。
- **変更前のファイル**：現行スナップショットの対象 Parquet ファイル。キー変更だけではただちに書き換わらない。
- **再配置後のファイル**：OPTIMIZE が必要に応じ書き出す Parquet ファイル。レコード集合をキーの局所性に沿って配置する。
- **表のバージョンと統計**：Delta ログの add / remove と統計で有効ファイルを決める。クラスタリングされた add に provider を記録する。
- **ファイルごとの値域**：各ファイルの最小値・最大値など。範囲が狭くなると条件に合わないファイルを除外しやすい。

## 3. Delta ログとファイル配置

Delta Lake の clustered table 仕様は writer version 7、writerFeatures の clustering と domainMetadata を要求する。クラスタリング列は domainMetadata の delta.clustering / configuration に保持し、column mapping 有効時は物理列名を使う。クラスタリング列には必要なファイル・列統計が必要で、配置済みファイルの add action には clusteringProvider を記録する。これは公開プロトコル上の要件であり、選択アルゴリズムや実行時内部の完全な説明ではない。

OPTIMIZE は必要な Parquet ファイルを読み、キーに沿って新たなファイルへ再配置する。成功した Delta のコミットで新旧ファイルの add / remove と統計が表の状態に反映される。旧ファイルの物理削除は別の VACUUM と保持設定に依存し、コミットと同時の即時削除とは限らない。読み手は対象スナップショットの有効ファイルとファイル統計を使う。

Databricks の技術ブログは、Delta ではファイル一覧と列統計をトランザクションログから取得し、ディレクトリ名の走査ではなくファイル単位の統計で読み飛ばすと説明している。また、低カーディナリティの `date` と高カーディナリティの `user_id` をキーにした例では、1ファイル内の日付をそろえることを目指し、その中を `user_id` で細かく整理する最適化を紹介している。これは製品側が採る配置の例であり、すべてのファイルの値域や実装アルゴリズムを保証する仕様ではない。ブログで紹介されるメタデータだけでの DELETE や集計も、クエリと統計が条件を満たす場合に限る。[Databricks 技術ブログ](https://www.databricks.com/blog/debunking-8-data-layout-myths-why-liquid-clustering-outperforms-partitioning)

## 4. キー変更と FULL

CLUSTER BY によるキーの変更自体は既存ファイルを書き換えない。その後の書き込みと通常の OPTIMIZE は新しい方針を使うが、既に他のキーでクラスタリングされたファイルがすべて更新されるとは限らない。既存の配置を現在のキーに合わせる必要がある場合、対応ランタイムで OPTIMIZE FULL を検討する。FULL も条件に従い必要な書き換えを行う。公式ガイドは 16.4 LTS 以上を案内し、16.0 のリリースノートにも当該機能の記述があるため、実際に使用する製品・ランタイムの対応を確認する。

## 5. AUTO と実行時の考慮

CLUSTER BY AUTO は対応する Unity Catalog 管理 Delta テーブルでワークロードを分析し、効果と費用に応じてキーを選ぶ。キーが選択されない場合がある。自動選択と配置には Predictive Optimization が必要で非同期に処理する。クラスタリング列は統計対象とし、最大 4 列。手動指定・階層指定や対応するランタイム、既存の partitioning / ZORDER との互換性を確認する。書き換え、保守、旧ファイルの保持に費用が生じるため、Query Profile と保守履歴で効果と費用を比較する。

## 6. 実装例：AWS と Databricks

管理者が Unity Catalog 管理 Delta テーブルにクラスタリングを設定する。例では顧客 AWS アカウントの S3 管理ストレージに Delta ログと Parquet を保持し、Predictive Optimization が対象と判断した保守を Databricks の serverless jobs compute で実行する。ユーザーの BI SQL は SQL Warehouse で読み取る。手動 OPTIMIZE の実行先は対応する計算環境を別途選ぶ。S3 のアクセス権、Unity Catalog の権限、serverless の利用条件は事前に設定する。公式資料を組み合わせた構成例で、動作検証済みの導入事例ではない。

| 機能 | 担い手 | 役割 |
| --- | --- | --- |
| 設定・運用 | 管理者の SQL | クラスタリング列や自動選択、手動 OPTIMIZE の方針を指定する。 |
| クエリの傾向 | 管理テーブルのクエリ履歴 | 自動選択で検索条件などの傾向を分析する。実行中の個別検索と区別する。 |
| キーの選択 | 自動 Liquid Clustering | 手動指定または対象環境の自動選択。自動選択は Predictive Optimization と条件を要し、キーが選ばれない場合もある。 |
| 配置方針の保存 | Delta の clustering メタデータ | Delta の domainMetadata に delta.clustering と clusteringColumns を記録する。 |
| 再配置の実行 | Serverless Jobs の OPTIMIZE | 対象ファイルを読みクラスタリング列に沿って再編成する。通常は増分で、FULL は必要に応じ既存の配置も見直す。 |
| 対象ファイルの選択 | SQL Warehouse の data skipping | クエリ条件とファイル統計から候補を絞る。範囲が重なるファイルは候補に残る。 |
| 効果・コストの確認 | Query Profile と保守履歴 | スキャンしたファイル数や時間と、保守の実行履歴・費用を比較する。 |
| 変更前のファイル | S3 の旧 Parquet ファイル | 現行スナップショットの対象 Parquet ファイル。キー変更だけではただちに書き換わらない。 |
| 再配置後のファイル | S3 の新 Parquet ファイル | OPTIMIZE が必要に応じ書き出す Parquet ファイル。レコード集合をキーの局所性に沿って配置する。 |
| 表のバージョンと統計 | S3 の Delta transaction log | Delta ログの add / remove と統計で有効ファイルを決める。クラスタリングされた add に provider を記録する。 |
| ファイルごとの値域 | add action のファイル統計 | 各ファイルの最小値・最大値など。範囲が狭くなると条件に合わないファイルを除外しやすい。 |

## 7. 未公開事項と注意

製品内部の全ての配置最適化アルゴリズム、実行部品の配置や選択閾値は資料だけでは特定できない。公開プロトコル上の要件、Databricks 固有の自動選択、図の説明用の値域を区別する。クラスタリングした Delta テーブルで利用される追加機能により、クライアントの protocol / table feature 対応要件が変わる。既存ツールとの互換性を確認する。

## 類似するデータ配置の仕組み

比較画面では Snowflake の Classic / Optima 詳細図と並べ、キー設定、再配置前後のデータ、表の状態と統計、保守の観測を対応付ける。Snowflake 側の具体的な再配置手順は 2024 年に公開された Classic の例であり、Optima の内部アルゴリズムとの同一性を示すものではない。Delta 側では `add` / `remove` によりスナップショットを更新する一方、Snowflake 側の内部メタデータ形式は公開資料からは特定できない。

以下は検索条件に合うデータを近くに配置し、読み取る範囲を減らすという観点の比較。保存形式や自動化の範囲が同一という意味ではない。2026年11月24日時点の公開資料に基づく。

| 技術 | 配置・絞り込みの単位 | キーと保守 | 注意点 |
| --- | --- | --- | --- |
| Databricks Liquid Clustering | Delta データファイルとファイル単位の統計 | 手動キーまたは対応する管理表の AUTO。Predictive Optimization や手動 OPTIMIZE で保守 | キー変更だけでは既存データを書き換えない。対応条件と書き換え・保守費用を確認する |
| Snowflake Automatic Clustering / Optima Clustering | Snowflake 管理テーブルの micro-partition と列統計 | 指定したクラスタリングキーに基づきサービス側で再編成。Optima の AUTO キー選択は 2026年10月の公式ブログ時点で private preview | 2026年9月以降に新たにクラスタリングされた多くの表では Optima、既存表は Classic が継続。費用体系が異なる |
| BigQuery Clustering | ストレージブロックのメタデータで block pruning | 利用者が最大4列のクラスタリング列を指定し、サービスがバックグラウンドで再クラスタリング | パーティションと併用可能。既存の非クラスタ化表を変更した場合、既存データが自動的にクラスタ化されるとは限らない |
| Amazon Redshift Automatic Table Optimization | ソートされた列のブロックと min / max | SORTKEY AUTO でワークロードを踏まえキーを自動選択。自動ソートが配置を維持 | 分散キーの自動選択は別の役割。表の設定や自動化の対象を確認する |
| Apache Iceberg の rewrite_data_files | データファイル、manifest などの統計 | Spark の rewrite_data_files の sort / Z-order 等で明示的に再書き込み。Iceberg 1.12 では Spark 4.1 向け Hilbert も追加 | Iceberg の仕様・保守操作自体は Databricks AUTO のようなワークロードに応じたキー自動選択を意味しない |
| ClickHouse MergeTree | ソートキーと疎な primary index、granule | ORDER BY に基づき各 part を並べ、背景マージで維持 | キーを自動選ぶ仕組みとしてではなく、固定した順序を使った類似の読み取り最適化として比較する |

出典：[Snowflake Optima Clustering](https://www.snowflake.com/en/blog/engineering/introducing-snowflake-optima-clustering/)、[Snowflake のクラスタリング費用](https://docs.snowflake.com/en/user-guide/tables-auto-reclustering)、[BigQuery clustered tables](https://docs.cloud.google.com/bigquery/docs/clustered-tables)、[Redshift automatic table optimization](https://docs.aws.amazon.com/redshift/latest/dg/c_ato-enabling-disabling-monitoring.html)、[Iceberg 1.12](https://iceberg.apache.org/blog/apache-iceberg-1.12.0-release/)、[ClickHouse query optimization](https://clickhouse.com/resources/engineering/clickhouse-query-optimisation-definitive-guide)。

## 公式資料

- [Liquid clustering](https://docs.databricks.com/aws/en/tables/clustering)
- [Delta clustered table protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md#clustered-table)
- [Data skipping](https://docs.databricks.com/aws/en/tables/data-skipping)
- [Predictive optimization](https://docs.databricks.com/aws/en/optimizations/predictive-optimization)
- [Optimize data file layout](https://docs.databricks.com/aws/en/tables/operations/optimize)
- [Delta protocol compatibility](https://docs.databricks.com/aws/en/delta/feature-compatibility)
- [Managed storage](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)
- [Data + AI Summit: Liquid Clustering](https://answers.databricks.com/delta-lake-liquid-clustering-lightning-fast-queries-massive-datasets-2w50YGvW8TM)
- [Liquid Clustering のデータ配置とファイル統計](https://www.databricks.com/blog/debunking-8-data-layout-myths-why-liquid-clustering-outperforms-partitioning)
