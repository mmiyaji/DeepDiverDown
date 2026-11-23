# ワイドテーブルの粒度と BigQuery のネスト

## 1. モデルの範囲

注文 O-101 のヘッダーは総額 1,200 円を持ち、注文明細は 700 円と 500 円の2件とする。ワイドテーブルの例は同じ分析用データを平坦化した表と、BigQuery のネスト・反復フィールドを使った表の2種類で表す。

出典 [BigQuery: Use nested and repeated fields](https://docs.cloud.google.com/bigquery/docs/best-practices-performance-nested)

## 2. 1行の意味と複製される項目

平坦なワイドテーブルは `(注文ID, 明細ID)` を粒度とし、顧客地域や注文総額を各明細行に持つ。ネスト表では注文 ID を粒度とし、`ARRAY<STRUCT>` に注文明細を格納する。注文と明細を一緒に読んだり、明細数を数えたりする場合は、ネスト表で結合や再集計の一部を減らせる。用途やデータの大きさによって適した構造は変わる。

出典 [BigQuery: Use nested and repeated fields](https://docs.cloud.google.com/bigquery/docs/best-practices-performance-nested)、[BigQuery: Work with arrays](https://docs.cloud.google.com/bigquery/docs/arrays)

## 3. ファンアウトと二重計上

2明細ある注文の総額列を明細行で合計すると 2,400 円になる。注文単位の総額は1注文1行にそろえてから集計する。同額の別注文があり得るため、金額に対する `SUM(DISTINCT ...)` では注文単位の重複を取り除けない。ネスト表でも `UNNEST` で明細を2行に展開した後は、親の総額が各行に現れる。注文総額は展開前、明細金額は明細粒度で集計する。

出典 [BigQuery: Use nested and repeated fields](https://docs.cloud.google.com/bigquery/docs/best-practices-performance-nested)、[BigQuery: Work with arrays](https://docs.cloud.google.com/bigquery/docs/arrays)

## 4. 後着変更と更新の単位

明細2の後着訂正で明細金額が 450 円、総額が 1,150 円になる例を扱う。平坦な表では明細キーで明細を特定し、複製した総額はその注文に属する全行を更新する。ネスト表では注文 ID で当該行を特定し、最新の明細に基づき配列を再生成する。更新に `MERGE` を使う場合、対象行を更新するソースは粒度にあうように重複を除き、変更時刻やソース順序を使って新旧を判定する。

出典 [BigQuery: Data manipulation language](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/dml-syntax)
