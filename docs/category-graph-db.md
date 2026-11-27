# グラフデータベースの違い

OSS・自前運用型

| 観点 | Neo4j | Apache AGE | Memgraph | NebulaGraph | JanusGraph |
| --- | --- | --- | --- | --- | --- |
| 特徴 | **ネイティブ保存** のプロパティグラフ。クラスタは Enterprise | **PostgreSQL の拡張**。SQL の中で openCypher を呼ぶ | **インメモリ** のグラフ DB。Neo4j とほとんどのクエリで互換とされる | **graphd・metad・storaged** の 3 サービスに分けた分散グラフ DB | **保存と索引を差し替える** Gremlin のグラフ DB |
| データモデル | プロパティグラフ（ラベル・プロパティつきのノードと **リレーションシップ**） | プロパティグラフ。頂点・辺は **agtype** で扱う | プロパティグラフかは未確認（クエリは Cypher） | **スペース** ごとにタグ・エッジタイプ・プロパティ。**スキーマ必須** | TinkerPop のプロパティグラフ。**スキーマは自動作成も止められる** |
| クエリ言語 | **Cypher**（現行は Cypher 25） | **openCypher** を `cypher()` で呼ぶ。SQL も使える | **Cypher**（Bolt で接続） | **nGQL**。openCypher とは **一部だけ互換** | **Gremlin**（JanusGraph Server） |
| データの置き場所 | 自前のファイル。**block 形式**（Enterprise の既定）か aligned 形式（Community の既定） | PostgreSQL の **ラベルごとのテーブル**。登録は `ag_catalog` | **RAM**。永続化は **スナップショットと WAL** | **各 storaged の RocksDB**。頂点 ID のハッシュでパーティションへ | **保存バックエンド**（Cassandra・HBase など）。全文・範囲・地理は **索引バックエンド** |
| スケールと冗長化 | **primary と secondary** の Raft クラスタ。primary 3 台で 1 台の障害に耐える | PostgreSQL 側のレプリケーションは未確認 | **MAIN と REPLICA**。自動フェイルオーバーは **Enterprise の HA** | パーティションごとの **Raft**。レプリカ数は 3 を推奨 | **バックエンド任せ**。JanusGraph 側の台数構成は未確認 |
| 得意な用途 | 関係をたどる問い合わせを 1 つのデータベースで | **既存の PostgreSQL** にグラフを足す | **Kafka などのストリーム** を取り込んでグラフで見る | **データを分割** して、大きなグラフを複数台で持つ | **Cassandra や HBase の既存基盤** の上でグラフを持つ |
| 注意点 | Community は **クラスタ対象外**。block 形式は Enterprise 向けの推奨 | 対応 PostgreSQL は **README が 11〜18、マニュアルが 11〜15** で食い違う。SQL の式の中では Cypher を使えない | 分析モードは **ロールバックなし**。オンディスクモードは実験的で、HA 非対応 | **トランザクション非対応**。作成後に変えられない `partition_num`・`replica_factor`・`vid_type` がある | 保存と索引のバックエンドを **別に運用** する。組み合わせの検証は未確認 |

マネージド型

| 観点 | Amazon Neptune |
| --- | --- |
| 特徴 | AWS の **フルマネージド** のグラフ DB。プロパティグラフと RDF の両方を扱う |
| データモデル | プロパティグラフと **RDF**（subject・predicate・object・graph のクアッド）。同じグラフでの混在は未確認 |
| クエリ言語 | **openCypher・Gremlin・SPARQL** |
| データの置き場所 | **クラスターボリューム**。3 AZ に 6 コピー、最大 128 TiB。連続バックアップは S3 |
| スケールと冗長化 | **ライター 1 台** とリーダー最大 15 台。ライター障害はリーダーへ自動フェイルオーバー |
| 得意な用途 | AWS 上で **運用を任せて** グラフを持つ。メモリ上の分析は **Neptune Analytics**（別サービス） |
| 注意点 | **クエリ単位の負荷分散はしない**。Serverless と Global Database は未確認 |

製品の版と提供段階は 2026 年 11 月時点の公式資料に基づきます。確認できなかった点は「未確認」と書いています。

## 選び方

- Cypher で関係をたどり、本番はクラスタで冗長化する → **Neo4j**（Enterprise）
- 既存の PostgreSQL のテーブルと同じ SQL の中でグラフも引く → **Apache AGE**
- Kafka のストリームを取り込み、メモリ上のグラフに Cypher を投げる → **Memgraph**
- スペースを分け、パーティションごとの Raft で大きなグラフを複数台に置く → **NebulaGraph**
- Cassandra や HBase を保存先にし、Gremlin で問い合わせる → **JanusGraph**
- RDF と SPARQL を使う、または運用を AWS に任せる → **Amazon Neptune**

## 公式資料

- [Neo4j Operations Manual](https://neo4j.com/docs/operations-manual/current/introduction/)
- [Apache AGE Manual](https://age.apache.org/age-manual/master/intro/overview.html)
- [Apache AGE (GitHub)](https://github.com/apache/age)
- [Memgraph overview](https://memgraph.com/docs/memgraph/overview)
- [NebulaGraph Architecture overview](https://docs.nebula-graph.io/3.8.0/1.introduction/3.nebula-graph-architecture/1.architecture-overview/)
- [JanusGraph Documentation](https://docs.janusgraph.org/)
- [Amazon Neptune User Guide](https://docs.aws.amazon.com/neptune/latest/userguide/intro.html)
