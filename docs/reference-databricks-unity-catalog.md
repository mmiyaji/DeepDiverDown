# Databricks Unity Catalog の権限・ストレージ・リネージ

## 1. 対象

メタストアがカタログを管理し、カタログの下にスキーマ、その下にテーブルなどの資産を置く。通常の名前解決は catalog.schema.table。例では受注本番を prod.sales.orders とする。

## 2. 権限と実行場所

注文本番カタログを本番ワークスペースに限定する。利用ロールに USE CATALOG、USE SCHEMA、SELECT を必要に応じて設定し、ワークスペース・バインディングの制約も確認する。行フィルタ、列マスク、タグ駆動ポリシーは適用範囲と実行要件を確認して設計する。

## 3. ファイルの管理責任

管理テーブルでは Unity Catalog が基盤ファイルの位置とライフサイクルを管理する。外部テーブルでは、外部ロケーションがパスとストレージ資格情報を対応付ける。DROP 時に外部ファイルは残る。管理テーブルのファイル削除は回復期間を含むライフサイクルに従う。

## 4. リネージと可視性

対応する実行経路ではリネージを収集し、テーブルや列、クエリ、ノートブック、ダッシュボードとの関係を表示できる。対象にアクセスできる権限と捕捉範囲を前提に、改名する金額列がどこで使われるかを調べる。

## 図で確認するシナリオ

- **本番ワークスペースで受注テーブルを参照** — 本番カタログを許可されたワークスペースで解決する。 → 必要権限を満たす利用者に制御を適用した結果を返す。 → 捕捉対象のクエリから金額列の下流を調べる。
- **管理テーブルと外部テーブルの削除範囲を比較** — 外部ロケーション経由で既存ファイルへの参照を登録する。 → 管理テーブルの削除時はファイルも回復期間を経るライフサイクルの対象となる。 → 外部テーブルを削除しても基盤ファイルの削除は外部で管理する。

## 公式資料

- [Unity Catalog のアクセス制御](https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control)
- [ワークスペース・バインディング](https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control/workspace-catalog-binding)
- [管理／外部テーブルの指針](https://docs.databricks.com/aws/en/data-governance/unity-catalog/best-practices)
- [オブジェクトストレージのライフサイクル](https://docs.databricks.com/aws/en/data-governance/unity-catalog/object-storage-lifecycle)
- [Unity Catalog のリネージ](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage)
