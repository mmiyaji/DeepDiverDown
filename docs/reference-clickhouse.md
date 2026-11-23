# ClickHouse の MergeTree：疎インデックスとパートのマージ

## 1. 題材と範囲

架空の注文データを、月単位のパーティションを持つ ClickHouse の `MergeTree` テーブルに格納する。日付の範囲を 2026-01-25 以上、2026-02-01 未満の 7 日間に固定し、顧客 42 の注文番号と金額を取得する。[DuckDB の教材](reference-duckdb.md) は、同じ条件を Parquet ファイルに適用する。図のパートと境界は仕組みを表すための例で、実行結果や計測値は含まない。

## 2. INSERT から不変のパートへ

```sql
CREATE TABLE orders (
  order_id UInt64,
  order_date Date,
  customer_id UInt64,
  amount Decimal(12, 2)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(order_date)
ORDER BY (customer_id, order_date);
```

入力行を月で分け、月ごとに `(customer_id, order_date)` 順のパートを作る。パートは列データ、疎主インデックス、マークを備えた不変の単位。独立した INSERT から同じ月に複数のパートができ得る。ここでは `PRIMARY KEY` を省略しているため、ソートキーを主キーに使う。通常の `MergeTree` の主キーに行の一意性制約はない。

## 3. 日付と顧客による候補の絞り込み

```sql
SELECT order_id, amount
FROM orders
WHERE order_date >= toDate('2026-01-25')
  AND order_date < toDate('2026-02-01')
  AND customer_id = 42;
```

月の条件から 1 月のパートを候補とする。パート内のグラニュールは隣接する行のまとまりで、疎主インデックスには各グラニュールの先頭のキーを保持する。先頭キー列の顧客を等値で指定し、その顧客内の日付範囲を絞る。図ではパート A の境界が (42, 2026-01-01) と (42, 2026-01-20)。最初のグラニュールは期間外で、二つ目は候補に残る。パート B は (42, 2026-01-25) から始まるグラニュールを候補とし、(43, 2026-01-01) から始まるグラニュールを顧客の条件で除外する。マークで必要な列データの位置を探し、候補グラニュールの行に述語を評価する。境界付近には条件外の行も入り得る。

## 4. 同じ月のパートをマージする

バックグラウンドタスクは、同じパーティション内から条件に合うパートを選ぶ。図では 1 月の A と B をキー順にマージし、出力 M に新しいグラニュール境界と索引を作る。新しいパートが有効になり、入力パートは非アクティブになる。2 月の C は別のマージの対象となる。通常の `MergeTree` はマージで重複キーの行も保持し、対象クエリに対して同じ行の集合を返す。返却順が必要な場合は、SELECT 側の `ORDER BY` で指定する。

## 5. 計画と保存状態で確認する

SELECT の先頭に `EXPLAIN indexes = 1` を付け、`ReadFromMergeTree` の索引別の `Parts` と `Granules` を読む。ClickHouse 25.9 以降の診断では公式資料に従い、SELECT 末尾の `SETTINGS use_query_condition_cache = 0, use_skip_indexes_on_data_read = 0` も確認する。パートの状態を追うときは `system.parts` の `partition`、`name`、`active`、`rows`、`marks` を見る。索引適用後の候補数、実際に読み取ったデータ量、返却行数はそれぞれ異なる指標。

## 6. 公式資料

- [ClickHouse MergeTree table engine](https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/mergetree)
- [ClickHouse EXPLAIN](https://clickhouse.com/docs/reference/statements/explain)
- [ClickHouse system.parts](https://clickhouse.com/docs/operations/system-tables/parts)
