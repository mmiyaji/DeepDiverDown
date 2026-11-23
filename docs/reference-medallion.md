# メダリオンアーキテクチャ

## 1. 三層の役割

Bronze、Silver、Gold はデータの整備段階を表す。受注 CDC が入力の例で、実装製品と更新間隔は設計で決める。

## 2. Bronze

原本に近い形で保持する。変換ルール修正後は保持範囲から再処理できる。

## 3. Silver

通貨や時刻の表現を揃え、注文 ID と変更順序で重複や古い変更を処理する。無効行は隔離する。

## 4. Gold

日付・通貨単位の売上を集計する。訂正時は影響日の集計を更新する。

## 公式資料

- [Databricks · Medallion lakehouse architecture](https://docs.databricks.com/aws/en/lakehouse/medallion)

## 5. 実装例：Lakeflow・Delta Lake・Databricks SQL

業務側が出力した注文変更の JSON ファイルを Amazon S3 から Auto Loader で増分取り込みする例。Databricks のサーバーレス Lakeflow Spark Declarative Pipelines で検証・整形し、Databricks SQL Warehouse で Gold を参照する。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| 受注 CDC | Amazon S3 の変更ファイルと Auto Loader | 主キー、変更種別、並び順を含むイベントを増分で取り込む。 |
| Bronze・原本 | Bronze の Delta ストリーミングテーブル | 元の受注イベントを追記する。 |
| 検証・正規化 | Lakeflow Spark Declarative Pipelines | 検証条件で有効行と隔離行を分け、必要に応じて変更を適用する。 |
| 隔離テーブル | 無効行を保持するストリーミングテーブル | 調査と再処理に必要な行を残す。 |
| Silver・受注明細 | Silver の整形済み Delta テーブル | 検証後の正規化した注文の状態を保持する。 |
| Gold・日次売上 | Gold の日次売上マテリアライズドビュー | 日付・通貨別の集計を提供する。 |
| BI | Databricks SQL Warehouse と AI/BI ダッシュボード | SQL Warehouse が Gold を読み取り、ダッシュボードに日次売上を表示する。 |
| 実装で追加 | Lakeflow パイプラインイベントログ | 検証結果や更新状態を記録する。 |

入力用 S3 には Unity Catalog の外部ロケーションを設定し、ストレージ資格情報の IAM ロールで対象領域へのアクセスを許可する。Bronze、隔離、Silver、Gold は別の S3 領域に設定した Unity Catalog の管理ストレージに保持する。パイプライン実行主体には入力の読み取りと管理テーブルの作成・更新、BI の実行主体には Gold の参照を許可する。

隔離は検証条件の正・逆を使う二つのフローで構成する。Delta の Bronze は後から再処理できるよう原本を保持する。Silver の AUTO CDC には主キー、同一キー内の変更順序、削除条件を設定する。

- [Auto Loader による Amazon S3 の増分取り込み](https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/onboard-data)
- [Unity Catalog 管理ストレージ](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)
- [AUTO CDC による変更適用](https://docs.databricks.com/aws/en/ldp/cdc)

[Databricks · Medallion lakehouse architecture](https://docs.databricks.com/aws/en/lakehouse/medallion)、[How to use Spark Declarative Pipelines on Lakeflow](https://docs.databricks.com/aws/en/ldp/concepts/how-to-use-pipelines)、[Lakeflow best practices: Quarantine](https://docs.databricks.com/aws/en/ldp/best-practices)、[Expectations and event log](https://docs.databricks.com/aws/en/ldp/expectations)

この例ではサーバーレス SQL Warehouse を選ぶ。サーバーレス計算は Databricks が管理する計算プレーンで実行し、顧客 AWS アカウントの S3 とは境界を分ける。図中の Bronze 等は Unity Catalog 上の論理テーブルで、実ファイルは顧客側の管理ストレージに置く。利用者はパイプライン定義、データ、アクセス権限とストレージ資格情報を設定し、Databricks のサーバーレス内部ノードを直接操作しない。公式資料を組み合わせた例であり、受注 CDC の構成は動作未検証。[Databricks ネットワーク構成](https://docs.databricks.com/aws/en/security/network/deployment-architecture/)
