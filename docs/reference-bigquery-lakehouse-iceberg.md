# BigQuery：Iceberg レイクハウス（旧 BigLake）

2026 年 11 月時点の公式資料に基づく。GA と Preview の区分は資料の記載のみを写し、記載のない項目は「未確認」とする。

## 1. 範囲
利用者の Cloud Storage に置いた Apache Iceberg テーブルを、BigQuery と外部エンジンが共有する経路を示す。ネイティブ表のストレージは [BigQuery：Capacitor とストレージの最適化](reference-bigquery-storage-optimization.md) で扱う。

## 2. 名称
BigLake の名称は変わっている。取得した REST カタログの資料は「Lakehouse ランタイムカタログ」の Apache Iceberg REST カタログエンドポイントと記す。エンドポイントの URL とサービス名は引き続き biglake.googleapis.com で、API 名には BigLake が残る。「Lakehouse for Apache Iceberg」「BigLake metastore」との名称の対応は、公式の改称告知を確認できていないため未確認。

出典 [Apache Iceberg REST catalog endpoint](https://docs.cloud.google.com/bigquery/docs/blms-rest-catalog)

## 3. Iceberg 管理テーブル
データは利用者が所有する Cloud Storage バケットに置く。DML、Storage Write API での取り込み、スキーマ変更、自動のストレージ最適化（適応的なファイルサイズ、自動クラスタリング、ガベージコレクション、メタデータ最適化）、タイムトラベル、行・列のセキュリティ、複数文トランザクション、パーティション（DATE・DATETIME・TIMESTAMP のみ）、クラスタリング（最大 4 列）が使える。マテリアライズドビュー、テーブルクローン、フェイルセーフ、抽出ジョブ、認可ビューは使えない。メタデータの自動更新は資料上、問い合わせ窓口への連絡が必要で、セルフサービスではない。

出典 [Apache Iceberg managed tables in BigQuery](https://docs.cloud.google.com/bigquery/docs/iceberg-tables)

## 4. Iceberg REST カタログ
エンドポイントは https://biglake.googleapis.com/iceberg/v1/restcatalog で、リージョン別の形もある。以前の「BigQuery 用カスタム Iceberg カタログ」エンドポイントは既存のワークロードで使える。カタログは複数バケット型（推奨）と単一バケット型（新規では非推奨）がある。制約は、Iceberg V1 テーブルは非対応、Parquet のみ、metadata.json は 1 MB まで、REST カタログ経由のテーブルに行・列レベルのセキュリティは使えないこと。

出典 [Apache Iceberg REST catalog endpoint](https://docs.cloud.google.com/bigquery/docs/blms-rest-catalog)

## 5. 外部エンジンと認証情報の払い出し
Spark と Trino が接続できる。クライアントがヘッダー X-Iceberg-Access-Delegation に vended-credentials を指定すると、カタログがストレージへのアクセス権を委譲する。カタログのサービスアカウントにバケットの roles/storage.objectUser が必要で、Trino は 481 以降が必要。オープンソースの Iceberg 1.10 以降は GoogleAuthManager を内蔵する。

出典 [Apache Iceberg REST catalog endpoint](https://docs.cloud.google.com/bigquery/docs/blms-rest-catalog)

## 6. シナリオ
BigQuery が Iceberg 管理テーブルへ書き込み、カタログに登録する。外部エンジンがカタログに問い合わせ、認証情報の払い出しを受け、バケットのメタデータとデータファイルを直接読む。

## 7. 実装例 BigQuery と Spark の Iceberg 共有
| 機能 | 担い手 | 設定 |
|---|---|---|
| SQL・取り込み | BigQuery | Iceberg 管理テーブルへ書く |
| カタログ | Lakehouse ランタイムカタログ | REST エンドポイント |
| 認証情報の払い出し | カタログのサービスアカウント | バケットの storage.objectUser |
| 外部エンジン | Managed Service for Apache Spark 上の Spark | Iceberg 1.10 以降 |
| データ | Cloud Storage バケット | Parquet とメタデータ |

リリース段階は 2026 年 11 月時点の資料で、Iceberg V2 テーブルは GA、V3 テーブルと BigQuery の DDL・DML 経由でのテーブル作成・変更は Preview。DDL・DML の利用にはテーブルプロパティ gcp.biglake.bigquery-dml.enabled が必要。管理テーブル側の各機能の段階は資料に記載がなく未確認。クロスリージョンのレプリケーションと障害復旧は機能として列挙されているが段階は未確認。公式資料を組み合わせた未検証の構成例である。

## 8. 未確認
- 名称の対応（Lakehouse for Apache Iceberg、BigLake metastore）。
- 管理テーブルの機能の GA・Preview 区分。
- 外部エンジンの読み取り性能と整合の遅延。

## 9. 参考資料
- [Apache Iceberg managed tables in BigQuery](https://docs.cloud.google.com/bigquery/docs/iceberg-tables)
- [Apache Iceberg REST catalog endpoint](https://docs.cloud.google.com/bigquery/docs/blms-rest-catalog)
