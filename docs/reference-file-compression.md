# ファイル圧縮形式と分析データの読み書き

## 1. 対象
データを可逆圧縮して保存し、必要なときに伸長する仕組みを、分析用の列指向ファイルと通常の圧縮ファイルの両方で整理する。圧縮は暗号化ではない。ファイル形式、アーカイブ、コーデックは異なる層である。

## 2. 処理の流れ
書き込み時は入力値を必要に応じてエンコードし、圧縮器がデータを圧縮して保存する。読み取り側は形式やメタデータから必要な範囲とコーデックを特定し、圧縮データを伸長した後にデコードする。Parquet ではファイル全体を gzip で包むのではなく、列チャンク内のデータページや辞書ページのデータブロックを圧縮できる。フッターの情報や統計等を使う選択的な読み取りと、実装・データに応じたページの読み飛ばしは別の機能である。

## 3. 主要方式と選び方
| 方式 | 性質と確認する点 |
|---|---|
| gzip / DEFLATE | 広く使われる圧縮データ形式。gzip と生の DEFLATE や zlib は互換な同一形式ではない。 |
| Zstandard（Zstd） | 圧縮レベルによって速度・サイズ・メモリのトレードオフを調整できる。辞書方式もあるが、利用には復号側の対応と辞書管理が必要。 |
| Snappy | 最大圧縮率より速度を重視する設計。データと実装により結果は変わる。 |
| LZ4 | 高速な圧縮を目的とする方式。Parquet の旧 `LZ4` は非推奨で、仕様は相互運用性の高い `LZ4_RAW` を推奨する。 |
| Brotli | Parquet が対応するコーデックの一つ。利用する実装の対応や圧縮レベルを確認する。 |
| 無圧縮 | 圧縮 CPU コストを避けられる一方、読み書き量や保存容量が増え得る。 |

実際の圧縮率、CPU、メモリ、読み取り速度、クラウド転送量はデータ、圧縮レベル、ページサイズ、選択列、実装で変わる。対象エンジンの読み書き対応を確認し、実データで比較する。ファイルを一つの gzip ストリームとして圧縮すると、一般的な読み取りでは途中からの独立した分割処理が難しい。複数ファイルをまとめる tar と ZIP はアーカイブ形式で、gzip は主にストリームの圧縮形式。`.tar.gz` は tar による集約と gzip による圧縮を組み合わせる。ZIP はアーカイブ内のエントリを扱う形式であり gzip と同一ではない。

## 4. 実装例：PyArrow Parquet と gzip
例 1 は PyArrow の Parquet writer で `compression='zstd'` を指定し、エンコードされたデータページ・辞書ページを圧縮して Parquet に保存する。reader は必要なメタデータとページを参照し、対応するコーデックで伸長・デコードする。PyArrow の API は列別のコーデック指定もサポートする。例 2 は単一 CSV を gzip で圧縮・伸長するストリーム構成。CSV のデータ変換と gzip 圧縮は別段階である。

| 機能 | Parquet の例 | gzip の例 |
|---|---|---|
| 入力と符号化 | Arrow テーブルと Parquet 列エンコード | 表データから CSV 文字列へ変換 |
| 圧縮 | Parquet ページの Zstd | gzip / DEFLATE ストリーム |
| 格納 | メタデータ付き Parquet ファイル | `.csv.gz` ファイル |
| 復元 | Parquet reader が伸長しデコード | gzip 伸長後に CSV を解析 |

[Parquet compression](https://parquet.apache.org/docs/file-format/data-pages/compression/)、[Parquet column chunks](https://parquet.apache.org/docs/file-format/data-pages/columnchunks/)、[PyArrow write_table](https://arrow.apache.org/docs/python/generated/pyarrow.parquet.write_table.html)、[Snappy](https://github.com/google/snappy/blob/main/README.md)、[Zstd manual](https://github.com/facebook/zstd/blob/dev/doc/zstd_manual.html)、[RFC 1952](https://www.rfc-editor.org/rfc/rfc1952)、[GNU gzip](https://www.gnu.org/s/gzip/manual/html_node/Advanced-usage.html)。
