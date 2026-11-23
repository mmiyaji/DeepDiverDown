# Databricks MLflow と Model Serving の版管理

## 1. 題材

注文遅延の予測を例に、学習した版から運用中の版までの経路を追う。モデルの精度値や要件は例として決める必要があり、この図では仮定しない。

## 2. 学習と追跡

学習データとパラメータ、指標、成果物を MLflow で記録する。どの実行がモデルを作ったか確認してから登録・評価を進める。

## 3. 登録と昇格

Unity Catalog のモデルレジストリで名前とバージョンを管理する。エイリアスは一意のバージョンを指す選択のための参照である。昇格時はエイリアス先と配備するバージョンを照合する。

## 4. 配備と切り戻し

Model Serving のカスタムモデルエンドポイントに登録済みのバージョンを設定し、呼び出し先を公開する。切り戻しは旧版の指定と実際に稼働した設定を確認する。エイリアス変更だけを配備の成功とは扱わない。

## 図で確認するシナリオ

- **検証済みの予測モデルを公開** — 注文データで学習し、どの実験で作られたかを保存する。 → 登録モデルの版と承認した版が一致することを確認する。 → 選んだバージョンを配備し、リクエストと応答を確認する。
- **新版に問題があり旧版に戻す** — 推論結果の問題と現在稼働しているバージョンを調べる。 → 旧版を選び、エンドポイントの配備設定を切り替える。 → 戻したバージョンで結果を再確認する。

## 公式資料

- [MLflow のモデル記録](https://docs.databricks.com/aws/en/mlflow/models)
- [Unity Catalog のモデルライフサイクル](https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle/)
- [Model Serving エンドポイントの作成](https://docs.databricks.com/aws/en/machine-learning/model-serving/create-manage-serving-endpoints)

## 5. 実装例 Unity Catalog モデルのオンライン配備

実験結果から承認済みの版を選び、注文アプリから Databricks のカスタムモデルエンドポイントを呼ぶ構成。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 学習用の注文テーブル | Unity Catalog のモデル学習用テーブル | 注文時点の特徴量を読み取れるようにする。 |
| 学習ジョブ・実験記録とモデル成果物 | Databricks 学習ジョブと MLflow Experiment | モデルの学習、パラメータ、検証結果、成果物を同じ Run に記録する。 |
| モデル版のレジストリ | Unity Catalog の登録モデル | 選んだ成果物を新しいモデル版として登録する。 |
| 検証・配備ジョブ | モデル配備ジョブ | モデル名と承認済みバージョンをエンドポイント設定へ渡す。 |
| オンライン推論エンドポイント | Databricks Model Serving | 設定した Unity Catalog モデルをオンラインで実行する。 |
| 注文アプリ | 注文アプリのエンドポイントクライアント | 推論 API を呼んでスコアを取得する。 |

配備ジョブが承認したバージョンを明示する。注文アプリは配備ジョブと別の主体で、推論 API の利用に必要な権限を持つ。

出典 [MLflow のモデル記録](https://docs.databricks.com/aws/en/mlflow/models)、[Unity Catalog のモデルライフサイクル](https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle/)、[Model Serving エンドポイントの作成](https://docs.databricks.com/aws/en/machine-learning/model-serving/create-manage-serving-endpoints)、[Query serving endpoints for custom models](https://docs.databricks.com/aws/en/machine-learning/model-serving/score-custom-model-endpoints)
