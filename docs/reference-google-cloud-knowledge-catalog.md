# Google Cloud Knowledge Catalog のメタデータ管理

## 1. 名称と移行

2026年4月10日、Dataplex Universal Catalog は Knowledge Catalog に改称された。既存のメタデータは引き継がれ、Dataplex の API、CLI、IAM 識別子は引き続き使われる。旧 Data Catalog は別サービスで、2026年6月1日に段階的な停止が始まった。旧タグテンプレートや Entry Group を移行する場合は、対応する Aspect Type や Entry Group の IAM を確認する。

[Knowledge Catalog Release Notes](https://docs.cloud.google.com/knowledge-catalog/docs/release-notes)、[Transition from Dataplex Universal Catalog](https://docs.cloud.google.com/knowledge-catalog/docs/transition-dataplex-universal-catalog)、[Transition from Data Catalog](https://docs.cloud.google.com/dataplex/docs/transition-to-dataplex-catalog?hl=en)

## 2. Entry の収集

BigQuery のテーブルなどは、Google Cloud サービスごとの Entry Group に自動的に登録される。Entry は個々の資産を表す。対応する外部ソースはコネクタなどから取り込める。

[About Metadata in Knowledge Catalog](https://docs.cloud.google.com/knowledge-catalog/docs/metadata-overview)

## 3. Aspect と検索

Aspect Type がメタデータの項目と型を規定し、Aspect として Entry や列などに付けられる。たとえば分析用テーブルに利用目的と運用連絡先、列に分類を付ける。カタログの閲覧と編集には対象リソースの IAM が適用される。

[About Metadata in Knowledge Catalog](https://docs.cloud.google.com/knowledge-catalog/docs/metadata-overview)、[Manage Aspects and Enrich Metadata](https://docs.cloud.google.com/knowledge-catalog/docs/enrich-entries-metadata)、[Manage Access with IAM](https://docs.cloud.google.com/knowledge-catalog/docs/iam-and-access-control)

## 4. リネージ

対応するサービスから収集したリネージを資産と関連付け、上流・下流を調べる。対応するソースと収集範囲を確認する。Google Cloud Lakehouse runtime catalog は Iceberg テーブルを読み書きするカタログであり、Knowledge Catalog はそこからもメタデータを取得できる。

[Knowledge Catalog Release Notes](https://docs.cloud.google.com/knowledge-catalog/docs/release-notes)、[About Data Lineage](https://docs.cloud.google.com/knowledge-catalog/docs/about-data-lineage)

## 5. データ製品とアクセスグループ

データ製品は関係する資産を用途別にまとめる。所有者はアクセスグループを作り、対応する Google グループなどへ対象資産の IAM ロールを設定する。コンソールで個人の申請を承認すると、対応する Google グループに利用者が追加される。REST API で承認する場合は、グループのメンバーシップなどを別途設定する。実データへのアクセスは BigQuery などの接続先で許可が評価される。

[Manage Access with IAM](https://docs.cloud.google.com/knowledge-catalog/docs/iam-and-access-control)、[About Data Products](https://docs.cloud.google.com/knowledge-catalog/docs/data-products-overview)、[Manage Data Products](https://docs.cloud.google.com/knowledge-catalog/docs/manage-data-products)

## 6. シナリオの見方

BigQuery の注文テーブルを例に、登録済み Entry に利用目的・連絡先や列の分類を付け、変換履歴を調べる。さらに、注文データ製品の利用申請をコンソールから承認し、アクセスグループを通じてクエリ権限を得る。
