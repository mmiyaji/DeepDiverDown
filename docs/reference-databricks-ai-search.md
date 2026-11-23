# Databricks AI Search の索引更新と検索

## 1. 対象

文書の変更を検索インデックスへ反映し、エージェントが検索結果と出典を回答に利用する構成例。AI Search はベクトル類似検索とキーワードを組み合わせた検索を提供する。[Databricks AI Search](https://docs.databricks.com/aws/en/ai-search/ai-search)

## 2. 機能配置

文書の元データを更新し、同期処理が差分を索引へ反映する。選択した方式では埋め込みモデルがテキストをベクトルに変換する。検索ツールは検索エンドポイントに条件を送り、インデックスから該当文書を取得する。エージェントは取得した本文と出典を回答に使う。運用担当は同期状況と検索結果の鮮度を確認する。

## 3. 同期、検索と権限

Delta Sync Index は対応するソーステーブルの変更を同期する。Continuous は自動同期し、Triggered は明示的な同期を実行する。Direct Vector Access Index は利用者が API または SDK で更新する。埋め込みを Databricks が生成する方法と、事前生成した埋め込みを使う方法を選べる。[索引の作成](https://docs.databricks.com/aws/en/ai-search/create-ai-search)・[同期 API](https://docs.databricks.com/api/ai-search/v1/index)

検索は ANN、ハイブリッド、全文検索の方式があり、利用条件を確認する。索引の利用者には Unity Catalog のカタログとスキーマの使用権限および索引の SELECT 権限が必要で、埋め込みエンドポイントにも権限が必要な場合がある。[検索方法と権限](https://docs.databricks.com/aws/en/ai-search/query-ai-search)

## 4. 実装例：AWS 上のエージェントと Databricks Delta Sync

AWS 上の原本文書を S3 に保存し、Delta テーブルに取り込んだ後、Databricks 管理の埋め込み、Delta Sync Index、AI Search Endpoint を組み合わせる例。Python エージェントは AI Bridge の Retriever Tool を使う。利用者・アプリケーション、Databricks ワークスペース、AWS の文書ストレージ、運用を別のレイヤーに配置する。

| 機能 | 担い手 |
|---|---|
| 質問と回答 | 利用者、Python エージェント |
| 検索の呼び出し | AI Bridge Retriever Tool、AI Search Endpoint |
| 文書と更新 | Unity Catalog の Delta テーブル、Delta Sync パイプライン |
| 埋め込みと索引 | Embedding Model Serving、Delta Sync Index |
| 権限と監視 | Unity Catalog の権限、索引の運用担当 |
| 同期方式 | Triggered / Continuous の設定 |
| 原本文書 | Amazon S3 |

出典 [エージェントの検索ツール](https://docs.databricks.com/gcp/en/agents/custom-agents/unstructured-retrieval-tools)・[AI Search の索引作成](https://docs.databricks.com/aws/en/ai-search/create-ai-search)・[S3 と Unity Catalog](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/s3)。

### AWS 上のアプリ実行と文書取込

この実装例では、Python エージェントと AI Bridge retriever を含むコンテナーを ECS/Fargate で実行し、Databricks AI Search に接続する。S3 の原本文書は Databricks の Auto Loader を使う取り込み処理で Delta テーブルに保存する。Auto Loader のチェックポイント、ファイルの解析・チャンク化、アクセス権、Databricks の認証情報とネットワークは別途構成する。モデルがエージェント内でどの LLM を使うかは固定しない。

| 追加する役割 | 担い手 |
| --- | --- |
| エージェントの実行 | ECS/Fargate の Python コンテナー |
| 文書の増分取込 | Databricks Auto Loader と Delta テーブル |
| 原本文書 | Amazon S3 |

[Databricks Auto Loader](https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader)、[ECS on Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/getting-started-fargate.html)。

この例では Auto Loader をサーバーレスパイプラインで実行し、Delta 管理テーブルの実ファイルは顧客 AWS の S3 管理領域に置く。AI Search の索引・埋め込みエンドポイントは Databricks が管理するサービスであり、内部保存方式や配置は公開情報以上に仮定しない。利用者はエンドポイント、索引、同期方式、埋め込みモデル、権限を UI・API・SDK で設定し、内部ノードを直接操作しない。標準エンドポイントではソースの Change Data Feed が必要。資料を組み合わせた例で、認証・ネットワーク・モデルの組み合わせは動作未検証。[AI Search 作成要件](https://docs.databricks.com/aws/en/ai-search/create-ai-search)、[Databricks architecture](https://docs.databricks.com/aws/en/security/network/deployment-architecture/)、[Managed storage](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)

## 5. 点検

検索結果の関連性、索引の同期遅延、埋め込みモデル、利用者の権限、出典の表示を評価する。MCP の AI Search 接続は公式資料上 Public Preview のため、利用時に提供状況と条件を確認する。[AI Search MCP](https://docs.databricks.com/aws/en/agents/mcp-tools/ai-search)
