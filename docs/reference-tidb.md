# TiDB の分散 SQL と HTAP

## 1. 対象

TiDB は SQL を解析・実行する計算層、TiKV は分散トランザクション KV ストレージ、PD は Region の配置や timestamp oracle を担う。TiDB サーバー自体は行データを保存しない。

## 2. データの流れ

行と索引を KV キーに変換し、連続するキー範囲を Region として分ける。各 Region のレプリカは Raft グループを構成し、複数 TiKV ノードに配置できる。Region の複製数と配置は設定による。

TiFlash は任意の列指向ストレージで、対象テーブルへのレプリカ設定後に TiKV から Raft learner として複製される。配置しただけではすべての表に自動でレプリカができるわけではない。SQL プランが TiKV／TiFlash のいずれを使うかは設定・コスト・利用可否による。

## 3. 運用上の注意

Linux の TiUP playground で TiDB、PD、TiKV、TiFlash を起動し、TiFlash の対象表を明示して列指向レプリカを作る学習用構成。 構成と対応バージョンにより動作が異なるため、採用環境で検証する。

## 4. 実装例

TiUP playground は TiDB、PD、TiKV、TiFlash を同一ホストで試す開発用構成。TiFlash レプリカは対象表ごとに作成する。単一ホストの障害分離や可用性は本番構成の根拠にならず、実行・接続は本リポジトリで未検証。

| 役割 | 担い手 |
|---|---|
| クライアント | 利用者の SQL クライアント |
| 処理・保存 | TiUP Playground による単一ホスト検証 |
| 保持・バックアップ | 利用者が管理するディスクと設定 |

これは公開資料に基づく代表構成であり、本リポジトリでの実環境の動作検証は行っていない。

## 5. 参考資料

- [TiDB architecture](https://docs.pingcap.com/tidb/stable/tidb-architecture/)
- [TiDB computing](https://docs.pingcap.com/tidb/stable/tidb-computing/)
- [TiDB storage](https://docs.pingcap.com/tidb/stable/tidb-storage/)
- [TiKV RocksDB overview](https://docs.pingcap.com/tidb/stable/rocksdb-overview/)
- [TiFlash replicas](https://docs.pingcap.com/tidb/stable/create-tiflash-replicas/)
- [TiUP playground](https://docs.pingcap.com/tidb/stable/tiup-playground/)
