# Databricks Lakeflow の CDC と品質管理

## 1. 全体像

一連の受注データを Delta テーブルに取り込み、注文の現在状態を整える。マネージド DB コネクタ、ファイル取り込み、変換、実行スケジュールと観測の位置を区別する。

## 2. DB の変更を取り込む

対応する DB では Lakeflow Connect の取り込みゲートウェイがソースへのネットワーク到達性を持ち、変更をステージングボリュームへ届ける。取り込みパイプラインがステージから宛先テーブルへ反映する。コネクタごとの初期スナップショット、権限、再同期条件は確認が必要。

## 3. 到着ファイルを取り込む

Auto Loader が新着ファイルを見つけて増分処理する。チェックポイントは取り込んだファイルの進捗に使う。到着順は業務イベントの順序を保証しない。

## 4. 宣言型の変換と品質

Lakeflow Spark Declarative Pipelines でストリーミングテーブルと変換の依存を定義する。AUTO CDC を使う場合はキーと順序列を明示する。Expectations では違反を記録、除外、または失敗として扱う方針を選ぶ。

## 5. 起動と観測

Jobs はパイプラインや後続作業の順序・スケジュールを管理する。イベントログは実行、進捗、品質の調査に使う。原本と再処理範囲は運用設計で決める。

## 図で確認するシナリオ

- **変更ログから注文の現在状態を整える** — 対応コネクタで DB の変更をステージへ送る。 → 取り込みパイプラインが RAW 側へ反映する。 → キーと業務上の順序を使って注文の現在状態を更新する。 → イベントログで進捗と品質を確認する。
- **到着ファイルの増分と品質違反を調べる** — Auto Loader が新着ファイルを増分ロードする。 → パイプラインが期待値を評価する。例では不正な行を除外する。 → 正しい行を反映し、除外の件数を確認して訂正の範囲を決める。

## 公式資料

- [Lakeflow Connect DB コネクタ](https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/cdc-overview)
- [Auto Loader](https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/)
- [Lakeflow パイプラインの運用](https://docs.databricks.com/aws/en/ldp/concepts/how-to-use-pipelines)
- [Apache Spark Declarative Pipelines と Lakeflow](https://docs.databricks.com/aws/en/ldp/concepts/spark-declarative-pipelines)
