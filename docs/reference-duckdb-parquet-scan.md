# DuckDB：Parquet スキャンと行グループの除外

## 1. 題材と範囲

DuckDB から架空の `orders.parquet` を直接検索する。期間は 2026-01-25 以上、2026-02-01 未満の 7 日間で、顧客は 42。[ClickHouse の教材](reference-clickhouse.md) と共通の条件。ファイル配置、統計値、図のチャンクは説明用で、実ファイルから計測した値は含まない。

## 2. SELECT を Parquet スキャンへ落とす

```sql
SELECT order_id, amount
FROM read_parquet('orders.parquet')
WHERE order_date >= DATE '2026-01-25'
  AND order_date < DATE '2026-02-01'
  AND customer_id = 42;
```

列投影のプッシュダウンでスキャンは必要列だけを要求する。結果の `order_id` と `amount` に加え、日付と顧客の述語を評価するための列も参照する。`notes` は出力と条件のどちらにも登場しないため、列データの読み取り対象から外れる。フィルタのプッシュダウンでは、日付範囲と顧客の等値条件をスキャンへ渡す。

## 3. 行グループ単位で除外する

Parquet のフッターには行グループを構成する列チャンクのメタデータがある。対応する min/max が利用可能なとき、DuckDB は述語を満たす行が存在し得るかを調べる。次の範囲は両端を含む。

| 行グループ | order_date の範囲 | customer_id の範囲 | 判定 |
| --- | --- | --- | --- |
| G0 | 2026-01-18 ～ 2026-01-24 | 1 ～ 60 | 日付で除外 |
| G1 | 2026-01-25 ～ 2026-01-31 | 1 ～ 60 | 候補 |
| G2 | 2026-01-25 ～ 2026-01-31 | 100 ～ 200 | 顧客で除外 |

G1 の日付・顧客の範囲は検索条件と重なるため、候補として読む。実際に条件を満たす行はファイルのデータを読んで判定する。Parquet の行グループは既定で 122,880 行以上の単位で書かれる（`ROW_GROUP_SIZE`、下限は 2,048 行）。ファイルの行グループ数が少ないと、除外できる単位も並列に処理できる単位も少なくなる。DuckDB 2.0 は Parquet のページインデックスも読み書きし、条件に合うデータページだけを読める。除外は、ファイルに統計（ゾーンマップ）がある場合に働く。必要な統計が欠けていたり、各グループの値域が広く重なったりすると、統計による除外は限定される。

## 4. 物理計画と実行を確認する

`EXPLAIN` を SELECT の先頭に付け、スキャン演算子に投影列とフィルタが現れるかを調べる。表示されるカーディナリティは推定値。`EXPLAIN ANALYZE` はクエリを実際に実行し、各演算子の実行時の行数や時間を示す。演算子の出力行数だけから、除外された行グループ数や圧縮データの読み取り量は求められない。

```sql
SELECT row_group_id, path_in_schema, stats_min_value, stats_max_value
FROM parquet_metadata('orders.parquet')
WHERE path_in_schema IN ('order_date', 'customer_id')
ORDER BY row_group_id, path_in_schema;
```

メタデータの範囲を別途調べ、どの行グループの除外を期待できるかを確認する。

## 5. ClickHouse の例との対応

DuckDB は Parquet に既に保存された行グループ単位の列統計を使う。ClickHouse の MergeTree は INSERT またはマージ時に作るソートキー順のパートと、グラニュール境界上の疎主インデックスを使う。両方とも候補を絞った後で行の条件を評価する。

## 6. 公式資料

- [DuckDB Parquet Overview](https://duckdb.org/docs/2.0/data/parquet/overview.html)
- [DuckDB Parquet Tips](https://duckdb.org/docs/2.0/data/parquet/tips.html)
- [DuckDB Reading and Writing Parquet Files](https://duckdb.org/docs/data/parquet)
- [DuckDB Querying Parquet Metadata](https://duckdb.org/docs/current/data/parquet/metadata)
- [DuckDB EXPLAIN](https://duckdb.org/docs/stable/guides/meta/explain)
- [DuckDB Profiling](https://duckdb.org/docs/current/dev/profiling)

## 7. 実装例：Python に組み込む DuckDB と Parquet

Python プロセス内の DuckDB がローカルの orders.parquet を直接読む例。必要な列と行グループを絞り、データの読取と性能の観測は同じ埋め込みエンジンで行う。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 検索 SQL と計画の確認 | Python の DuckDB 接続 | duckdb.connect で作った接続から SQL を実行する。 |
| 読取の最適化、Parquet スキャン、結果の投影、実行時の観測 | 同じプロセスの DuckDB エンジン | read_parquet へ述語と列要求を渡し、EXPLAIN ANALYZE で実行を観測する。 |
| フッター統計、行グループ、列チャンク | ローカルの orders.parquet | フッターと列チャンクを持ち、直接読み取れる。 |

実装で加わる部品を以下に示す。

- parquet_metadata の診断用 SQL。日付と顧客 ID の min/max を確認して候補グループの説明に使う。

公式資料

- [DuckDB Reading and Writing Parquet Files](https://duckdb.org/docs/data/parquet)
- [DuckDB Querying Parquet Metadata](https://duckdb.org/docs/current/data/parquet/metadata)
- [DuckDB EXPLAIN](https://duckdb.org/docs/stable/guides/meta/explain)
- [DuckDB Profiling](https://duckdb.org/docs/current/dev/profiling)
- [DuckDB Python API](https://duckdb.org/docs/stable/clients/python/overview)
