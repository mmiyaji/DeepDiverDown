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

Spark Declarative Pipelines を使い、受注イベントを Delta のストリーミングテーブルへ保管し、集計を SQL で提供する例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| 受注 CDC | 注文 CDC フィード | 主キー、変更種別、並び順を含むイベントを渡す。 |
| Bronze・原本 | Bronze の Delta ストリーミングテーブル | 元の受注イベントを追記する。 |
| 検証・正規化 | Lakeflow Spark Declarative Pipelines | 検証条件で有効行と隔離行を分け、必要に応じて変更を適用する。 |
| 隔離テーブル | 無効行を保持するストリーミングテーブル | 調査と再処理に必要な行を残す。 |
| Silver・受注明細 | Silver の整形済み Delta テーブル | 検証後の正規化した注文の状態を保持する。 |
| Gold・日次売上 | Gold の日次売上マテリアライズドビュー | 日付・通貨別の集計を提供する。 |
| BI | Databricks SQL ダッシュボード | 日次売上を表示する。 |
| 実装で追加 | Lakeflow パイプラインイベントログ | 検証結果や更新状態を記録する。 |

隔離は検証条件の正・逆を使う二つのフローで構成する。Delta の Bronze は後から再処理できるよう原本を保持する。Silver に変更イベントを取り込む際は、主キーに加えて更新順序の列と削除の扱いを決める。

[Databricks · Medallion lakehouse architecture](https://docs.databricks.com/aws/en/lakehouse/medallion)、[How to use Spark Declarative Pipelines on Lakeflow](https://docs.databricks.com/aws/en/ldp/concepts/how-to-use-pipelines)、[Lakeflow best practices: Quarantine](https://docs.databricks.com/aws/en/ldp/best-practices)、[Expectations and event log](https://docs.databricks.com/aws/en/ldp/expectations)
