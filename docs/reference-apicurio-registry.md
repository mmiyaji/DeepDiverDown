# Apicurio Registry の Avro スキーマ管理と互換性

## 1. 題材と範囲

Apicurio Registry 3.4 と Kafka の Avro SerDe を使う架空の構成で、注文イベント `Order` のスキーマを更新する。例の ID、イベント、登録可否は仕様を追うための説明で、稼働環境を測定した結果は含まない。[Avro ファイル形式の教材](reference-avro-internals.md) は Avro のコンテナファイルを扱う。この例では Kafka レコードに ID とエンコード済みデータを載せる。

## 2. 書き込みに使ったスキーマを識別する

Registry に Avro スキーマを artifact として登録し、改訂をバージョンにする。Avro serializer は書き込みに使う writer schema を解決し、対応する ID を付けて Kafka へ送る。この例では `apicurio.registry.use-id=contentId` を使い、ID を Kafka ペイロードに載せる。設定で `globalId` を使ったり、ID を Kafka ヘッダーに載せたりできるため、Producer と Consumer の SerDe の構成を合わせる。

`contentId` はスキーマの内容を識別し、同じ内容の複数バージョンに共有され得る。`globalId` は個別の artifact バージョンを識別する。

## 3. writer schema と reader schema を組み合わせる

Consumer はメッセージに付いた ID から、実際に書き込みに使われた v1 の writer schema を特定する。Avro のスキーマ解決には、この writer schema と、読み手が指定した v2 の reader schema を使える。

| バージョン | フィールド |
| --- | --- |
| v1 | `id: long` |
| v2 | `id: long` と `currency: string`。currency の既定値は `"JPY"`。 |
| v3 | `id: long` と `currency: string`。currency の既定値なし。 |

三つのスキーマのレコード完全名は同じとする。v2 の reader が v1 の注文を読むと、writer schema にない `currency` を reader schema の既定値 `"JPY"` で補う。v1 の reader が v2 の注文を読むと、v2 の writer schema にだけある `currency` を読み飛ばす。Avro のフィールド既定値はスキーマ解決で使われ、writer schema にあるフィールドは書き込み時にエンコードされる。

## 4. 互換性ルールで読み手と書き手の向きを指定する

| モード | 旧版と新版の比較 |
| --- | --- |
| `BACKWARD` | 新しい reader が、直前の writer のデータを読める。 |
| `FORWARD` | 直前の reader が、新しい writer のデータを読める。 |
| `FULL` | 上の両方向を満たす。 |

`*_TRANSITIVE` は、比較を直前の版からすべての比較対象の旧版に広げる。Apicurio Registry 3.4 のルールは `DISABLED` のバージョンを比較から除き、`DEPRECATED` のバージョンを含める。

## 5. 二世代前の履歴が残る場合

v2 のフィールド追加は v1 に対して両方向に互換。v3 では `currency` の既定値を外す。v2 で書かれたデータには `currency` が含まれるため、v3 の reader で読め、v2 だけを比較する `BACKWARD` を通過する。v1 が比較対象に残っている場合、`BACKWARD_TRANSITIVE` は v1 も検査する。v1 のデータに `currency` はなく、v3 の reader に既定値がないため拒否される。Kafka の履歴を再読する期間と、Registry で比較対象に含めるバージョンを対応付ける。

## 6. 公式資料

- [Apicurio Registry 3.4 Kafka SerDes](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-using-kafka-client-serdes.html)
- [Apicurio Registry 3.4 Schema Compatibility Modes](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-registry-compatibility-modes.html)
- [Apache Avro 1.12 Schema Resolution](https://avro.apache.org/docs/1.12.0/specification/#schema-resolution)
- [Apicurio Registry 3.2 Concepts Glossary](https://www.apicur.io/registry/docs/apicurio-registry/3.2.x/getting-started/assembly-registry-concepts-glossary.html)
