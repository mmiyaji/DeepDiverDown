# Redis：データ型とメモリ内の構造

## 1. 対象

Redis はキーから型付きの値へアクセスする。OBJECT ENCODING はキーに使われている内部エンコーディングを確認するコマンドで、外部のデータ型と同一ではない。内部表現は Redis の版とデータ形状・設定に依存する。

## 2. 内部構造と処理

小さい Hash や Sorted Set などには listpack、整数だけの小さい Set には intset などのコンパクトな表現を用いる場合がある。サイズ・要素数の閾値を超えると別の表現へ変換されうる。List、Set、Sorted Set の構造は版により変化するため、特定のデータ型が常に一つのエンコーディングだとは扱わない。

Redis 7.2 の Hash の実装例では、listpack 内に field と value を交互に格納する。要素数や値の長さ等の条件を超えると、field をキーとするハッシュテーブルへ変換する。メモリ効率のよい連続表現と、個別要素を探す構造のトレードオフがある。これは Redis 7.2 のソースに基づく例であり、他の版や他のデータ型にそのまま一般化しない。`OBJECT ENCODING key` と `MEMORY USAGE key` で実際のキーを確認できる。

## 3. 運用と制約

期限切れは TTL に基づく削除、eviction は maxmemory とポリシーに基づく選別であり別機構。RSS と Redis が計上する使用量は一致せず、アロケータやフラグメンテーション、複製・AOF 用バッファ、fork 中の copy-on-write に余裕が必要。

## 4. 実装例

Linux 上に Redis を構成し、キーの読み書きと OBJECT ENCODING、INFO memory で内部表現と使用量を確認する例。 利用者が Redis のプロセス、設定、認証、ネットワーク、ディスクおよびバックアップを管理する。図は公式資料に基づく代表例であり、実環境の動作検証は行っていない。

| 役割 | 担い手 |
|---|---|
| クライアント | Redis プロトコルのクライアント |
| 処理と保存 | Linux 上の単一 Redis プロセス |
| 設定・運用 | 利用者が管理する Linux と Redis |

## 5. 参考資料

- [メモリ最適化](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/memory-optimization/)
- [OBJECT ENCODING](https://redis.io/docs/latest/commands/object-encoding/)
- [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/)
- [INFO](https://redis.io/docs/latest/commands/info/)
- [Redis 7.2 Hash の実装](https://github.com/redis/redis/blob/7.2/src/t_hash.c)
