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

## 7. 実装例：RocksDB の leveled compaction

ローカルの永続ディレクトリーに RocksDB を組み込み、列ファミリーの leveled compaction を使う例。キーの世代は LSM 木に保存され、名前や状態は RocksDB の設定とファイル配置に現れる。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| キー値を書き読むアプリ | RocksDB を組み込むアプリプロセス | Get と Put によりキー・値を読み書きする。 |
| WAL、MemTable | RocksDB の共有 WAL と列ファミリーの MemTable | 書き込みのログをディスクへ残し、読み取り可能な作業状態を MemTable に持つ。 |
| L0 SSTables、L1、L2 | RocksDB DB パスの SST ファイル群 | L0 はキー範囲が重なり得る。上位レベルでは同じレベルのファイルを重ならないキー範囲に整理する。 |

実装で加わる部品を以下に示す。

- RocksDB MANIFEST。各レベルを構成するファイルの変更を記録し、復旧時に現在の版を組み立てる。

公式資料

- [RocksDB Wiki - Compaction](https://github.com/facebook/rocksdb/wiki/Compaction)
- [Apache Cassandra - Compaction](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/index.html)
- [RocksDB Leveled Compaction](https://github.com/meta/rocksdb/wiki/Leveled-Compaction)
- [RocksDB MANIFEST](https://github.com/meta/rocksdb/wiki/MANIFEST)

## 8. 実装例：AWS（RocksDB on EC2・Amazon EBS）

Amazon EC2 の Linux インスタンス1台で RocksDB を組み込んだアプリを動かす。同じ可用性ゾーンにある Amazon EBS ボリュームのファイルシステムをマウントし、その上のディレクトリを RocksDB の DB パスに指定する。

| 機能 | 担い手 |
|---|---|
| キー値のアクセス・フラッシュ・コンパクション | EC2 上のアプリに組み込まれた RocksDB |
| 更新直後の MemTable | EC2 上のアプリプロセスのメモリ |
| WAL、MANIFEST、レベルごとの SST ファイル | Amazon EBS 上の RocksDB データディレクトリ |
| ブロックストレージ | EC2 に接続した Amazon EBS ボリューム |

この例では WAL を有効にし、異常停止に備えて応答前に WAL を同期する書き込みには `WriteOptions::sync` を使う。レベル型コンパクションの入力選定、新しい SST の生成、MANIFEST 更新は RocksDB が行う。EBS の IOPS・スループットを選ぶ際はフラッシュとコンパクションの I/O を見込む。

- [RocksDB Leveled Compaction](https://github.com/facebook/rocksdb/wiki/Leveled-Compaction)
- [RocksDB Write Ahead Log](https://github.com/facebook/rocksdb/wiki/Write-Ahead-Log-%28WAL%29)
- [Amazon EBS ボリュームのアタッチ](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-attaching-volume.html)

自前例は Linux ホストのアプリプロセス内に RocksDB を組み込み、ローカルディスクに WAL・MANIFEST・SST を保存する。AWS 例では AWS が EC2・EBS 基盤を運用し、利用者が OS、アプリ、DB 設定、アクセス権、バックアップと復旧を管理する。単一ホストの代表例であり、冗長化や実動作は未検証。
