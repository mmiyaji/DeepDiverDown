# DuckDB：ストレージ形式とメモリ管理

## 1. 題材と範囲

DuckDB のデータベースファイルの構成、書き込みの流れ（WAL と checkpoint）、メモリの管理とディスクへの書き出しを追う。前の図「ベクトル化実行と並列処理」の実行エンジンが、データの読み書きとメモリをどう使うかにあたる。数値は DuckDB 2.0 系の資料の記載で、設定で変えられる。

## 2. 単一ファイルと行グループ

永続データベースは 1 つのファイルに保存する。ファイルの先頭にはヘッダーがあり、チェックサム、マジックバイト `DUCK`、バージョンを持つ。データは行グループ（水平分割の単位）に分かれ、既定では 122,880 行。圧縮と並列処理は行グループを基準にする。ファイルは固定サイズのブロックで扱い、既定は 262,144 バイト（256 KiB）。ブロックサイズは新しいファイルの作成時に指定し、既存のファイルでは変更できない。

各行グループは、列ごとの列セグメントを持つ。Parquet と違い、列は固定サイズのブロックに分けられるため、データをその場で更新し、ブロックを断片化せずに再利用できる。

## 3. 圧縮

永続データベースは、軽量な圧縮を既定で使う。インメモリのデータベースでは既定で使わず、`ATTACH` の `COMPRESS` で有効にできる。圧縮は列セグメントごとに、まず最適な方式を調べ（分析）、次に圧縮してブロックへ書く。

使える方式は、Constant、RLE、ビットパッキング、Frame of Reference、辞書、FSST、ALP、Chimp、Patas、Zstd。使える方式は、ファイルのストレージバージョンによって変わる。v2.0.0 では `DICT_FSST` が既定で有効になる。汎用の圧縮は大きなブロックが必要なため、DuckDB は軽量な方式を選んでいる。

## 4. WAL と checkpoint

書き込みは WAL（先行書き込みログ）に記録される。checkpoint は WAL の内容をデータベースファイルへ同期し、削除された行の領域も回収する。WAL がしきい値（`checkpoint_threshold`、既定 16 MiB）に達すると自動で checkpoint が実行され、`CHECKPOINT` 文で手動でも実行できる。`CHECKPOINT` は実行中のトランザクションがあると失敗する。`FORCE CHECKPOINT` は新しいトランザクションの開始を止め、チェックポイントのロックを取れるまで待つ（v1.4 以降）。

## 5. バッファマネージャー

バッファマネージャーは、永続ストレージのページをキャッシュする。クエリの中間結果と同じメモリ上限を共有し、他のデータ構造が領域を必要とするとページを追い出す。追い出したページは一時ファイルに書かなくてよく、必要になれば元のファイルから読み直す。キャッシュはクエリをまたいで残る。ストレージが遅い（ネットワークドライブ、HTTP・S3）ほど、キャッシュの効果は大きい。

`memory_limit` の既定は RAM の 80%。

## 6. メモリに収まらない処理

メモリ上限を超える中間結果は、一時ディレクトリ（既定は `<データベースファイル名>.tmp`、インメモリでは `.tmp`）へ書き出される。書き出しは、中間結果が上限を超えたときだけ行い、可能な限りメモリに置く。`max_temp_directory_size` の既定は空きディスクの 90%。書き出しできないか上限を超えると、クエリはメモリ不足で失敗する。書き出しは I/O が増えるため遅くなる。

| 処理 | メモリに収まらないとき |
| --- | --- |
| グループ数が少ない集計、ファイル間の変換、小さい N の Top-N | ストリーミングで処理でき、書き出しは不要 |
| グループ数の多い集計、大きい結合、大きな並べ替え、大きな表のウィンドウ | 一時ファイルへ書き出す |

`GROUP BY`、`JOIN`、`ORDER BY`、ウィンドウは、メモリに収まらない処理に対応する。ただしブロッキング演算子が複数あるクエリはメモリ不足になることがあり、`string_agg()` は書き出しできない。

## 7. 公式資料

- [DuckDB Storage Format](https://duckdb.org/docs/2.0/internals/storage.html)
- [DuckDB ATTACH](https://duckdb.org/docs/2.0/sql/statements/attach.html)
- [DuckDB CHECKPOINT](https://duckdb.org/docs/2.0/sql/statements/checkpoint.html)
- [Configuration](https://duckdb.org/docs/2.0/configuration/overview.html)
- [Lightweight Compression in DuckDB](https://duckdb.org/2022/10/28/lightweight-compression.html)
- [Memory Management in DuckDB](https://duckdb.org/2024/07/09/memory-management.html)
- [How to Tune Workloads](https://duckdb.org/docs/2.0/guides/performance/how_to_tune_workloads.html)

## 8. 実装例：Python に組み込む DuckDB（ローカルディスク）

利用者が管理するホストで、Python プロセスに組み込んだ DuckDB が、ローカルのデータベースファイル・WAL・一時ディレクトリを使う例。資料を組み合わせた説明用の例で、実環境で検証した構成ではない。

| 機能 | 実装での担い手 |
| --- | --- |
| 実行エンジン、バッファマネージャー、中間結果、checkpoint | 同じプロセスの DuckDB エンジン |
| データベースファイル、行グループ、列セグメント | ローカルの analytics.duckdb |
| WAL | ローカルの WAL |
| 一時ディレクトリ | analytics.duckdb.tmp |

- [DuckDB Python API](https://duckdb.org/docs/2.0/clients/python/overview.html)
