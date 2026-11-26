# Databricks Unity Catalog の権限・ストレージ・リネージ

## 1. 対象

メタストアがカタログを管理し、カタログの下にスキーマ、その下にテーブルなどの資産を置く。通常の名前解決は catalog.schema.table。例では受注本番を prod.sales.orders とする。

## 2. 権限と実行場所

注文本番カタログを本番ワークスペースに限定する。利用ロールに USE CATALOG、USE SCHEMA、SELECT を必要に応じて設定し、ワークスペース・バインディングの制約も確認する。行フィルタ、列マスク、タグ駆動ポリシーは適用範囲と実行要件を確認して設計する。

## 3. ファイルの管理責任

管理テーブルでは Unity Catalog が基盤ファイルの位置とライフサイクルを管理する。外部テーブルでは、外部ロケーションがパスとストレージ資格情報を対応付ける。DROP 時に外部ファイルは残る。管理テーブルのファイル削除は回復期間を含むライフサイクルに従う。

## 外部エンジンからの接続

Spark や Trino などの外部エンジンは、Unity Catalog の Iceberg REST カタログ API を通してテーブルにアクセスできる。権限があるテーブルには、Unity Catalog が一時的なストレージ認証情報を発行する。詳細な経路は図 databricks-unity-vended-credentials で扱う。

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

## 5. 実装例 Unity Catalog と AWS S3 の本番管理

本番カタログを本番ワークスペースに束縛し、管理テーブルと外部着地表の保存責任を分ける例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 分析ワークスペース | Databricks 本番ワークスペース | 本番カタログを利用するワークスペースを制限する。 |
| 統制メタストア・本番カタログと業務スキーマ | Unity Catalog のメタストアと prod.sales | カタログ、スキーマ、権限を管理する。 |
| 管理ストレージ上の注文表 | prod.sales.orders 管理 Delta テーブル | サービスがデータライフサイクルを管理する。 |
| 外部ファイルを登録した注文表 | prod.sales.orders_landing 外部表 | 外部ロケーションのファイルを表として登録する。 |
| 保存パスとアクセス資格情報 | Unity Catalog 外部ロケーションと Storage Credential | アクセスを許可する S3 パスと認証主体を関連付ける。 |
| クラウドストレージ | Amazon S3 の着地・管理領域 | 外部ファイルと管理テーブル用の保存先を分ける。 |
| 参照クエリ／BI | 分析者用 SQL Warehouse | 許可された表と、マスクされた列の出力を参照する。 |
| 列リネージ | Unity Catalog リネージと system.access の履歴 | 対応する処理で記録されたテーブル・列の依存を確認する。 |

ワークスペースの束縛とオブジェクト権限を両方確認する。外部着地と管理ストレージには別々の S3 プレフィックスを割り当て、Storage Credential の IAM ロールには用途別のアクセスを設定する。外部ファイルを更新する処理には着地領域の権限を与え、管理領域への直接アクセスは付与しない。分析者には SQL Warehouse の使用と、許可したカタログ・スキーマ・表の権限を付与する。

出典 [Unity Catalog のアクセス制御](https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control)、[ワークスペース・バインディング](https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control/workspace-catalog-binding)、[管理／外部テーブルの指針](https://docs.databricks.com/aws/en/data-governance/unity-catalog/best-practices)、[オブジェクトストレージのライフサイクル](https://docs.databricks.com/aws/en/data-governance/unity-catalog/object-storage-lifecycle)、[Unity Catalog のリネージ](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage)、[Databricks の S3 外部ロケーション](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/s3)、[Databricks のリネージシステムテーブル](https://docs.databricks.com/aws/en/admin/system-tables/lineage)

この例の SQL Warehouse は Databricks 管理のサーバーレス計算プレーンで動く。利用者はワークスペースのバインディング、テーブル、外部ロケーション、資格情報、マスキングと権限を設定できるが、サーバーレス内部ノードを直接操作しない。管理テーブルと外部表は論理オブジェクトで、実ファイルは顧客 AWS の別々の S3 領域にある。AWS は S3 基盤を管理し、利用者はアクセス権と外部ファイルのライフサイクルを管理する。公式資料を組み合わせた例で、構成の実動作は未検証。[Databricks architecture](https://docs.databricks.com/aws/en/security/network/deployment-architecture/)、[Managed storage](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)
