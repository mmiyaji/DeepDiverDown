# DuckDB：ベクトル化実行と並列処理

## 1. 題材と範囲

物理計画ができた後、DuckDB がデータをどう流し、どう並列化するかを追う。前の図「DuckDB の基本アーキテクチャ」の実行エンジンの内部にあたる。題材は `SELECT customer_id, sum(amount) FROM orders GROUP BY customer_id` のような集計。パイプラインの分割やスレッドへの仕事の割り当ての内部実装は、公式資料で確認できた範囲だけを書く。

## 2. DataChunk とベクトル

実行中のデータは、`Vector`（1 列分の値）をまとめた `DataChunk` として、物理演算子の間を渡される。1 回に処理するタプル数の標準（`STANDARD_VECTOR_SIZE`）は 2,048。演算子は行ごとではなく、このまとまりごとに処理するため、行ごとの呼び出しのコストを減らせる。

## 3. ベクトルの形式

同じ論理データを、次のような物理形式で持てる。形式を使い分けると、メモリ使用量を減らし、圧縮したまま処理できる。

| 形式 | 中身 |
| --- | --- |
| Flat | 連続した非圧縮の配列 |
| Constant | 全行が同じ値のとき、1 つの値だけを持つ |
| Dictionary | 重複のない値のベクトルと、そこへの添字（選択ベクトル） |
| Sequence | 開始値と増分だけを持つ。行 ID など |

ストレージは、定数圧縮のデータを Constant、辞書圧縮のデータを Dictionary として出力できる。文字列は `string_t` で、12 バイト以下は埋め込み、それより長い値は別のバッファへの参照を持つ。

## 4. プッシュ型の実行

物理演算子の木は、プッシュ型のベクトル化モデルで実行される。`DataChunk` は読み取り側から結果の出力側へ向かって、演算子の木を流れる。

## 5. ブロッキング演算子

`GROUP BY`、`JOIN`、`ORDER BY`、ウィンドウ関数（`OVER … PARTITION BY … ORDER BY`）は、出力する前に入力全体を保持する必要がある。そのためメモリを多く使う。フィルタや射影のように入力を順に処理できる演算子とは、実行時の性質が異なる。メモリに収まらない場合の扱いは、次の図「DuckDB：ストレージ形式とメモリ管理」で扱う。

## 6. 並列化

DuckDB はクエリを自動的にマルチスレッドで並列化する。`threads` の既定値は CPU コア数。並列化は行グループの単位から始まるため、k スレッドを使うには、少なくとも k × 122,880 行（既定の行グループ k 個分）が必要になる。

集計の並列化では、各スレッドが自分のハッシュテーブルを作り、グループのハッシュのラディックス分割でパーティションに分ける。その後、パーティションをワーカーに割り当てて並列に統合する。スレッド間でハッシュテーブルを共有するとロックが必要になるため、この方式で避ける。スレッドごとのテーブルが 10,000 エントリを超えるまでは分割しない。`median` のように部分結果を統合できない集約は、この方式を使えない。

## 7. 結果の順序

`preserve_insertion_order` は既定で `true`。CSV・JSON・Parquet の読み取りは、ファイルの順序を保つ。`false` にすると、`ORDER BY` のない結果の順序が変わることがあり、大きなデータでメモリ使用量を減らせる。`GROUP BY` や `JOIN` の出力順は保証されない。

## 8. 公式資料

- [DuckDB Internals Overview](https://duckdb.org/docs/2.0/internals/overview.html)
- [DuckDB Vector](https://duckdb.org/docs/2.0/internals/vector.html)
- [How to Tune Workloads](https://duckdb.org/docs/2.0/guides/performance/how_to_tune_workloads.html)
- [Parallel Grouped Aggregation in DuckDB](https://duckdb.org/2022/03/07/aggregate-hashtable.html)
- [Order Preservation](https://duckdb.org/docs/2.0/sql/dialect/order_preservation.html)
- [Configuration](https://duckdb.org/docs/2.0/configuration/overview.html)
- [Design and Implementation of DuckDB Internals](https://duckdb.org/library/design-and-implementation-of-duckdb-internals/)

## 9. 実装例：Python に組み込む DuckDB（ローカル）

利用者が管理するホストで、Python プロセスに組み込んだ DuckDB が、ローカルのデータベースファイルに対して集計を実行する例。資料を組み合わせた説明用の例で、実環境で検証した構成ではない。

| 機能 | 実装での担い手 |
| --- | --- |
| 結果を受け取る側 | Python プログラムと duckdb パッケージ |
| 物理演算子の木、スキャン、ベクトル、DataChunk、フィルタ、スレッドごとの集計、統合 | 同じプロセスの DuckDB 実行エンジン |
| 行グループ（入力） | ローカルのデータベースファイル |

- [DuckDB Python API](https://duckdb.org/docs/2.0/clients/python/overview.html)
- [How to Tune Workloads](https://duckdb.org/docs/2.0/guides/performance/how_to_tune_workloads.html)
