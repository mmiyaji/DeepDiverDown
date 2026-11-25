# Apicurio Registry：シリアライザーとスキーマ ID の受け渡し

Apicurio Registry 3.4 の公式ドキュメントを基準に、Kafka の Java クライアントが、Serializer でスキーマを決めて ID をレコードに付け、Deserializer がその ID から writer schema を取り出すまでを追う。前提は「Apicurio Registry の基本アーキテクチャ」（アーティファクト、バージョン、contentId、globalId）。

## 1. 対象と前提

- 対象は、Kafka の Producer・Consumer に組み込む Serializer / Deserializer（SerDes）。Avro、Protobuf、JSON Schema を扱える。
- 例のスキーマ `Order` は、仕様を追うための架空の例で、稼働環境の測定結果ではない。
- 互換性ルールは次の「互換性ルールとバージョン管理」で扱う。

## 2. アーティファクトの座標を決める

Serializer は、レコードごとに `groupId`・`artifactId`・`version` を決める。

- `apicurio.registry.artifact-resolver-strategy` のクラスが決める。既定は `TopicIdStrategy` で、トピック名からアーティファクト ID を作る（key と value で別になる）。
- ほかに `SimpleTopicIdStrategy`、`RecordIdStrategy`、`TopicRecordIdStrategy`、`QualifiedRecordIdStrategy` がある。
- `apicurio.registry.artifact.group-id`・`artifact-id`・`version` を指定すると、戦略の結果を上書きする。

## 3. スキーマを探す・登録する

- `apicurio.registry.find-latest=true`（既定 `false`）なら、座標のアーティファクトの最新バージョンを探す。
- `apicurio.registry.auto-register=true`（既定 `false`）なら、なければ登録する。既にある場合の動きは `apicurio.registry.auto-register.if-exists`（`FAIL`・`CREATE_VERSION`・`FIND_OR_CREATE_VERSION`、既定は `FIND_OR_CREATE_VERSION`）で決める。JSON Schema の Serializer は自動登録に対応しない。
- `apicurio.registry.canonicalize=true`（既定 `false`）なら、意味が同じスキーマを同一とみなして照合する。
- Avro では `apicurio.registry.avro.validate-writer-schema`（既定 `true`）により、データが writer schema に合わないと Serialize が失敗する。エンコードは `apicurio.registry.avro.encoding`（既定 `BINARY`、`JSON` も可）。

本番では自動登録を使わず、登録担当が事前に登録したスキーマを Registry のルールの下で管理する運用が考えられる。公式資料は、どちらを推奨するかを述べていない（未確認）。

## 4. ID の種類と置き場所

| 項目 | 内容 |
| --- | --- |
| `apicurio.registry.use-id` | `contentId`（既定）または `globalId`。Producer と Consumer で合わせる。 |
| contentId | スキーマの内容の ID。同じ内容の複数バージョンで共有される。 |
| globalId | アーティファクトのバージョンごとの ID。 |
| `apicurio.registry.id-handler` | ID の書き方。既定は `Default4ByteIdHandler`（4 バイト）。`Legacy8ByteIdHandler` は 8 バイトの整数。 |
| `apicurio.registry.headers.enabled` | 既定 `false`。`true` なら ID をメッセージのヘッダーに入れる。 |

既定ではペイロードに、先頭からマジックバイト、ID、データの順に載る。Deserializer は先頭のマジックバイトを見て、あればペイロードから ID を読み、なければヘッダーから読む。マジックバイトの値とヘッダーのキー名は、確認した資料に書かれていない（未確認）。Deserializer は、アーティファクトの座標の戦略や ID の置き場所の設定を要らない。メッセージから分かるためである。

## 5. Deserializer：ID から writer schema を取り出す

1. ID の場所を判定し、ID を読む。
2. `use-id` の種類で Registry に問い合わせる。結果はキャッシュする。
3. 取得に失敗すると、`apicurio.registry.retry-count`（既定 3）回、`retry-backoff-ms`（既定 300）の間隔で再試行する。
4. なお失敗するときは、`apicurio.registry.fallback.provider` が指すフォールバックのアーティファクト（`fallback.group-id`・`artifact-id`・`version`）を使える。いずれも既定値はない。
5. データを復号する。Avro では `apicurio.registry.avro-datum-provider`（既定 `DefaultAvroDatumProvider`）が Generic・Specific・Reflect を扱い、`apicurio.registry.use-specific-avro-reader=true` で Specific を選ぶ。Protobuf は `apicurio.registry.deserializer.value.return-class` を指定しなければ `DynamicMessage` を返す。

## 6. キャッシュ

- 座標（group と artifact）による検索は、`apicurio.registry.check-period-ms`（既定 30000）の間キャッシュされる。`0` なら毎回取得する。
- ID による検索のキャッシュには期限がない。
- `apicurio.registry.fault-tolerant-refresh=true`（既定 `false`）なら、キャッシュの更新に失敗してもエラーにせずログに残す。

## 7. writer schema と reader schema

Consumer はレコードの ID で、データを書いたときの writer schema を得る。Avro のスキーマ解決は、これと読み手側のスキーマ（reader schema）を組み合わせる。

| バージョン | フィールド |
| --- | --- |
| v1 | `id: long` |
| v2 | `id: long` と `currency: string`（既定値 `"JPY"`） |

v2 を読み手に使う Consumer が v1 で書かれたレコードを読むと、writer schema にない `currency` は reader schema の既定値 `"JPY"` で補われる。Apicurio の資料は、Avro の reader schema を指定する専用の設定を説明していない（未確認）。Specific reader では生成クラスのスキーマが読み手側になる、という点も、資料からは確認できない。

## 8. 実装例：オンプレミス Kubernetes・Kafka・KafkaSQL

利用者のデータセンターで、Kubernetes 上の Producer / Consumer の Pod、Kafka、Registry（KafkaSQL）を動かす例。Registry のストレージに Kafka を使うため、スキーマの履歴も Kafka の `kafkasql-journal` トピックに置かれる。

| 機能 | 担い手 |
| --- | --- |
| Producer・Serializer・SchemaResolver（Producer 側） | Producer の Pod（Java、SerDes ライブラリ） |
| 注文イベントのトピック | Kafka の注文トピック |
| Deserializer・SchemaResolver（Consumer 側）・フォールバック | Consumer の Pod（Java、SerDes ライブラリ） |
| Registry API | Registry の app Pod（`APICURIO_STORAGE_KIND=kafkasql`） |
| 実装で加わる部品 | `kafkasql-journal` トピック、Pod ごとの組み込み H2、Registry の Service |

KafkaSQL は Kafka を主のデータストアにし、各レプリカは journal を最初から読み直して組み込み H2 を再構築する。レプリカごとに自動生成の UUID のコンシューマーグループを使い、レプリカ間のリバランスはない。journal トピックは `cleanup.policy: delete`、`retention.ms: -1`、`retention.bytes: -1` にする必要があり、満たさないと Registry は起動しない。接続先は Operator の CR の `spec.app.storage.kafkasql.bootstrapServers` か、環境変数 `APICURIO_KAFKASQL_BOOTSTRAP_SERVERS` で指定する。

業務データのトピックと journal を同じ Kafka クラスターに置くか、別にするかは、公式資料が指定していない。図では同じ Kafka クラスターに置いた。Kafka の運用（ブローカーの台数、認証）、各 Pod の台数、バージョンの組み合わせは未確認で、公式資料を組み合わせた代表例である。

## 公式資料

- [Validating Kafka messages using SerDes in Java clients](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-using-kafka-client-serdes.html)
- [Configuring Kafka SerDes in Java clients](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-configuring-kafka-client-serdes.html)
- [Apicurio Registry concepts and glossary](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-registry-concepts-glossary.html)
- [Installing Apicurio Registry storage on OpenShift](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-installing-registry-storage-openshift.html)
- [Deploying for high availability](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-registry-high-availability.html)
- [Installing using Docker](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-installing-registry-docker.html)
