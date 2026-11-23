# TiDB / TiKV：KV・Region・Raft・MVCC

## 1. 対象

TiDB は行データと索引データを異なる KV キーとして符号化する。行キーは表 ID と行ハンドル、索引キーは索引 ID と値を含む。非一意索引では重複を区別するためハンドルを含む。クラスタ化主キーやバージョンによる違いを確認する。

## 2. データの流れ

Region は開始を含み終了を含まない連続キー範囲。Region ごとに Raft グループで leader と follower を持ち、コミット時の多数決は構成に依存する。PD は配置や時刻取得に関係し、SQL のデータ処理をすべて中継するものではない。

TiKV は MVCC で複数版とトランザクションのロックを扱う。RocksDB の write / default / lock column family、memtable、SST、compaction が保存に関わる。短い値の格納などは実装・設定で異なる。Raft ログのエンジンはバージョンと設定により異なり、必ず RocksDB と仮定しない。TiFlash は明示的に設定した表を learner として複製する。

## 3. 運用上の注意

TiUP playground の TiDB、PD、TiKV と明示的に有効にした TiFlash を使う概念例。単一 TiKV の既定構成は本番の複数ノード複製ではない。 構成と対応バージョンにより動作が異なるため、採用環境で検証する。

## 4. 実装例

TiUP playground の単一ホスト上で複数 TiKV プロセスを起動し、leader と follower を観察する。例えば `tiup playground --db 3 --pd 3 --kv 3` は各コンポーネントを複数起動する。既定の単一 TiKV ではこの構成にならない。同一ホストのためノード障害に対する分離はない。実運用ではノード数、ディスク、複製数、監視、バックアップとネットワークを別途設計する。

| 役割 | 担い手 |
|---|---|
| クライアント | 利用者の SQL クライアント |
| 処理・保存 | TiUP Playground の TiKV 保存経路 |
| 保持・バックアップ | 利用者が管理するディスクと設定 |

これは公開資料に基づく代表構成であり、本リポジトリでの実環境の動作検証は行っていない。

## 5. 参考資料

- [TiDB architecture](https://docs.pingcap.com/tidb/stable/tidb-architecture/)
- [TiDB computing](https://docs.pingcap.com/tidb/stable/tidb-computing/)
- [TiDB storage](https://docs.pingcap.com/tidb/stable/tidb-storage/)
- [TiKV RocksDB overview](https://docs.pingcap.com/tidb/stable/rocksdb-overview/)
- [TiFlash replicas](https://docs.pingcap.com/tidb/stable/create-tiflash-replicas/)
- [TiUP playground](https://docs.pingcap.com/tidb/stable/tiup-playground/)
