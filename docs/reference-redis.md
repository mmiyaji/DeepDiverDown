# Redis のデータ処理と保存

## 1. 対象

Redis はキーと値をメモリ上で扱い、String、Hash、List、Set、Sorted Set などのデータ型に対するコマンドを提供する。データ型と内部エンコーディングは別で、使用する表現はサイズ、値、設定やバージョンにより変わる。

## 2. 内部構造と処理

メモリ使用量はキーと値だけでなくデータ構造、バッファ、アロケータやフラグメンテーションにも影響される。TTL による失効と maxmemory に達した場合の eviction は異なる。noeviction では対象の書き込みにエラーを返す。

## 3. 運用と制約

永続化は任意で RDB スナップショット、AOF、両方または無効を選べる。複製は既定で非同期であり、障害時のデータ損失の可能性がある。Redis Cluster のシャーディングと Sentinel のフェイルオーバーは別の仕組みである。

## 4. 実装例

Linux ホスト上の Redis primary と別プロセスの replica を設定し、primary の RDB / AOF をローカルディスクに保存する学習用構成。単一ホストではホスト障害を分離できない。 利用者が Redis のプロセス、設定、認証、ネットワーク、ディスクおよびバックアップを管理する。図は公式資料に基づく代表例であり、実環境の動作検証は行っていない。

| 役割 | 担い手 |
|---|---|
| クライアント | Redis プロトコルのクライアント |
| 処理と保存 | Linux 上の Redis とレプリカ |
| 設定・運用 | 利用者が管理する Linux と Redis |

## 5. 参考資料

- [メモリ最適化](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/memory-optimization/)
- [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
- [Redis replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/)
- [Redis Cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
- [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/)
