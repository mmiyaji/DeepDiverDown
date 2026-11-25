# Apicurio Registry の基本アーキテクチャ

Apicurio Registry 3.4 の公式ドキュメントを基準に、構成部品・情報モデル・ストレージ・実行場所を整理する。SerDes の ID の受け渡しは「Apicurio Registry：シリアライザーとスキーマ ID の受け渡し」、互換性ルールとバージョン管理は「Apicurio Registry：互換性ルールとバージョン管理」で扱う。

## 1. Apicurio Registry の位置づけ

Apicurio Registry は、イベントのスキーマと API 定義を共有するデータストアである。クライアントは、スキーマの更新を実行時に取得でき、更新のたびにアプリケーションを再デプロイしなくてよい。Avro、Protobuf、JSON Schema、OpenAPI、AsyncAPI などを扱う。バックエンドは Quarkus で動く Java アプリケーションである。

メッセージ本体の保管やストリーム処理は担わない。Kafka のレコードにはスキーマ全体ではなく、スキーマを指す ID を載せ、実際のスキーマは Registry から取り出す。

## 2. 入口：API・Web コンソール・クライアント

- **Core Registry API v3**：REST API。ベースパスは `/apis/registry/v3`。グループ、アーティファクト、バージョン、ルール、検索、管理（`/admin/export`・`/admin/import`）を扱う。API ドキュメントは `/apis` で見られる。
- **Web コンソール**：スキーマの閲覧・検索・追加とルールの設定ができる。バックエンドとは別のコンポーネントで、コンテナイメージも別に配布される。
- **ほかのクライアント**：コマンドライン、Maven プラグイン、各言語の SDK。
- **Confluent 互換 API**：`/apis/ccompat/v7`（`/apis/ccompat/v8` も対応）に `schema.registry.url` を向ければ、Confluent のクライアントを使える。subject は既定グループのアーティファクト ID になり、スキーマ ID は既定では contentId になる。Schema Linking、Data Contract、KEK/DEK は未対応。
- **Kafka クライアントの SerDes**：Java の Serializer / Deserializer が、Producer と Consumer の中から Registry の API を呼ぶ。Kafka Connect 用の Avro・JSON Schema コンバーターもある。

## 3. 情報モデル：グループ・アーティファクト・バージョン

| 用語 | 内容 |
| --- | --- |
| グループ | アーティファクトをまとめる名前空間。指定しなければ `default`。 |
| アーティファクト | `groupId` と `artifactId` で決まる 1 つのスキーマや API 定義。`artifactType`（AVRO など）を持つ。 |
| バージョン | アーティファクトの内容の不変なスナップショット。状態は `ENABLED`・`DEPRECATED`・`DISABLED`。 |
| コンテンツ | スキーマ本体。同じ内容のバージョンは同じ `contentId` を共有する（重複排除）。 |
| globalId | バージョンごとに自動採番される、Registry 全体で一意な ID。 |
| ブランチ | バージョンの順序付きの並び。既定は `latest`。 |
| 参照 | アーティファクトから別のアーティファクトへのリンク（JSON Schema の `$ref`、Protobuf の `import` など）。 |

バージョンの内容は変更しない。変更は新しいバージョンの追加で表す。`contentId` と `globalId` の使い分けは「シリアライザーとスキーマ ID の受け渡し」で扱う。

## 4. ルール

ルールは、新しいバージョンを受け入れる前に通すべき検査である。種類は `VALIDITY`（構文と意味）、`COMPATIBILITY`（過去のバージョンとの互換性）、`INTEGRITY`（参照の整合性）、`GOVERNANCE`（データコントラクトのメタデータ）。

- 設定できる範囲は、グローバル、グループ、アーティファクトの 3 つ。アーティファクト、グループ、グローバルの順に優先する。優先は種類ごとに判定する。継承したルールを止めるには、下位の範囲で同じルールを `NONE` にする。
- 既定のグローバルルールは `apicurio.rules.global.<ルール名>`（`compatibility`・`validity`・`integrity`・`governance`）で設定できる。
- 新しいバージョンの追加、ドラフトの公開、`dryRun=true` の検査で適用される。違反は HTTP 400 と `ruleViolation` で返る。ルールを変えても、登録済みのバージョンは再検査されない。

互換性の中身は「互換性ルールとバージョン管理」で扱う。

## 5. ストレージ

保存先は設定で選ぶ（`apicurio.storage.kind`）。公式資料にある選択肢は次のとおり。

| 選択肢 | 位置づけ |
| --- | --- |
| 組み込み H2 | 既定。メモリ上で再起動すると消える。開発・テスト用。 |
| PostgreSQL | 本番で推奨。バックアップや復元などのデータ管理がしやすい。`APICURIO_STORAGE_KIND=sql`、`APICURIO_STORAGE_SQL_KIND=postgresql`。 |
| Kafka（KafkaSQL） | データベースの運用に慣れていない環境や、データを Kafka に置く要件がある環境向け。`APICURIO_STORAGE_KIND=kafkasql`。 |
| GitOps | 読み取り専用。Git リポジトリのデータを読み込む。変更は Git のコミットで行う。 |
| KubernetesOps | 実験的で読み取り専用。Operator の CR に `kubernetesops` を指定する。 |

Operator の CR では `spec.app.storage.type` に `postgresql`、`mysql`、`kafkasql`、`kubernetesops` を指定する（省略は H2）。KafkaSQL は Kafka を主のデータストアにし、変更を `kafkasql-journal` トピックへ書く。各レプリカは、組み込み H2 を journal から再構築する。詳細は「シリアライザーとスキーマ ID の受け渡し」の実装例で扱う。

## 6. 動く場所と台数

- バックエンド（`app`）と UI（`ui`）は別の Pod で、ステートレスに水平スケールできる。Operator の CR に `app.replicas`、`ui.replicas` を書く。
- SQL ストレージで複数レプリカにするには、データベース側にレプリケーションとフェイルオーバーが要る。複数レプリカで組み込み H2 を使ってはならない。
- KafkaSQL では、Kafka クラスターを高可用にする（例：3 ブローカー、レプリケーション係数 3、`min.insync.replicas: 2`）。
- Docker イメージは `apicurio/apicurio-registry`。ポートは 8080。ヘルスチェックの `/health/ready`・`/health/live` と `/metrics` は管理ポート 9000 にある。
- Kubernetes では Apicurio Registry Operator が `ApicurioRegistry3`（`registry.apicur.io/v1`）を受け取り、Ingress、NetworkPolicy、PodDisruptionBudget（`maxUnavailable: 1` が既定）などを作る。Ingress は HTTP のみで、TLS は利用者が用意する。
- 認証は OpenID Connect で、Keycloak が例として挙げられている。

## 7. 実装例：オンプレミス Kubernetes・Operator・PostgreSQL

利用者のデータセンターの Kubernetes クラスターに Apicurio Registry Operator を置き、`ApicurioRegistry3` で Registry の `app` と `ui` を展開する例。ストレージは利用者が用意する PostgreSQL（`spec.app.storage.type: postgresql`）で、DB のパスワードは Kubernetes の Secret から渡す。

| 機能 | 担い手 |
| --- | --- |
| 登録担当 | クラスター外から Web コンソール、CLI、REST API、Maven プラグインで接続 |
| Kafka クライアント | クラスターの外のアプリケーション |
| REST API・ccompat API・ルール・情報モデル | Registry の app Pod（Deployment） |
| Web コンソール | Registry の ui Pod（Deployment） |
| ストレージ | PostgreSQL（`sql.dataSource.url`） |
| 実装で加わる部品 | Operator、`ApicurioRegistry3` リソース、DB パスワードの Secret、Ingress |

Ingress は `spec.app.ingress.host` と `spec.ui.ingress.host` から作られる。PostgreSQL がクラスター内外のどちらで動くかは公式資料の例が `postgresql.my-project.svc` を使うだけで、固定されていない。図ではクラスターの外の利用者管理の DB とした。公式資料を組み合わせた代表例で、実環境での動作は未検証である。

## 公式資料

- [Introduction to Apicurio Registry](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-intro-to-the-registry.html)
- [Apicurio Registry concepts and glossary](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-registry-concepts-glossary.html)
- [Managing artifacts using the REST API](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-managing-registry-artifacts-api.html)
- [Apicurio Registry content rules](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-intro-to-registry-rules.html)
- [Confluent Schema Registry compatibility](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-confluent-schema-registry-compatibility.html)
- [Installing Apicurio Registry storage on OpenShift](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-installing-registry-storage-openshift.html)
- [Installing using Docker](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-installing-registry-docker.html)
- [Deploying using the Operator](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-deploying-registry-operator.html)
- [Deploying for high availability](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-registry-high-availability.html)
- [Configuration reference](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-config-reference.html)
