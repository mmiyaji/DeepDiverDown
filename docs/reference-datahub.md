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

## 7. 実装例：DataHub の Docker Compose

DataHub を自己管理し、MySQL、Elasticsearch、イベントブローカーをコンテナで分ける例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| ウェアハウス・変換基盤 | Snowflake のデータセット、dbt モデル | Snowflake からスキーマ、dbt から変換定義と依存関係をそれぞれ取り込む。 |
| 品質・鮮度の検証器 | dbt テスト結果 | 既存のテスト結果を assertion として取り込む。 |
| 利用者・所有者 | 分析担当者・資産所有者 | ブラウザーで資産と検証結果を確認する。 |
| 取り込みコネクタ | DataHub Ingestion CLI | ソースのレシピを実行し HTTP で GMS に送る。 |
| メタデータ API | datahub-gms | Entity、Aspect、関係を扱う。 |
| 検索・資産 UI | datahub-frontend-react | 検索と資産詳細・リネージを提供する。 |
| メタデータ保存 | MySQL | バージョン付き Aspect を保存する。 |
| 検索・関係の索引 | Elasticsearch | 検索と関係クエリを支える。 |
| 実装で追加 | Kafka ブローカー | メタデータ変更や索引更新の処理を支える。 |

HTTP 取り込みと Kafka を使う変更処理は別の経路。本番の認証、永続ボリューム、冗長構成は導入環境に合わせる。dbt とウェアハウスで資産識別子の設定を揃える。

[Metadata Ingestion Architecture](https://docs.datahub.com/docs/architecture/metadata-ingestion)、[The Metadata Model](https://docs.datahub.com/docs/metadata-modeling/metadata-model)、[Data Contract Metamodel](https://archive.docs.datahub.com/docs/1.8.0/generated/metamodel/entities/datacontract)、[DataHub Docker Container Architecture](https://archive.docs.datahub.com/docs/1.2.0/architecture/docker-containers)


Docker Compose ホスト上で GMS、Frontend、MySQL、Kafka、Elasticsearch と変更イベントを消費する処理を動かす。Snowflake と dbt は別の収集対象であり、ホスト内には含めない。Docker の構成と外部ソースの接続・互換バージョンはこの組み合わせで動作未検証。

## 8. 実装例：Amazon EKS 上の DataHub・RDS・MSK・OpenSearch

DataHub を Helm で EKS の EC2 ノード上に展開する。RDS に Aspect を保持し、MSK の変更イベントを処理して OpenSearch の索引を更新する。

| 機能 | 担い手 |
| --- | --- |
| メタデータ取り込みと検証結果 | ウェアハウス用コネクターと dbt アーティファクト取り込み。dbt Core が契約を評価する。 |
| API と UI | EKS 上の DataHub GMS と Frontend。 |
| 保存と検索 | RDS for MySQL を Aspect の保存先とし、MSK の変更ログから Amazon OpenSearch Service の索引を更新する。 |

OSS の DataHub を利用者が運用し、RDS、MSK、OpenSearch は対応する AWS マネージドサービスを使う。DataHub の Helm チャートとデータストアの対応バージョンを揃える。MSK と Schema Registry の接続・資格情報を設定し、OpenSearch の IAM 認証を使う場合は対応する署名設定と Pod の IAM ロールを用意する。MySQL は専用アカウントで TLS 接続する。DataHub へのログインとメタデータ操作ポリシーは各バックエンドのアクセス権から独立して設定する。

公式資料

- [DataHub の AWS デプロイ](https://docs.datahub.com/docs/deploy/aws)
- [DataHub の Kubernetes デプロイ](https://docs.datahub.com/docs/deploy/kubernetes)
- [DataHub dbt コネクター](https://docs.datahub.com/docs/generated/ingestion/sources/dbt)
- [EKS マネージドノードグループ](https://docs.aws.amazon.com/eks/latest/userguide/create-managed-node-group.html)

AWS は EKS 制御プレーン、RDS、MSK、OpenSearch の基盤を運用し、利用者は Kubernetes API を使ったデプロイ、ノード、DataHub、データとアクセス権を設定する。制御プレーンのサーバーやマネージドサービスの内部ホストを直接操作しない。公式資料を組み合わせた例で、DataHub・MSK・Schema Registry・OpenSearch のバージョンと認証の実動作は未検証。[AWS shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
