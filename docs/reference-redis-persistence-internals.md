# Redis：RDB・マルチパート AOF と復旧

## 1. 対象

RDB は時点のスナップショット、AOF は更新操作を記録して再起動時に再構成する。両方を有効にした場合、Redis は再起動時に AOF を利用する。永続化を無効にする選択肢もある。

## 2. 内部構造と処理

Redis 7.0 以降の AOF は base、複数の incremental、manifest に分かれる。書き直し時、親は新しい incremental を開いて更新を記録し、子が新しい base を作成する。完了後、Redis は新しい manifest に切り替える。base の形式は設定により RDB または AOF。

## 3. 運用と制約

BGSAVE と AOF rewrite の fork は遅延や copy-on-write に伴う追加メモリを生じうる。AOF の fsync ポリシーで障害時の損失幅と I/O が変わる。RDB・AOF はバックアップと同義ではなく、別保管と復元を検証する。

## 4. 実装例

単一 Linux ホストで Redis の RDB と AOF を設定し、データファイルをローカルディスクに保存する学習用例。 利用者が Redis のプロセス、設定、認証、ネットワーク、ディスクおよびバックアップを管理する。図は公式資料に基づく代表例であり、実環境の動作検証は行っていない。

| 役割 | 担い手 |
|---|---|
| クライアント | Redis プロトコルのクライアント |
| 処理と保存 | Linux 上の Redis とローカルディスク |
| 設定・運用 | 利用者が管理する Linux と Redis |

## 5. 参考資料

- [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
- [Redis replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/)
- [INFO](https://redis.io/docs/latest/commands/info/)
