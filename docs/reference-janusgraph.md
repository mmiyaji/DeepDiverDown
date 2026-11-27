# JanusGraph の基本アーキテクチャ

## 1. 概要

JanusGraph は、TinkerPop のプロパティグラフモデルと Gremlin トラバーサル言語を公開するグラフデータベースである。データの保存は差し替え可能な保存バックエンドが担い、全文・範囲・地理検索は任意の索引バックエンドが担う。2026 年 11 月時点の公式資料に基づく。

[JanusGraph Documentation](https://docs.janusgraph.org/)

## 2. Gremlin Server と接続

JanusGraph Server は Gremlin Server を土台にした JanusGraph のサーバーで、クライアントは Gremlin をリモートから実行する。既定のポートは 8182。設定は `conf/gremlin-server/gremlin-server.yaml` で、`graphs` セクションがグラフ名とプロパティファイルを対応付ける。プロパティファイルには `gremlin.graph=org.janusgraph.core.JanusGraphFactory` と保存バックエンドの設定を書く。Gremlin Console の接続手順は今回の取得範囲になく未確認。

[JanusGraph Server](https://docs.janusgraph.org/operations/server/)

## 3. 保存バックエンド

保存層は差し替え可能である。公式資料が挙げる保存バックエンドは Apache Cassandra、Apache HBase、Google Cloud Bigtable、ScyllaDB、Oracle Berkeley DB Java Edition、InMemory。Cassandra は可用性を重視し、HBase は一貫性を重視する。BerkeleyDB は分散しない構成で、テストや試用向けとされる。Bigtable、ScyllaDB、InMemory の個別の特性は未確認。

[Storage Backends](https://docs.janusgraph.org/storage-backend/)

## 4. 索引バックエンド

全文・数値範囲・地理検索には、混合索引（mixed index）用の索引バックエンドを使う。公式資料が挙げるのは Elasticsearch、Apache Solr、Apache Lucene。`index.<名前>.backend` で名前を付け、混合索引の作成時に同じ名前を `buildMixedIndex` に渡す。Elasticsearch は `index.search.hostname` に接続先を指定し、既定の HTTP ポートは 9200。OpenSearch 2 と 3 も `elasticsearch` バックエンドで使える。Solr と Lucene の設定項目は未確認。

[Elasticsearch](https://docs.janusgraph.org/index-backend/elasticsearch/)

## 5. スキーマ

頂点ラベルは `makeVertexLabel`、エッジラベルは `makeEdgeLabel`、プロパティキーは `makePropertyKey` で定義する。エッジラベルの多重度は MULTI（既定）、SIMPLE、MANY2ONE、ONE2MANY、ONE2ONE。プロパティキーのカーディナリティは SINGLE（既定）、LIST、SET。未定義の型は初回使用時に自動作成されるため、`schema.default=none` で止められる。`schema.constraints=true` で、ラベルに使えるプロパティと、エッジがつなぐ頂点ラベルの組を制限できる。制約は書き込み時にだけ効き、読み取りには影響しない。

[Schema and Data Modeling](https://docs.janusgraph.org/schema/)

## 6. 索引の種類と頂点中心インデックス

| 種類 | 保存先 | 検索条件 |
| --- | --- | --- |
| 複合索引（composite） | 保存バックエンド | 等価のみ。`unique()` で一意性を指定できる |
| 混合索引（mixed） | 索引バックエンド | 全文（`textContains`）、範囲、地理。一意性は不可 |
| 頂点中心インデックス | 保存バックエンド（`edgeStore`） | 頂点ごとのエッジの等価・範囲 |

頂点中心インデックスは `buildEdgeIndex(ラベル, 名前, 方向, 順序, キー...)` で作る。1 つの頂点に多数のエッジがあるとき、条件に合うエッジだけを読む。キーの順序が重要で、先頭のキーを等価で絞ってから次のキーが効く。索引の作成後は有効になるまで待ち、既存データには REINDEX が必要になる。本番では `force-index` で全体走査を防げる。

[Index Management](https://docs.janusgraph.org/schema/index-management/index-performance/)

## 7. 実装例：自前の Cassandra と Elasticsearch

| 機能 | 具体的な担い手 |
| --- | --- |
| クライアント | アプリケーション、Gremlin Console |
| Gremlin 実行・グラフ | JanusGraph Server |
| 保存バックエンド | Apache Cassandra |
| 索引バックエンド | Elasticsearch |

公式資料の組み合わせによる代表的な構成であり、導入事例や動作検証済みの構成ではない。ノード台数、レプリケーション、認証、バージョンの組み合わせは未確認。
