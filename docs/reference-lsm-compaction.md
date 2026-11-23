# LSM ツリーのフラッシュとコンパクション

## 1. 目的と前提

Cassandra、RocksDB、HBase、ScyllaDB など、書き込みの多いストレージエンジンが使う LSM ツリー（Log-Structured Merge-Tree）で、書き込まれたデータがメモリからファイルへ、ファイルから下の階層へと移されていく流れを追う。レイクハウスのコンパクション（[小ファイルの整理](reference-compaction.md)）とは対象が違うが、「小さく速く書き、後でまとめ直す」という考え方は共通する。階層の数やサイズは実装と設定で異なり、図の値は説明用。出典 [RocksDB Wiki - Compaction](https://github.com/facebook/rocksdb/wiki/Compaction)、[Apache Cassandra - Compaction](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/index.html)

## 2. 書き込み：WAL と MemTable

書き込みはまずログ（WAL・commit log）に追記して耐久性を確保し、メモリ上の並べ替え済みの表（MemTable）に入れる。ディスク上の既存ファイルは書き換えないので、書き込みは順次書き込みだけで済み速い。

## 3. フラッシュ：MemTable から SSTable へ

MemTable が一定サイズに達すると、キー順に並んだ不変のファイル（SSTable）としてディスクに書き出す（フラッシュ）。最上位の階層（L0）の SSTable は、フラッシュした時期ごとにキーの範囲が重なり合う。

## 4. コンパクション：階層を下りながらまとめ直す

重なり合う SSTable が増えると、読み取りで確認するファイルが増える。コンパクションは複数の SSTable を読み、キー順にマージし、同じキーの古い値や削除の印（tombstone）を取り除いて、新しい SSTable に書き直す。レベル型（leveled）では L1 以下の各階層の中でキー範囲が重ならないように保ち、下の階層ほど大きくする。サイズ階層型（size-tiered）では同じくらいの大きさの SSTable をまとめる。コンパクションは同じデータを何度も書き直すため、書き込み増幅とディスク I/O の費用がかかる。

## 5. 読み取り

読み取りは MemTable、L0 の SSTable（新しい順）、下の階層の順に探し、最初に見つかった最新の値を返す。各 SSTable のブルームフィルターで「確実に無い」ファイルを読み飛ばし、レベル型ではキー範囲から 1 階層あたり 1 ファイルだけを確認する。

## 6. シナリオの見方

- `flush-compact`：書き込み → フラッシュ → L0 から L1 へのコンパクション → L1 から L2 へのコンパクション。
- `lsm-read`：キーを探して MemTable と各階層を順に確認する。
