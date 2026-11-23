# Databricks Unity Catalog：外部エンジンへの一時認証

## 1. 対象と前提

外部エンジンが Unity Catalog から一時認証情報を取得し、管理された表へアクセスする経路を追う。 公式資料を組み合わせた説明用のモデルで、実機の配置や導入事例ではない。

## 2. 構成と役割

- **外部エンジン**：外部の互換エンジンが認証してテーブルへのアクセスを要求する。
- **認証と権限判定**：プリンシパルの権限と外部アクセス設定を確認する。
- **テーブル解決**：対応する API を通じて対象の表情報を提供する。
- **短期認証情報**：要求されたテーブルや操作に応じた一時的なストレージ認証情報を発行する。
- **認証情報の更新**：長時間処理では対応クライアントが認証情報を更新する。
- **メタデータとデータ**：エンジンは取得した資格情報を使ってクラウドストレージ上のファイルにアクセスする。
- **書き込みの調整**：対応する管理 Delta テーブルの外部書き込みでは catalog commits による調整が必要。

## 3. 処理の流れ

1. 外部エンジンを認証し、権限を確認して一時資格情報を返す。
2. ストレージに直接アクセスし、対応クライアントは期限前に更新する。
3. 対応する管理 Delta テーブルへの書き込みではカタログがコミットを調整する。

Unity Catalog はプリンシパルの権限と要求した操作を確認し、表またはパスに対する短期認証情報を発行する。クライアントとストレージへのネットワーク到達性、EXTERNAL USE SCHEMA などの必要な権限、対応するテーブルとクライアントを確認する。管理 Delta への外部書き込みの catalog commits は、ファイルに直接書けることだけでは置き換えられない。

## 4. 留意点

アクセス可能な表種・読み書き・外部クライアントは異なる。行フィルターや列マスクのある表など、credential vending の対象外がある。managed Delta の外部書き込みには catalog commits と対応クライアントが必要。

## 5. 実装例

外部の互換 Iceberg エンジンが Unity Catalog に認証して一時資格情報を受け取り、顧客 AWS アカウントの S3 にある管理 Iceberg テーブルにアクセスする概念例。外部アクセス設定と必要な権限、クライアントの対応を事前に確認する。

| 機能 | 担い手 |
| --- | --- |
| 外部エンジン | 外部 Spark / Iceberg エンジン |
| 認証と権限判定 | Unity Catalog |
| テーブル解決 | Unity / Iceberg REST API |
| 短期認証情報 | credential vending |
| 認証情報の更新 | 対応クライアントの更新処理 |
| メタデータとデータ | 顧客 S3 のテーブル |
| 書き込みの調整 | catalog commits（対応時） |

## 公式資料

- [Unity Catalog credential vending](https://docs.databricks.com/aws/en/external-access/credential-vending)
- [Unity Catalog Open APIs](https://www.databricks.com/blog/expanded-interoperability-unity-catalog-open-apis)
- [Unity Catalog の管理ストレージ](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)
