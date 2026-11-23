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

## 6. 実装例 Lakeflow Connect での PostgreSQL 取込

PostgreSQL の変更を Lakeflow Connect で取り込み、ファイル由来データは別の入力表に置いてから注文データを整備する例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 注文DB | PostgreSQL の ORDERS | 対象テーブルの初回取込と CDC を提供する。 |
| データベース変更の収集ゲートウェイ | Lakeflow Connect 取り込みゲートウェイ | データベースの変更を取得する。 |
| 変更の一時保存領域 | Unity Catalog ステージングボリューム | ゲートウェイが取得した変更を一時保存する。 |
| 取り込みパイプライン | Lakeflow Connect 取り込みパイプライン | 接続したソースから宛先テーブルを更新する。 |
| 到着ファイル | Amazon S3 の到着ファイル | 外部から受領したバックフィル用のファイルを配置する。 |
| 新着ファイルの増分読み込み | Auto Loader | 新着ファイルを別の受入表に増分取り込みする。 |
| 注文変更の受入テーブル | ソース別 RAW Delta テーブル群 | DB 接続の宛先表とファイルの受入表を個別に管理する。 |
| 宣言型の変換・品質処理・分析用注文テーブル | Lakeflow パイプラインの宣言と出力表 | 入力を統合し、キーと順序に従って注文状態を更新する。 |
| ジョブのスケジューラー | Lakeflow Jobs | 後段の変換パイプラインを定期実行する。 |
| イベントログ | Lakeflow パイプラインイベントログ | 進捗と品質違反件数を調べる。 |

ソース別の受入表を分けることで、同じ注文が双方から届いた場合の優先順位を変換処理に明示できる。DB の初回取込と業務バックフィルは別の経路として扱う。

出典 [Lakeflow Connect DB コネクタ](https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/cdc-overview)、[Auto Loader](https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/)、[Lakeflow パイプラインの運用](https://docs.databricks.com/aws/en/ldp/concepts/how-to-use-pipelines)、[Apache Spark Declarative Pipelines と Lakeflow](https://docs.databricks.com/aws/en/ldp/concepts/spark-declarative-pipelines)、[Databricks の PostgreSQL ソース設定](https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/postgresql-source-setup)
