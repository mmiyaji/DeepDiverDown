# Neo4j のプロパティグラフとネイティブのグラフ保存

## 1. 概要

Neo4j はプロパティグラフを扱うグラフデータベースである。問い合わせは Cypher で書く。データはノードとリレーションシップのレコードとして保存し、書き込みはトランザクションログに記録する。クラスタ構成は Enterprise Edition の機能である。2026 年 11 月時点の公式資料に基づく。

[Neo4j Operations Manual](https://neo4j.com/docs/operations-manual/current/introduction/)

## 2. プロパティグラフと Cypher

ノードは 0 個以上のラベルとプロパティ（キーと値）を持つ。リレーションシップは開始ノード、終了ノード、1 つのタイプ、向きを持ち、プロパティも持てる。公式資料は、リレーションシップがノードと並べてネイティブに保存されるため、結合（JOIN）は使わないと説明している。「index-free adjacency」という語は取得した資料に出てこない。

Cypher は Neo4j の宣言型の問い合わせ言語である。現在の資料は Cypher 25 を扱い、2025.06 以降は新機能を Cypher 25 にだけ追加する。パターン照合の構文、GQL との関係は今回取得した資料になく未確認。

[Graph database concepts](https://neo4j.com/docs/getting-started/get-started-with-neo4j/graph-database/)
[Cypher Manual](https://neo4j.com/docs/cypher-manual/current/introduction/)

## 3. ネイティブのグラフ保存

保存形式は `db.format` で選ぶ。`block` は Enterprise Edition 向けの推奨形式で、`db.format` 未指定の既定でもある。`aligned` は Community Edition の既定である。`standard` と `high_limit` は 5.23 で非推奨になった。

`aligned`・`standard`・`high_limit` は、グラフデータを「リンクリスト状の構造」でディスクに置く。ノードストア、リレーションシップストア、プロパティストアのレコード構造と、レコード間のポインタ（リレーションシップチェーン）の詳細は、取得した資料に記載がなく未確認。

`block` は次のファイルで構成する。

| ファイル | 内容 |
| --- | --- |
| `block.x1.db` | 小さなストア。128 B の固定ブロックに、ノードデータ（ラベル・プロパティ）とリレーションシップデータを置く |
| `block.node.xd.db`、`block.relationship.xd.db` | 128 B のブロックに収まらないノード・リレーションシップの動的レコード |
| `block.relationship.dense.db` | 多数のリレーションシップを持つノード向け。ノードごとにルートを持つ B+ ツリー |
| `block.big_values.db` | 約 31 B を超えるプロパティ値（長い文字列、配列） |

プロパティはノード・リレーションシップのブロックの中に置き、小さな値はインラインにする。小さなストアの記録は、動的レコードへの参照を持つ。

[Store formats](https://neo4j.com/docs/operations-manual/current/database-internals/store-formats/)

## 4. トランザクションとログ

グラフ、インデックス、スキーマにアクセスする操作はトランザクションで実行し、ACID に従う。トランザクションが持つロックとメモリは、完了時に解放される。分離レベルとデッドロックの扱いは取得した資料になく未確認。

書き込みは、データ・インデックス・制約のすべてをトランザクションログに記録する。既定の置き場所は `<NEO4J_HOME>/data/transactions/<データベース名>` で、ログを手で消すことは未サポートである。`db.tx_log.rotation.size` の既定は 256 MiB、保持は `db.tx_log.rotation.retention_policy` の既定が `2 days 2G`。

チェックポイントは、メモリ上の未反映の更新をストアのファイルに書き出す。異常終了後の起動では、ストアに反映が確認できていないトランザクションをログから再生する。チェックポイントは再生する量を減らし、反映済みのログを削除できるようにする。`db.checkpoint` の既定は PERIODIC（100,000 トランザクションまたは 15 分）。CONTINUOUS と VOLUMETRIC は Enterprise である。

[Transaction logs](https://neo4j.com/docs/operations-manual/current/database-internals/transaction-logs/)
[Checkpointing](https://neo4j.com/docs/operations-manual/current/database-internals/checkpointing/)
[Transaction management](https://neo4j.com/docs/operations-manual/current/database-internals/transaction-management/)

## 5. クラスタ（Raft の primary / secondary）

クラスタは複数のデータベースを動かすサーバーのプールである。データベースのコピーは primary か secondary のどちらかで、サーバーは `modeConstraint`（PRIMARY / SECONDARY / NONE）で受け持てる種別を制限できる。

- primary：書き込みを処理する。1 つがライターに選ばれ、ライターは他の primary へ同期的に複製してからコミットを完了する。primary のグループは Raft ログを共有し、リーダーが応答しなくなると選挙で選び直す。
- secondary：トランザクションログの配布を非同期で受け、読み取りを増やすために使う。遅れることがあり、失っても可用性と耐障害性には影響しない。
- 書き込みの可用性は primary の過半数が動くことが条件で、M = 2F + 1 に従う。primary 3 台で 1 台、5 台で 2 台の障害に耐える。公式資料は 11 台を超える primary を推奨していない。
- 読み取りは secondary と、既定では非ライターの primary も処理できる。ブックマークで自分の書き込みを読み戻せる。

Raft の選挙・ログ複製の詳細な手順は取得した資料の範囲になく未確認。

[Clustering introduction](https://neo4j.com/docs/operations-manual/current/clustering/introduction/)

## 6. Community と Enterprise の違い

| 項目 | Community | Enterprise |
| --- | --- | --- |
| 位置づけ | 単一インスタンスの配備向け | クラスタ構成の本番配備向け |
| クラスタ | 対象外 | あり |
| バックアップ | オフラインのダンプ | オンラインバックアップ・復元を追加 |
| セキュリティ | 資料に記載なし | ロールベースのアクセス制御、LDAP などを追加 |
| 保存形式 | `aligned` が既定 | `block` が推奨・既定。`high_limit` は Enterprise |
| チェックポイント | PERIODIC、VOLUME | CONTINUOUS、VOLUMETRIC を追加 |

`system` と既定以外の複数データベースを Community で作れるかは、資料に明記がなく未確認（作成手順のページは Enterprise Edition と表示されている）。機能の完全な対応表は取得できておらず、上の表は取得できた記述に限る。

[Operations Manual 概要](https://neo4j.com/docs/operations-manual/current/introduction/)

## 7. 実装例：自前サーバーの Enterprise クラスタ

| 機能 | 具体的な担い手 |
| --- | --- |
| クライアント | アプリケーションの Neo4j ドライバー |
| Cypher・ストア・ログ | 各サーバーの Neo4j（Enterprise） |
| ライター primary | primary のコピーの 1 つ |
| 同期複製の相手 | 他の primary |
| 読み取り用 | secondary のコピー |

代表的な構成であり、導入事例や動作検証済みの構成ではない。サーバー台数、ネットワーク、ドライバーのルーティング設定は未確認。
