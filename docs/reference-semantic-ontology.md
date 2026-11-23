# オントロジーと RDF ナレッジグラフ

## 1. 対象
業務用語、概念間の関係と実データを識別可能なグラフとして表し、問い合わせと推論に利用する構成。指標の定義・SQL 生成を主題とするセマンティック層とは役割が異なるが、業務用語を共有することで連携できる。

## 2. 機能配置と処理
業務担当者と管理者が「顧客」「注文」などの概念、用語と関係を定義する。RDF は主語・述語・目的語のトリプルの集合としてグラフを表し、IRI によって概念や実体を識別する。RDFS はクラスとプロパティの階層等を、OWL はより表現力のあるオントロジーを定義する。SKOS は用語集や分類体系の概念、優先・別名、階層と対応関係を表す。RDF データと定義を保存し、必要に応じて推論を構成し、SPARQL のグラフパターンを問い合わせる。

## 3. 設計上の注意
OWL のオープンワールドでは、記述されていない事実が直ちに偽とは限らない。推論が導く事実は、使う推論器と設定の範囲に依存し、すべての OWL 推論が自動的に有効になるわけではない。SKOS の概念の階層と OWL のクラス階層は同一視しない。IRI の命名、定義の版、出典、アクセス権、推論の結果を区別して管理する。SHACL による明示的なデータ検証は別の処理である。

## 4. 実装例：Apache Jena と Fuseki
Turtle の RDF データと RDFS 語彙を Jena Fuseki に読み込み、明示的に RDFS 推論を有効にして SPARQL で問い合わせる例。OWL や SKOS の概念を説明する一般図に対して、この実装例の推論範囲は Jena の RDFS 設定に限定する。実行環境やアクセス制御は別途設計する。

| 機能 | 担い手 |
|---|---|
| 業務定義 | RDFS 語彙ファイルと担当者 |
| 実体・関係 | Turtle の RDF データ |
| 保存と推論 | Fuseki のデータセットと RDFS 推論設定 |
| 問い合わせ | Fuseki SPARQL エンドポイントとクライアント |

[W3C RDF 1.1](https://www.w3.org/TR/rdf-concepts/)、[OWL 2 Primer](https://www.w3.org/TR/owl2-primer/)、[SKOS](https://www.w3.org/TR/skos-reference/)、[Apache Jena RDFS](https://jena.apache.org/documentation/rdfs/)、[SPARQL](https://www.w3.org/TR/sparql11-query/)。
