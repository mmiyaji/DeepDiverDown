# ORC ファイルの内部：Postscript から Stream まで

## 1. 目的と前提

[物理ファイルフォーマット](reference-file-formats.md) の ORC を 1 ファイルの単位までドリルダウンし、読み手がどのバイト範囲をどの順に取るかを追う。[Parquet ファイルの内部](reference-parquet-internals.md) と並べて読むと、両者の違いが分かりやすい。サイズや個数は説明用の例。出典 [ORC Specification v1](https://orc.apache.org/specification/ORCv1/)

## 2. ファイルのバイト配置

```text
┌ 先頭 "ORC"（3 バイトのマジック）
├ Stripe 0
│   ├ Index Data   … 列ごとの Row Index（10,000 行ごとの統計と位置）、任意のブルームフィルター
│   ├ Row Data     … 列ごとの Stream（PRESENT／DATA／LENGTH／DICTIONARY_DATA など）
│   └ Stripe Footer … Stream の一覧・位置・列のエンコーディング
├ Stripe 1 …
├ Metadata      … Stripe ごとの列統計
├ File Footer   … スキーマ、Stripe の一覧と位置、ファイル全体の列統計、行数（Protocol Buffers）
├ Postscript    … 圧縮方式、フッター長、版、"ORC"（圧縮しない）
└ 最後の 1 バイト … Postscript の長さ
```

Parquet と同じく説明は末尾にあり、読み手は末尾から読む。違いは、**Postscript が圧縮されずに置かれ**、その中にフッターの圧縮方式と長さが書かれている点と、各 Stripe が**自分の索引（Index Data）とフッター（Stripe Footer）を持つ**点である。

## 3. 読み取りの順序

1. **末尾を読む**：最後の 1 バイトで Postscript の長さを知り、Postscript から圧縮方式とフッター長を得る。実装は末尾をまとめて取り、1 往復で済ませることが多い。
2. **File Footer**：スキーマ、Stripe の位置、ファイル全体と Stripe ごとの列統計を得る。
3. **Stripe を選ぶ**：Stripe ごとの統計（Stripe 統計はファイル末尾のメタデータ部に置かれる）と述語を照らし、範囲外の Stripe を捨てる。
4. **Stripe Footer と Index Data**：残った Stripe の Stripe Footer で Stream の位置を知り、Row Index で 10,000 行ごとの行グループの min/max を見て、不要な行グループを読み飛ばす。ブルームフィルターがあれば等値検索にも使う。
5. **必要な列の Stream だけを取る**：列ごとに PRESENT（null のビット列）、DATA、LENGTH、DICTIONARY_DATA などの Stream に分かれているので、必要な列・必要な行グループの位置だけを範囲 GET する。

## 4. Stream とエンコーディング

ORC は 1 つの列を、役割ごとの複数の **Stream** に分けて保存する。

- **PRESENT**：null かどうかのビット列（null が無い列では省略）
- **DATA**：値本体。整数は RLE v2（差分・固定長パッキング・繰り返しを自動選択）
- **LENGTH**：文字列やバイナリの長さ
- **DICTIONARY_DATA**：辞書エンコーディングの辞書本体（DATA には辞書番号が入る）

文字列列は、値の種類が少なければ辞書、多ければ直接（DIRECT）エンコーディングを列ごとに自動選択する。圧縮（zlib・snappy・zstd・lz4）は Stream を一定サイズの**圧縮チャンク**に分けて行うので、Row Index の位置から途中のチャンクだけを解凍できる。出典 [ORC Specification - Encodings](https://orc.apache.org/specification/ORCv1/)

## 5. Parquet との比較

| 観点 | Parquet | ORC |
|---|---|---|
| 行の塊 | Row Group | Stripe（既定 64 MB） |
| 細かい読み飛ばし | ページ索引（任意） | Row Index（10,000 行ごと、標準） |
| 列の内部 | 列チャンク → ページ | Stream（PRESENT／DATA／LENGTH…） |
| メタデータ | Thrift のフッター | Protocol Buffers のフッター＋圧縮しない Postscript |

## 6. シナリオの見方

- `open-orc`：最後の 1 バイト → Postscript → File Footer の順に開く。
- `orc-predicate`：Stripe 統計で Stripe を捨て、Row Index で行グループを読み飛ばし、必要な列の Stream だけを取る。
