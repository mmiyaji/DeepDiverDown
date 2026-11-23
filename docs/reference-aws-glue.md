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

## 7. 実装例：AWS Glue で S3 の CSV を Parquet に変換

S3 の raw プレフィックスにある注文 CSV をクロールし、登録した定義を Glue の Spark ジョブで読む例。処理後は別のプレフィックスに Parquet を保存する。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 変換前のデータ置き場、分析データの保存先 | Amazon S3 の raw・curated プレフィックス | raw へ CSV を置き、curated に Parquet を書く。 |
| 入力スキーマの発見 | Glue Crawler | raw プレフィックスを分類し、テーブル定義を更新する。 |
| テーブルの定義台帳 | Glue Data Catalog | クロール結果のスキーマと S3 上の位置を持つ。 |
| 処理の起動と依存制御 | Glue Workflow と Trigger | Crawler の成功を条件にジョブを起動する。 |
| 抽出・変換の実行 | Glue Spark ETL ジョブ | カタログから入力を読み、必要列の型を整えて Parquet を保存する。 |
| 実行ログと監視 | Amazon CloudWatch Logs | ジョブ実行ログから処理結果とエラーを確認する。 |

実装で加わる部品を以下に示す。

- Glue の IAM 実行ロール。Crawler とジョブに必要な S3・Data Catalog へのアクセスを用途に応じて付与する。

Spark スクリプトは S3 に置き、ジョブにスクリプトのパスと Glue ワーカーの設定を指定する。Crawler は raw の CSV を検出する。Workflow の依存 Trigger が Crawler の成功後にジョブを開始すると、ジョブは Glue Data Catalog の入力定義を使い、変換した Parquet を別の curated パスへ書き込む。

- [Glue Spark ジョブのスクリプトの場所](https://docs.aws.amazon.com/glue/latest/webapi/API_JobCommand.html)

公式資料

- [AWS Glue concepts](https://docs.aws.amazon.com/glue/latest/dg/components-key-concepts.html)
- [AWS Glue components](https://docs.aws.amazon.com/glue/latest/dg/components-overview.html)
- [AWS Glue How it works](https://docs.aws.amazon.com/glue/latest/dg/how-it-works.html)
- [AWS Glue workflows](https://docs.aws.amazon.com/glue/latest/dg/workflows_overview.html)
- [Crawler prerequisites](https://docs.aws.amazon.com/glue/latest/dg/crawler-prereqs.html)
- [Logging and monitoring in AWS Glue](https://docs.aws.amazon.com/glue/latest/dg/logging-and-monitoring.html)

Glue は Spark ジョブの実行リソースを AWS のサービスアカウントで確保・管理する。利用者はジョブスクリプト、ワーカー設定、Crawler、Workflow、データ、権限を設定し、Glue の API・コンソールで操作できる。内部の仮想リソースを直接操作する構成ではない。公式資料を組み合わせた注文データの例で、実動作は未検証。[AWS 共有責任](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
