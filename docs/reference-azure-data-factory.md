# Azure Data Factory のデータ統合アーキテクチャ

## 1. 範囲
Azure Data Factory（ADF）で、外部の注文ファイルをコピーし、マッピング データ フローで整形して Azure Data Lake Storage に配置するパイプラインを示す。ADF はデータ移動・変換・制御を組み合わせたワークフローを構成するサービスである。

出典 [Introduction to Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/introduction)

## 2. パイプラインとアクティビティ
パイプラインは一つの作業単位をまとめる論理的な入れ物で、内部のアクティビティを順番または並列に実行する。例では Copy Activity がソースから取り込み、続く Data Flow Activity が変換を実行する。

出典 [Pipelines and activities](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipelines-activities)

## 3. Linked Service と Dataset
Linked Service はデータストアまたは計算サービスへの接続情報を表し、Dataset はそのストア内の入力・出力データ構造を指す。アクティビティはこれらを参照して、どのデータを読み書きするかを解決する。

出典 [Linked services](https://learn.microsoft.com/en-us/azure/data-factory/concepts-linked-services)

## 4. Integration Runtime と変換
Integration Runtime（IR）はアクティビティと Linked Service の橋渡しとなる計算基盤で、データ移動やアクティビティのディスパッチを担う。Mapping Data Flow は ADF が管理する Apache Spark クラスターで実行され、必要な変換をスケールして処理する。

出典 [Integration runtime](https://learn.microsoft.com/en-us/azure/data-factory/concepts-integration-runtime)・[Introduction](https://learn.microsoft.com/en-us/azure/data-factory/introduction)

## 5. トリガーと監視
トリガーはスケジュールやイベントによってパイプライン実行を開始する。デプロイ後はパイプラインとアクティビティの成功・失敗を Azure Monitor、ポータルの監視画面、ログなどで確認する。

出典 [Introduction to Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/introduction)・[Pipelines and activities](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipelines-activities)

## 6. シナリオ
図では、トリガーがパイプラインを起動し、Copy Activity が注文ファイルを一時配置し、続く Data Flow がそのファイルを読み整形して、出力用 Dataset が指す Data Lake に書き込む。実行状態は監視へ送る。

出典 [Pipelines and activities](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipelines-activities)

## 7. 参考資料
- [Introduction to Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/introduction)
- [Pipelines and activities](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipelines-activities)
- [Linked services](https://learn.microsoft.com/en-us/azure/data-factory/concepts-linked-services)
- [Integration runtime](https://learn.microsoft.com/en-us/azure/data-factory/concepts-integration-runtime)

## 8. 実装例：ADF と Azure Data Lake Storage Gen2

Azure Blob Storage の注文ファイルを Azure Integration Runtime でコピーし、変換前と整形済みの領域を分けた ADLS Gen2 に保存する例。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 注文ファイル | Azure Blob Storage 入力コンテナー | 注文ファイルの投入元。 |
| 定期起動の条件、データ処理のワークフロー、ファイルのコピー処理 | ADF のスケジュール Trigger・Pipeline・Copy Activity | 定期的にコピーを始め、成功後に変換を依存実行する。 |
| アクティビティの実行基盤、列と型の変換処理 | Azure Integration Runtime と Mapping Data Flow | コピーのデータ移動と、管理 Spark 上のマッピング変換を担う。 |
| 一時配置された注文ファイル、整形済みデータの保存先 | ADLS Gen2 の raw と curated | 変換前の中間結果と整形データを別のパスに保存する。 |
| 処理状態の監視 | Azure Monitor / ADF の監視画面 | パイプラインやアクティビティの実行状態を確認する。 |

実装で加わる部品を以下に示す。

- Linked Service と Dataset。入力・出力の接続とパスを宣言し、コピーと変換で参照する。

公式資料

- [Introduction to Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/introduction)
- [Pipelines and activities](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipelines-activities)
- [Linked services](https://learn.microsoft.com/en-us/azure/data-factory/concepts-linked-services)
- [Integration runtime](https://learn.microsoft.com/en-us/azure/data-factory/concepts-integration-runtime)
- [Monitor Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/monitor-data-factory)
