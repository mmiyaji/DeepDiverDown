# Databricks：Deletion Vector と Delta の更新

## 1. 対象と前提

Parquet ファイルを書き換えずに行を無効化し、読み取り時に反映する仕組みを追う。 公式資料を組み合わせた説明用のモデルで、実機の配置や導入事例ではない。

## 2. 構成と役割

- **行の変更要求**：DELETE / UPDATE / MERGE の変更を要求する。
- **変更対象の判定**：条件に一致する行を特定する。
- **既存ファイル**：元の Parquet データファイルは論理削除後も直ちに書き換えられない。
- **無効な行の位置**：Deletion Vector はデータファイル内で無効になった行の位置を記録する。
- **変更後の行**：UPDATE / MERGE では新しい行を別途書き込む場合がある。
- **表のバージョン**：Delta ログは有効なファイルとその deletion vector の参照を持つスナップショットを定義する。
- **結果の読み取り**：スナップショットのファイルを読み、ベクトルで無効な位置を除外する。
- **物理的な再書き込み**：REORG TABLE APPLY PURGE 等で対象ファイルの論理削除を物理データに反映できる。
- **古いファイルの削除**：保持期間などの条件を満たした不要ファイルは VACUUM で削除する。

## 3. 処理の流れ

1. 変更対象を特定し、無効な行位置と必要な新しい行をコミットする。
2. 読み手はスナップショットを参照し、無効な位置を除いて結果を返す。
3. 物理的な書き換えと古いファイルの削除は別の処理・保持条件に従う。

Deletion Vector は Parquet ファイル内の無効な行位置を表す。Delta の add action は対象ファイルの deletion vector を参照し、読み手は対象スナップショットで有効な行を判断する。データ変更後の新しい行と、旧ファイルの無効化は別の要素である。PURGE による書き換え後も古いファイルは保持され得るため、適切な保持期間を経た VACUUM が別途必要になる。

## 4. 留意点

Delta の deletion vector は行位置を表す。すべての OPTIMIZE が全ベクトルを物理適用する保証はなく、REORG の PURGE と旧ファイルの VACUUM は別段階。テーブル機能とクライアントの対応バージョンを確認する。Iceberg の deletion vector は別仕様として扱う。

## 5. 実装例

Databricks SQL Warehouse と Unity Catalog 管理 Delta テーブルを使い、顧客 AWS アカウントの S3 にデータと Delta ログを保存する概念例。機能を有効にした表への更新と読み取りの後、必要に応じ物理再書き込みと保持期間後の削除を行う。

| 機能 | 担い手 |
| --- | --- |
| 行の変更要求 | SQL の DELETE / UPDATE / MERGE |
| 変更対象の判定 | Databricks Runtime の変更処理 |
| 既存ファイル | S3 の Parquet ファイル |
| 無効な行の位置 | Deletion Vector |
| 変更後の行 | 新しい Parquet ファイル |
| 表のバージョン | Delta transaction log |
| 結果の読み取り | Delta reader / SQL Warehouse |
| 物理的な再書き込み | REORG TABLE APPLY PURGE |
| 古いファイルの削除 | VACUUM |

## 公式資料

- [Deletion vectors の仕様](https://docs.databricks.com/aws/en/tables/features/deletion-vectors)
- [Delta Lake protocol: Deletion Vectors](https://github.com/delta-io/delta/blob/master/PROTOCOL.md#deletion-vectors)
- [Delta Lake の内部構造](https://community.databricks.com/t5/technical-blog/delta-lake-under-the-hood-what-every-data-engineer-should-know/ba-p/156311)
- [Unity Catalog 管理ストレージ](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)
