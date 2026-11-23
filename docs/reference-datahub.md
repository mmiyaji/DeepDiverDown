# DataHub のメタデータ基盤

## 1. アセット識別と Aspect

DataHub ではテーブルやビュー、ストリームを Dataset として表現できる。Entity を URN で識別し、スキーマや所有者など更新単位の情報を Aspect として持たせる。複数ソースを連携する場合は、同一資産の URN が取り込み経路によって分かれないようにする。

[DataHub Architecture Overview](https://docs.datahub.com/docs/architecture/architecture/)、[The Metadata Model](https://docs.datahub.com/docs/metadata-modeling/metadata-model)

## 2. 取り込みと索引

コネクタがソースから取得したメタデータを Metadata Change Proposal（MCP）として送る。HTTP でメタデータサービス（GMS）へ送る経路や、Kafka を経由する経路がある。図は HTTP 経路を示す。サービスはメタデータを保存し、検索や関係の参照に使う索引を提供する。Aspect の種類により保存先が異なる。

[DataHub Architecture Overview](https://docs.datahub.com/docs/architecture/architecture/)、[Metadata Ingestion Architecture](https://docs.datahub.com/docs/architecture/metadata-ingestion)、[The Metadata Model](https://docs.datahub.com/docs/metadata-modeling/metadata-model)

## 3. 検索、リネージ、所有者

利用者は資産名や用語で検索し、対象 Dataset に登録された所有者、ドメイン、上流・下流の関係を調べる。列単位の関係はデータソースや取り込み経路に依存するため、影響判断では収集できた範囲を確認する。

[The Metadata Model](https://docs.datahub.com/docs/metadata-modeling/metadata-model)、[About DataHub Lineage](https://docs.datahub.com/docs/features/feature-guides/lineage)、[Domains](https://docs.datahub.com/docs/domains)

## 4. メタデータの操作権限

メタデータポリシーは対象リソース、操作、利用主体を組み合わせる。タグや用語をポリシーの対象範囲に使える。たとえば所有者が説明を編集でき、スチュワードが分類に使うタグを編集できるようにする。ソースデータへのアクセスには接続先の権限が適用される。

[Access Policies](https://docs.datahub.com/docs/authorization/access-policies-guide)

## 5. 契約と assertion

データ契約は Dataset に関連付け、スキーマ、鮮度、品質などの assertion を参照する。実際の検証は assertion の実行と結果登録によって行う。外部ツールから実行結果を連携できる。DataHub Cloud Observe での実行は対応プラットフォーム、assertion の種類、設定に依存する。

[Data Contract Metamodel](https://archive.docs.datahub.com/docs/1.8.0/generated/metamodel/entities/datacontract)、[DataHub Cloud Observe Assertions](https://docs.datahub.com/docs/managed-datahub/observe/assertions)

## 6. シナリオの見方

「列変更の影響を調べる」は、dbt などから取り込んだ関係を使って下流モデルと所有者を確認する例。「鮮度契約を検証する」は、外部チェックが検証結果を送信し、運用者が確認する例。
