# AI・機械学習基盤の違い

ここでは特徴量ストアを比べる（同じ分類の Databricks 系の図は表に入れない）。

| 観点 | Feast | Hopsworks |
| --- | --- | --- |
| 特徴 | 注文履歴から作った特徴量を、**学習用の履歴取得（過去時点の値）** と **オンライン参照（エンティティの最新値）** の両方に使う特徴量ストア | **特徴量ストア中心の ML 基盤**。特徴量の変換をフィーチャービュー側に持つ |
| データモデル・実行モデル | レジストリで特徴量を定義する。オフラインストアが履歴を、オンラインストアが最新値を保持する。materialize ジョブが履歴から最新値をオンラインへ反映し、Feature Server が API で配信する | **フィーチャーグループ**（主キー・event_time 付きの表）と、それを結合する **フィーチャービュー** |
| 一貫性・耐久性の仕組み | 時点結合で、学習時に未来の情報を混ぜない。反映失敗後は再実行する。更新遅延・欠損・定義の版は運用で確認する | Kafka 経由で OnlineFS（冪等 upsert）と Hudi DeltaStreamer（コミット時に重複除去）へ反映し、**実質 1 回** にそろえる |
| 拡張のしかた | オフライン・オンラインのストアと実行基盤を選んで組み合わせる。例は Redshift + DynamoDB + SageMaker AI（docs では未検証の代表構成） | 外部テーブル（Snowflake・BigQuery・Redshift・S3 等）を **外部フィーチャーグループ** として接続する。Spark・Python のジョブ、KServe による配備 |
| 運用の形態 | 利用者が自前運用する構成と、AWS のマネージドサービス上の構成 | サーバーレス（ベータ）、利用者のクラウド上の Managed、オンプレミス |
| 得意な用途 | 履歴特徴量を学習と低遅延推論で共有する | 学習と低遅延推論で、同じ特徴量定義と変換を使う |
| 注意点 | 時点の正しさ、更新遅延と欠損、権限、冗長化は未記載 | Python クライアントの書き込みはストリーム API だけ。オフラインの形式表記が資料間で食い違う（Hudi / Delta） |
| ライセンス | 未確認（docs に記載なし） | AGPL-V3 |

内容は 2026 年 11 月時点の公式資料に基づく。確認できなかった点は「未確認」と書く。

## 選び方

- 履歴の特徴量を、学習とオンライン推論の両方で使う → **Feast**
- 既存のストアと実行基盤を選んで組み合わせる → **Feast**
- 特徴量の変換まで含めて、学習と推論で同じ定義を使う → **Hopsworks**
- Snowflake・BigQuery などの外部テーブルを特徴量として接続する → **Hopsworks**

## 公式資料

- [Feast の構成要素](https://docs.feast.dev/master/getting-started/components/overview)
- [Feast の特徴量の提供と推論](https://docs.feast.dev/getting-started/architecture/model-inference)
- [Hopsworks の概要](https://docs.hopsworks.ai/latest/concepts/hopsworks/)
- [logicalclocks/hopsworks（GitHub）](https://github.com/logicalclocks/hopsworks)
