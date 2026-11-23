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
| 学習ジョブ・実験記録とモデル成果物 | Lakeflow Jobs、Databricks Runtime ML、MLflow Experiment | 利用者の AWS アカウント上のクラシック計算資源で学習する。実験メタデータは Databricks が管理し、成果物は Unity Catalog Volume を通じて S3 に保持する。 |
| モデル版のレジストリ | Unity Catalog の登録モデル | 選んだ成果物を新しいモデル版として登録する。 |
| 検証・配備ジョブ | モデル配備ジョブ | モデル名と承認済みバージョンをエンドポイント設定へ渡す。 |
| オンライン推論エンドポイント | Databricks Model Serving | Databricks 管理のサーバーレス計算資源で設定済みの Unity Catalog モデルを実行する。 |
| 注文アプリ | 注文アプリのエンドポイントクライアント | 推論 API を呼んでスコアを取得する。 |

学習実行者に学習表の読み取りと成果物 Volume の使用を許可し、Experiment に Volume のパスを指定する。配備ジョブは承認済みのバージョンを明示する。エンドポイントを作る主体には、提供するモデルを利用する権限と配備に必要な権限を付与する。注文アプリは別のサービスプリンシパルとして OAuth M2M を使い、対象エンドポイントに `CAN QUERY` を持つ。

- [クラシック計算資源の配置](https://docs.databricks.com/aws/en/compute/use-compute)
- [MLflow Experiment の成果物と Volume](https://docs.databricks.com/aws/en/mlflow/experiments)
- [モデル配信エンドポイントの権限](https://docs.databricks.com/aws/en/machine-learning/model-serving/manage-serving-endpoints)
- [OAuth M2M](https://docs.databricks.com/aws/en/dev-tools/auth/oauth-m2m)

出典 [MLflow のモデル記録](https://docs.databricks.com/aws/en/mlflow/models)、[Unity Catalog のモデルライフサイクル](https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle/)、[Model Serving エンドポイントの作成](https://docs.databricks.com/aws/en/machine-learning/model-serving/create-manage-serving-endpoints)、[Query serving endpoints for custom models](https://docs.databricks.com/aws/en/machine-learning/model-serving/score-custom-model-endpoints)

学習は顧客 AWS の classic compute、推論は Databricks 管理の Model Serving 計算で行う。学習表と成果物の実ファイルはこの例では顧客 AWS の S3 管理ストレージに置く。配備ジョブは顧客が用意するランナーから API を呼ぶ例で、ランナーの設置先は固定しない。利用者は学習コード、モデル版、エンドポイント設定と権限を指定し、サーバーレスの内部ノードを直接操作しない。公式資料を組み合わせた例で、この構成・バージョンの実動作は未検証。[Databricks architecture](https://docs.databricks.com/aws/en/security/network/deployment-architecture/)、[Managed storage](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)
