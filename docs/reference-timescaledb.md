# TimescaleDB の時系列アーキテクチャ

## 1. 対象

TimescaleDB は PostgreSQL 拡張であり、SQL と hypertable を利用する。hypertable は時間範囲ごとに chunk を作り、追加の分割も設定できる。

## 2. データの流れ

入力行は該当する時間範囲の chunk に保存される。Hypercore では rowstore と columnstore を利用し、ポリシーを設定して対象 chunk を列化する。segmentby と orderby は列化されたデータのグループと順序を決める。

continuous aggregate は時間幅別の集計を増分更新する。更新ポリシーと遅延到着を設計する。real-time aggregate は 2.13 以降の既定で無効。列化は別ストレージへの移行とは限らない。

## 3. 運用上の注意

利用者が Linux ホストで PostgreSQL と TimescaleDB 拡張を運用し、ローカルディスクに chunk と集計結果を保存する。 構成と対応バージョンにより動作が異なるため、採用環境で検証する。

## 4. 実装例

Linux 上に PostgreSQL と TimescaleDB 拡張を設定し、クライアントが SQL を発行する。利用者がホスト、DB、ディスク、保持・バックアップと認証を管理する。シングルホスト例は冗長化されていない。

| 役割 | 担い手 |
|---|---|
| クライアント | 利用者の SQL クライアント |
| 処理・保存 | Linux 上の PostgreSQL / TimescaleDB |
| 保持・バックアップ | 利用者が管理するディスクと設定 |

これは公開資料に基づく代表構成であり、本リポジトリでの実環境の動作検証は行っていない。

## 5. 参考資料

- [Hypertables](https://www.tigerdata.com/docs/learn/hypertables/understand-hypertables)
- [Hypercore](https://www.tigerdata.com/docs/learn/columnar-storage/understand-hypercore)
- [Columnstore policy](https://www.tigerdata.com/docs/reference/timescaledb/hypercore/add_columnstore_policy)
- [Continuous aggregates](https://www.tigerdata.com/docs/learn/continuous-aggregates)
- [PostgreSQL WAL](https://www.postgresql.org/docs/current/wal-intro.html)
