# OpenMetadata のメタデータ基盤

## 1. 収集、保存、検索

取り込みワークフローは外部ソースからメタデータを取得し、OpenMetadata Server の API に登録する。OpenMetadata Server は MySQL または PostgreSQL にカタログを保存し、検索エンジンへ索引を反映する。構成図では Elasticsearch を使う例を扱う。

[Docker Deployment Architecture](https://docs.open-metadata.org/v1.12.x/deployment/docker)、[System and Components](https://docs.open-metadata.org/v1.12.x/developers/architecture/code-layout)

## 2. 用語集・分類・所有者

用語集は事業上の用語とその定義をそろえる。分類タグは個人情報や重要度など、資産の性質を示す。利用者は所有者やタグなどで検索結果を絞り、候補の説明とスキーマを比較する。

[Data Discovery](https://docs.open-metadata.org/v1.12.x/how-to-guides/data-discovery/discover)、[Data Governance](https://docs.open-metadata.org/v1.12.x/how-to-guides/data-governance)

## 3. テーブル・列リネージ

パイプライン、データベース、ダッシュボードなどの関係を記録し、上流・下流をたどる。列リネージは対応する取り込みで取得するほか、担当者が不足分を手で登録できる。

[Column-Level Lineage](https://docs.open-metadata.org/v1.12.x/how-to-guides/data-lineage/column)

## 4. ロールとポリシー

カタログ内の操作権限には所属やロールと、資産の所有者やタグなどの条件を使える。たとえば個人情報タグの変更をスチュワードに限定する。接続先で実データを読む権限は接続先の認可経路に従う。

[Data Governance](https://docs.open-metadata.org/v1.12.x/how-to-guides/data-governance)、[Roles and Policies](https://docs.open-metadata.org/v1.12.x/how-to-guides/admin-guide/roles-policies/authorization)

## 5. データ契約の定義と検証

対象資産に期待するスキーマ、意味、品質、SLA などを契約に定義する。検証可能な項目は資産種別と構成に依存する。検証を実行し、API または画面で結果を確認する。対応する契約は Open Data Contract Standard（ODCS）形式でも連携できる。

[Creating Data Contracts](https://docs.open-metadata.org/v1.12.x/how-to-guides/data-contracts/spec)、[Data Contracts API](https://docs.open-metadata.org/v1.12.x/api-reference/data-contracts)

## 6. シナリオの見方

「個人情報を含む列の影響を調べる」は `customer_email` のタグ、所有者、下流レポートを調べる例。「公開テーブルの契約を検証する」は、スキーマ要件を記録し、検証結果を確認する例。
