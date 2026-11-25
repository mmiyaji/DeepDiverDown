# Apicurio Registry：互換性ルールとバージョン管理

Apicurio Registry 3.4 の公式ドキュメントを基準に、スキーマのバージョンの扱いと、互換性ルールが新しいバージョンの登録を受け入れる・拒否する仕組みを追う。前提は「Apicurio Registry の基本アーキテクチャ」と、Serializer が ID を付ける流れ。

## 1. 対象と前提

- 対象は、アーティファクトに新しいバージョンを追加するときの検査（ルール）と、バージョンの状態。
- 例は Avro の `Order` を v1 から v3 へ変える架空のもので、稼働環境の測定結果ではない。

## 2. バージョンと状態

- バージョンは、アーティファクトの内容の不変なスナップショットで、`version` 文字列と globalId を持つ。内容が同じなら contentId を共有する。
- 状態は 3 つで、互いに自由に遷移できる。`ENABLED` は通常どおり使える。`DEPRECATED` は使えるが、取得時に移行を促す警告ヘッダーが付く。`DISABLED` はメタデータだけ見られ、内容は取得できない。
- ブランチはバージョンの順序付きの並びで、既定は `latest`。

## 3. ルールの種類と適用

- 種類は `VALIDITY`（`FULL`・`SYNTAX_ONLY`・`NONE`）、`COMPATIBILITY`（下の表）、`INTEGRITY`（`FULL`・`NO_DUPLICATES`・`NO_CIRCULAR_REFERENCES`・`REFS_EXIST`・`ALL_REFS_MAPPED`・`NONE`）、`GOVERNANCE`（`FULL`・`BASIC`・`NONE`）。
- グローバル、グループ、アーティファクトに設定でき、アーティファクト、グループ、グローバルの順に優先する。種類ごとに判定するので、互換性だけをアーティファクトで変えても、ほかの種類には影響しない。継承を止めるには、下位で `NONE` を設定する。
- 既定のグローバルルールは `apicurio.rules.global.compatibility` などで設定できる。優先度は最も低い。
- 適用されるのは、最初のバージョンや新しいバージョンの追加（`ifExists=CREATE_VERSION` を含む）、ドラフトの公開、`dryRun=true` の検査。ドラフトの作成や編集、インポートでは適用されない。ルールを変えても、登録済みのバージョンは再検査されない。
- 違反は HTTP 400 と `ruleViolation` で返る。`apicurio.rest.legacy-error-codes.enabled=true` なら 409。
- 型ごとの対応が違う。Avro、Protobuf、JSON Schema、OpenAPI、XSD は、検証・互換性・整合性のすべてに対応する。AsyncAPI、OpenRPC、Thrift、WSDL、GraphQL、Kafka Connect、XML は互換性に対応しない。

## 4. 互換性モード

| モード | 比較する版 | 保証 |
| --- | --- | --- |
| `NONE` | なし | 検査しない。 |
| `BACKWARD` | 直前の版 | 新しい版の読み手が、直前の版のデータを読める。 |
| `BACKWARD_TRANSITIVE` | すべての版 | 新しい版の読み手が、過去のすべての版のデータを読める。 |
| `FORWARD` | 直前の版 | 直前の版の読み手が、新しい版のデータを読める。 |
| `FORWARD_TRANSITIVE` | すべての版 | 過去のすべての版の読み手が、新しい版のデータを読める。 |
| `FULL` | 直前の版 | 直前の版に対して、両方向を満たす。 |
| `FULL_TRANSITIVE` | すべての版 | すべての版に対して両方向を満たす。最も厳しい。 |

比較に使う版の範囲は、`DISABLED` の版を除き、`DEPRECATED` の版は含む。古い版が変更を縛るときは、その版を `DISABLED` にする。

## 5. Avro の例：二世代前が残る場合

| バージョン | フィールド |
| --- | --- |
| v1 | `id: long` |
| v2 | `id: long` と `currency: string`（既定値 `"JPY"`） |
| v3 | `id: long` と `currency: string`（既定値なし） |

三つのレコード名は同じとする。v2 の追加は、v1 に対して両方向で互換になる。v3 は既定値を外すが、v2 のデータには `currency` が含まれるので、v3 の読み手は読める。直前の v2 だけを比べる `BACKWARD` は通る。`BACKWARD_TRANSITIVE` は v1 も比べる。v1 のデータに `currency` はなく、v3 には既定値もないので、拒否される。Kafka に残る期間と、比較対象に含める版を対応づける必要がある。

## 6. 型ごとの検査の違い

- **Avro**：Apache Avro のライブラリで検査する。
- **JSON Schema**：Apitomy Data Models で検査し、ドラフト 4、6、7、2019-09、2020-12 に対応する。未知の `$schema` や解決できない参照は、結果ではなく HTTP 422 になる。検査は保守的で、互換な変更を非互換と報告することがある。3.4 でチェッカーが変わり、`apicurio.compat.json-schema.use-apitomy` は非推奨で、4.0 の前に外す必要がある。
- **Protobuf**：数値のフィールドタグに基づくワイヤー形式で検査する。名前の変更は、JSON や生成コードを壊すため非互換とされる。フィールドを削除するときは、タグ番号と名前の両方を `reserved` にする。

## 7. 運用での使い方

- Confluent 互換 API の互換性確認は、COMPATIBILITY ルールがなければ `BACKWARD` だけを検査する。登録時には既定値を適用しない。
- CI では、`dryRun=true` で保存せずにルールの結果を確かめられる。公式資料は、CI での使い方を具体的には述べていない（未確認）。
- 版の削除は、`apicurio.rest.deletion.artifact-version.enabled`（既定 `false`）を有効にしたときだけできる。

## 8. 実装例：オンプレミス Kubernetes・PostgreSQL・CI

利用者のデータセンターの Kubernetes に Registry（PostgreSQL ストレージ）を置き、CI のジョブが REST API または Maven プラグインでスキーマを登録する例。互換性ルールはアーティファクトまたはグループに設定する。

| 機能 | 担い手 |
| --- | --- |
| 登録者 | CI のジョブ（REST・Maven プラグイン） |
| 版の作成 API | Registry の app Pod |
| ルール・互換性の検査 | Registry の app Pod（ルールは Registry が保持） |
| 版・内容 ID の保存 | PostgreSQL |
| 実装で加わる部品 | Ingress、`ApicurioRegistry3` リソース |

`spec.app.storage.type: postgresql` と `sql.dataSource` で PostgreSQL に接続する。CI がどこで動くか、ジョブの認証（OIDC など）、台数は公式資料が指定せず、未確認である。公式資料を組み合わせた代表例で、動作は未検証。

## 公式資料

- [Schema compatibility modes](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-registry-compatibility-modes.html)
- [Content rules](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-intro-to-registry-rules.html)
- [Content rule reference](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-rule-reference.html)
- [Concepts and glossary](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-registry-concepts-glossary.html)
- [Confluent Schema Registry compatibility](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-confluent-schema-registry-compatibility.html)
- [Deploying using the Operator](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-deploying-registry-operator.html)
- [Configuration reference](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-config-reference.html)
- [Maven plug-in](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-managing-registry-artifacts-maven.html)
