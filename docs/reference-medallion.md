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
