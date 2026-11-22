# AWS Glue の基本アーキテクチャ

## 1. データソースと Crawler

Crawler はデータストアを走査して形式・スキーマを推測し、テーブル定義を Data Catalog に作成または更新する。実データ自体は元のデータストアに残る。出典 [AWS Glue concepts](https://docs.aws.amazon.com/glue/latest/dg/components-key-concepts.html)

## 2. Data Catalog

Data Catalog はテーブル、ジョブ、接続などの技術メタデータを管理する。ETL ジョブは Catalog のテーブル定義をソースとターゲットとして利用する。出典 [AWS Glue components](https://docs.aws.amazon.com/glue/latest/dg/components-overview.html)

## 3. ジョブの実行

ETL Job はスクリプトに従ってデータを抽出・変換・ロードする。AWS Glue は Spark または Ray のサーバーレス実行環境をプロビジョニングし、実行資源を管理する。出典 [AWS Glue: How it works](https://docs.aws.amazon.com/glue/latest/dg/how-it-works.html)

## 4. Trigger と Workflow

ジョブはオンデマンド、スケジュール、イベントで起動できる。Workflow では複数の Crawler、Job、Trigger をつなぎ、依存関係と実行状況をまとめて追跡する。出典 [AWS Glue workflows](https://docs.aws.amazon.com/glue/latest/dg/workflows_overview.html)

## 5. ターゲットと監視

変換結果はデータレイクやデータウェアハウスなどのターゲットへ書き込む。ジョブ実行のログ・状態・通知を使って処理を監視する。出典 [AWS Glue: How it works](https://docs.aws.amazon.com/glue/latest/dg/how-it-works.html)

## 6. シナリオの見方

「S3 の注文データを整備する」では、Crawler が Catalog を更新し、Trigger が Job を起動し、Job がデータを変換して S3 の分析領域へ書く。`catalog-etl` のリンクを順番に選択すると流れを追える。
