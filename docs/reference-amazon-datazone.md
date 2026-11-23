# Amazon DataZone のデータ公開と購読

## 1. DataZone と Amazon SageMaker Catalog

Amazon DataZone はドメインとプロジェクトを軸に資産の公開・発見・購読を扱う。Amazon SageMaker Catalog は DataZone を基盤とし、SageMaker Unified Studio の体験に統合される。本図は DataZone ポータルを使う流れを示す。

[AWS Reference Architecture: Building a Unified Catalog with Amazon DataZone](https://docs.aws.amazon.com/reference-architecture-diagrams/latest/data-analytics/unified-catalog-datazone.html)、[Amazon SageMaker vs Amazon DataZone](https://docs.aws.amazon.com/datazone/latest/userguide/sagemaker-datazone.html)

## 2. インベントリと公開

提供プロジェクトは AWS Glue Data Catalog などのソースからメタデータをプロジェクトのインベントリへ取り込む。説明や用語などを補い、ドメインの利用者が探せるようにビジネスデータカタログへ公開する。対象資産の実データは接続先にある。

[AWS Reference Architecture: Building a Unified Catalog with Amazon DataZone](https://docs.aws.amazon.com/reference-architecture-diagrams/latest/data-analytics/unified-catalog-datazone.html)、[Data Discovery, Subscription, and Consumption](https://docs.aws.amazon.com/datazone/latest/userguide/discover-subscribe-consume-data.html)

## 3. 購読申請と判断

利用者は公開済み資産を検索し、利用プロジェクトを指定して利用目的を添えて購読を申請する。提供側の資産所有者が承認または却下する。承認後は資産の種類ごとに権限付与の処理に進む。

[Data Discovery, Subscription, and Consumption](https://docs.aws.amazon.com/datazone/latest/userguide/discover-subscribe-consume-data.html)

## 4. 管理対象と非管理対象の権限付与

Lake Formation 管理下の Glue テーブルや対応する Redshift テーブル・ビューでは、DataZone が権限付与を処理できる。たとえば Glue テーブルでは Lake Formation に許可を反映し、対象環境から Athena で利用できる。非管理対象資産では承認を EventBridge のイベントとして受け、外部処理がソース側の権限を設定して結果を戻せる。

[Data Discovery, Subscription, and Consumption](https://docs.aws.amazon.com/datazone/latest/userguide/discover-subscribe-consume-data.html)、[Grant Access to Unmanaged Assets](https://docs.aws.amazon.com/datazone/latest/userguide/grant-access-to-unmanaged-asset.html)

## 5. リネージの収集

対応する AWS Glue・Redshift 連携や OpenLineage 互換イベントによって、変換の入出力を資産に関連付ける。提供プロジェクトではインベントリと公開資産、利用側では公開済み資産を起点にリネージをたどる。

[Data Lineage in Amazon DataZone](https://docs.aws.amazon.com/datazone/latest/userguide/datazone-data-lineage.html)

## 6. シナリオの見方

「Glue 資産を公開して Athena で使う」は注文テーブルの取り込みから管理対象の権限付与までを追う。「非管理対象の購読を反映する」は外部ハンドラーが承認を受けてソース権限を与える例。

## 7. 実装例：DataZone のデータレイク環境

提供・購読プロジェクトを DataZone の DefaultDataLake ブループリントで作る構成例。非管理対象資産の通知経路も描く。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| 提供プロジェクト・所有者 | 提供側 DataZone プロジェクト | 資産を公開し、購読申請を審査する。 |
| 購読プロジェクト | 購読側 DataZone プロジェクト | 提供されたデータを利用する環境を持つ。 |
| プロジェクトのインベントリ・ビジネスデータカタログ・購読・権限付与処理 | Amazon DataZone（ドメイン・ポータル） | インベントリ、公開カタログ、購読状態を一つのドメインで管理する。 |
| 承認イベントの配信 | Amazon EventBridge | 非管理対象の承認イベントを配信する。 |
| ソースのテーブルカタログ | AWS Glue Data Catalog | Lake Formation 管理下の注文テーブルを登録する。 |
| 注文データの実体 | Amazon S3 | 提供側の注文ファイルを保持し、Glue Data Catalog にテーブルの保存先を登録する。 |
| OpenLineage 対応ジョブ | AWS Glue Spark ETL | 対応バージョンで OpenLineage のイベントを出す。 |
| データレイクの権限制御 | AWS Lake Formation | 購読側のデータアクセスを付与する。 |
| 購読環境・クエリエンジン | Amazon Athena ワークグループ | 購読環境が付与済みテーブルをクエリする。 |
| 外部処理・非管理対象ソース | 外部の購読処理 | 承認イベントに従ってソース側の権限変更を担当する。 |
| 実装で追加 | DefaultDataLake ブループリント | Glue 管理アクセスロールとデータレイク環境を構成する。 |

この例では提供・購読の環境を同じ AWS アカウントの同一リージョンに用意する。提供側の Glue Spark ETL が注文ファイルを S3 に書き込み、購読側の Athena ワークグループは Lake Formation で許可されたテーブルについて S3 のファイルを読む。図の S3 は入力テーブルの保存先を示す。

ブループリントで都度構成する Glue 管理アクセスロールには Lake Formation と Glue を操作できる権限が要る。非管理対象の権限処理は EventBridge を受ける外部担当・実装で行う。

[AWS Reference Architecture: Building a Unified Catalog with Amazon DataZone](https://docs.aws.amazon.com/reference-architecture-diagrams/latest/data-analytics/unified-catalog-datazone.html)、[Grant Access to Unmanaged Assets](https://docs.aws.amazon.com/datazone/latest/userguide/grant-access-to-unmanaged-asset.html)、[Data Lineage in Amazon DataZone](https://docs.aws.amazon.com/datazone/latest/userguide/datazone-data-lineage.html)、[Amazon DataZone built-in blueprints](https://docs.aws.amazon.com/datazone/latest/userguide/working-with-blueprints.html)

プロジェクトは DataZone 内の運用単位であり、個人と区別する。AWS は DataZone、Glue、Athena、EventBridge と Lambda の基盤を運用し、利用者はプロジェクト、ブループリント、IAM ロール、S3 データ、ジョブと権限を設定する。非管理対象の付与処理は EventBridge に反応する顧客実装の Lambda を例示し、ソース権限と状態報告を担当させる。AWS の内部実行基盤を直接操作するものではない。この連携は資料を組み合わせた例で実動作未検証。[AWS shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)、[EventBridge と Lambda](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-run-lambda-schedule.html)
