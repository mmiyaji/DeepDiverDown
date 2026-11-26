# Databricks Delta：Liquid Clustering・Deletion Vector・ファイル読み飛ばし

## 1. 対象と前提

Unity Catalog 管理 Delta テーブルを題材に、ファイルの配置（Liquid Clustering）、行の論理削除（Deletion Vector）、読み取り時のファイル絞り込み（ファイル統計と Dynamic File Pruning）を Delta ログを軸に追う。図は公開情報を組み合わせた概念例で、実際のファイル数、値域、実行順序、内部サービスの物理配置を保証しない。Managed Iceberg にも Liquid Clustering があるが、Delta ログ形式は Iceberg にそのまま適用しない。2026 年 11 月時点の公式資料に基づく。

## 2. 構成と役割

- **利用者の SQL**：CLUSTER BY の設定、OPTIMIZE、DELETE / UPDATE / MERGE、条件付き検索を発行する。
- **クエリ履歴と AUTO のキー選択**：CLUSTER BY AUTO は検索条件などの傾向を分析する。Predictive Optimization と条件を要し、キーが選ばれない場合もある。
- **再配置・書き換えの実行**：OPTIMIZE は対象ファイルをクラスタリング列に沿って再編成する。通常は増分で、FULL は既存の配置も見直す。REORG TABLE APPLY PURGE は Deletion Vector を適用して書き換える。
- **ファイル統計による読み飛ばし**：クエリ条件とファイルごとの最小値・最大値から候補を絞る。
- **JOIN の実行時キーによる絞り込み**：Dynamic File Pruning。小さい側の結果から得たキーで大きい側のファイルを絞る。
- **変更前・再配置後の Parquet ファイル**：キー変更だけでは既存ファイルは書き換わらない。
- **Deletion Vector**：Parquet を書き換えず、無効にした行の位置だけを記録する。
- **Delta ログ**：add / remove、DV の参照、ファイル統計、clustering 設定を保持し、スナップショットの有効ファイルを決める。

## 3. Delta ログとファイル配置

clustered table の仕様は writer version 7、writerFeatures の clustering と domainMetadata を要求する。クラスタリング列は domainMetadata の delta.clustering に保持し、列にはファイル・列統計が必要で、配置済みの add action には clusteringProvider を記録する。これは公開プロトコル上の要件で、選択アルゴリズムや内部の完全な説明ではない。

OPTIMIZE は Parquet を読み、キーに沿って新しいファイルへ再配置する。コミットで新旧ファイルの add / remove と統計が表の状態に反映される。旧ファイルの物理削除は VACUUM と保持設定に依存し、コミットと同時とは限らない。読み手は対象スナップショットの有効ファイルと統計を使う。Databricks の技術ブログは、ファイル一覧と列統計をトランザクションログから取得し、ファイル単位の統計で読み飛ばすと説明している。[Databricks 技術ブログ](https://www.databricks.com/blog/debunking-8-data-layout-myths-why-liquid-clustering-outperforms-partitioning)

## 4. キー変更・FULL・AUTO

CLUSTER BY によるキー変更は既存ファイルを書き換えない。後続の書き込みと通常の OPTIMIZE は新しい方針を使うが、他のキーで配置済みのファイルがすべて更新されるとは限らない。既存の配置を合わせるには OPTIMIZE FULL を使う（16.0 以上。公式ページでは大きな表で数時間かかる場合があると説明）。FULL WHERE による部分的な再配置は 18.1 以上と記載されている。クラスタリング列は最大 4 列で、パーティションや ZORDER とは併用できない。

CLUSTER BY AUTO は対応する Unity Catalog 管理 Delta テーブル（15.4 LTS 以上）で、予測される読み飛ばしの効果が保守の費用を上回る場合にキーを変える。Predictive Optimization が必要で、非同期に処理される。2026 年 11 月時点の公式ページには、Iceberg v3 管理テーブルへの対応（18.0 以上）、マテリアライズドビューとストリーミングテーブルへの自動クラスタリングの適用、階層的クラスタリング（17.1 以上）が記載されている。書き換え・保守・旧ファイルの保持には費用が生じる。

## 5. Deletion Vector

DELETE / UPDATE / MERGE で、Deletion Vector を有効にした表は Parquet を書き換えずに無効な行の位置を記録し、add action が DV を参照する。UPDATE / MERGE の新しい行は別に書き込まれる。読み手はスナップショットのファイルを読み、DV の位置を除く。クラスタリングを有効にした表では DV が既定で有効になる。無効にすると行レベルの同時実行制御も無効になり、競合が増える場合がある。

物理的な反映は別段階である。REORG TABLE APPLY PURGE が DV を適用して書き換え、旧ファイルの削除は保持期間を経た VACUUM による。OPTIMIZE がすべての DV を物理適用する保証はない。Delta の DV は行位置を表し、Iceberg の DV は別仕様として扱う。テーブル機能とクライアントの対応バージョンを確認する。

## 6. Dynamic File Pruning

JOIN で小さい側のフィルター結果は実行前には分からない。実行時に得た JOIN キーを大きい側のファイル選択に渡し、Delta ログのファイル単位の統計と照合して候補外のファイルを読み飛ばす。同じキーが多くのファイルに散らばる配置では、読み飛ばせる割合は小さくなる。Liquid Clustering による値域の整理が効果に影響する。適用はテーブルとクエリの形状、対象サイズなどの条件による。MERGE / UPDATE / DELETE での適用には Photon が必要とされていたが、現行の条件は 2026 年 11 月時点では再確認していない（未確認）。

## 7. 実装例：AWS と Databricks

Unity Catalog 管理 Delta テーブルの Parquet・DV・ログを顧客 AWS アカウントの S3 管理ストレージに置く。検索は SQL Warehouse が実行し、Predictive Optimization の保守は Databricks のサーバーレス Jobs で実行する。手動 OPTIMIZE の実行先は対応する計算環境を別途選ぶ。S3 のアクセス権、Unity Catalog の権限、サーバーレスの利用条件は事前に設定する。公式資料を組み合わせた構成例で、動作検証済みの導入事例ではない。

| 機能 | 担い手 |
| --- | --- |
| 利用者の SQL | SQL Editor・ジョブ |
| クエリ履歴と AUTO のキー選択 | 自動 Liquid Clustering |
| 再配置・書き換えの実行 | Serverless Jobs の OPTIMIZE・REORG |
| ファイル統計による読み飛ばし | SQL Warehouse の data skipping |
| JOIN の実行時キーによる絞り込み | Dynamic File Pruning |
| 変更前の Parquet ファイル | S3 の旧 Parquet ファイル |
| 再配置後の Parquet ファイル | S3 の新 Parquet ファイル |
| Deletion Vector | S3 の Deletion Vector |
| Delta ログ | S3 の Delta transaction log |

## 8. 未確認

実環境のファイル数、読み飛ばし率、保守費用は未検証。Dynamic File Pruning の適用条件の最新版は未確認。製品内部の配置アルゴリズムと選択閾値は公開資料から特定できない。

## 公式資料

- [Liquid clustering](https://docs.databricks.com/aws/en/tables/clustering)
- [Delta clustered table protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md#clustered-table)
- [Deletion vectors](https://docs.databricks.com/aws/en/tables/features/deletion-vectors)
- [Delta Lake protocol: Deletion Vectors](https://github.com/delta-io/delta/blob/master/PROTOCOL.md#deletion-vectors)
- [Data skipping](https://docs.databricks.com/aws/en/tables/data-skipping)
- [Dynamic file pruning](https://docs.databricks.com/aws/en/optimizations/dynamic-file-pruning)
- [Predictive optimization](https://docs.databricks.com/aws/en/optimizations/predictive-optimization)
- [Optimize data file layout](https://docs.databricks.com/aws/en/tables/operations/optimize)
- [Delta protocol compatibility](https://docs.databricks.com/aws/en/delta/feature-compatibility)
- [Managed storage](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)
