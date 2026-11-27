# Apache AGE のグラフ保存と SQL 内の openCypher

## 1. 概要

Apache AGE は PostgreSQL の拡張で、同じデータベースでリレーショナルデータとグラフデータを扱う。グラフの問い合わせは openCypher を使い、SQL の中から呼び出す。名前は "A Graph Extension" の略で、AgensGraph（PostgreSQL 10 のフォーク）に着想を得ている。2026 年 11 月時点の公式資料に基づく。

[AGE Manual: Overview](https://age.apache.org/age-manual/master/intro/overview.html)

## 2. 対応する PostgreSQL バージョン

GitHub の README は PostgreSQL 11、12、13、14、15、16、17、18 に対応すると記す。一方、マニュアルのセットアップ頁は 11〜15 までの記載で、資料間で食い違う。最新リリースは v1.8.0（README のバッジ）。バージョンごとのブランチ対応は未確認。

[apache/age (GitHub)](https://github.com/apache/age) / [AGE Manual: Setup](https://age.apache.org/age-manual/master/intro/setup.html)

## 3. 導入と接続ごとの設定

ソースからのビルド（`make install`、`pg_config` が PATH にない場合は `PG_CONFIG` を指定）か Docker イメージ `apache/age` で入れる。次を実行する。

- `CREATE EXTENSION age;`（データベースごとに 1 回）
- `LOAD 'age';`（接続ごと）
- `SET search_path = ag_catalog, "$user", public;`（接続ごと）

他のロールへ CREATE 権限を与える前に AGE を入れる。`ag_catalog` が別ロール所有で既にあると `CREATE EXTENSION age` が失敗する。

[apache/age (GitHub)](https://github.com/apache/age)

## 4. ag_catalog とグラフの登録

グラフは `ag_catalog.ag_graph` に名前と名前空間（スキーマ）を登録する。グラフごとに PostgreSQL の名前空間が 1 つ作られる。ラベルは `ag_catalog.ag_label` に、名前・グラフ・ID・種別（v が頂点、e が辺）・リレーション・シーケンス名を記録する。グラフの予約された名前空間に直接 DML や DDL を実行しないことが推奨されている。

[AGE Manual: Graphs](https://age.apache.org/age-manual/master/intro/graphs.html)

## 5. 頂点・辺の保存

各グラフの名前空間に親テーブル `_ag_label_vertex` と `_ag_label_edge` ができる。頂点ラベルは `create_vlabel()`、辺ラベルは `create_elabel()` で `<グラフ名>."<ラベル名>"` というテーブルとして作られ、Cypher の `CREATE` でも自動で作られる。ラベルテーブルの列名は、マニュアルの取得範囲に記載がなく未確認。

[AGE Manual: Graphs](https://age.apache.org/age-manual/master/intro/graphs.html)

## 6. agtype

agtype は AGE が結果や属性に使う独自の型で、JSON の上位集合（JSONB の独自実装）と説明されている。頂点と辺は graphid で識別され、graphid はラベル ID とラベルごとのシーケンスから作られる。ID はグラフ間で重なることがある。

- 頂点の属性：id、label、properties
- 辺の属性：id、startid、endid、label、properties（ラベルは必ず 1 つ）
- パス：頂点から始まり、辺と頂点が交互に並ぶ

[AGE Manual: Data Types](https://age.apache.org/age-manual/master/intro/types.html)

## 7. SQL 内の openCypher 呼び出し

`cypher(graph_name, query_string, parameters)` を FROM 句に書き、AS で結果列を定義する。結果が空でも列定義は必須。

```sql
SELECT * FROM cypher('graph_name', $$ ... $$) AS (result1 agtype, result2 agtype);
```

パラメーターのマップはプリペアドステートメントでだけ使える。JOIN や CTE との組み合わせは Advanced Cypher Queries の頁にあり、今回は未確認。

[AGE Manual: Cypher Query Format](https://age.apache.org/age-manual/master/intro/cypher.html)

## 8. 制限

- SQL の式の中では Cypher を使えない。SELECT 句に `cypher()` を置くと "cypher(...) in expressions is not supported" になる。サブクエリにする。
- 非自動コミットのクライアント（psycopg v3、JDBC など）では、`create_graph` や `cypher` の書き込みはコミットするまで他のセッションから見えない。
- インデックスと openCypher の対応範囲の公式な制限一覧は今回の資料になく未確認。

[apache/age (GitHub)](https://github.com/apache/age) / [AGE Manual: Cypher Query Format](https://age.apache.org/age-manual/master/intro/cypher.html)

## 9. 実装例：自前の PostgreSQL サーバー

| 機能 | 具体的な担い手 |
| --- | --- |
| クライアント | psql やアプリケーション |
| SQL の入口・通常のテーブル | PostgreSQL サーバー |
| cypher() | PostgreSQL に導入した AGE 拡張 |
| グラフの登録情報・頂点・辺 | ag_catalog とグラフの名前空間のテーブル |

代表的な構成であり、導入事例や動作検証済みの構成ではない。ノード台数、レプリケーション、クラウドのマネージド提供は未確認。
