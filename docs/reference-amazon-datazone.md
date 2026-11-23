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
