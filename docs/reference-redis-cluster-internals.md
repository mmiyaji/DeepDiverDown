# Redis Cluster：スロット配置と非同期複製

## 1. 対象

Redis Cluster は 16384 個の hash slot を primary に割り当てる。スロットは通常 CRC16(key) modulo 16384 で決まり、hash tag によりキーの一部を対象にできる。これはデータのコピー数ではない。

## 2. 内部構造と処理

クライアントはスロットに対応するノードへ要求し、配置変更等では MOVED や ASK を扱う。単一スロット内の multi-key 操作には制約がある。slot の移動、フェイルオーバーとクライアントの追従は別の動きとして確認する。

## 3. 運用と制約

primary と replica の複製は既定で非同期。切断後は replication ID・offset と backlog が対応する範囲なら部分再同期でき、条件が合わなければ全同期する。WAIT は応答済みレプリカ数の確認を助けるが、強整合や障害時の書き込み保全を保証しない。

## 4. 実装例

単一 Linux ホスト上に複数 Redis プロセスを起動して複数 primary と replica のスロット配置を学ぶ。単一ホストのため障害分離はない。 利用者が Redis のプロセス、設定、認証、ネットワーク、ディスクおよびバックアップを管理する。図は公式資料に基づく代表例であり、実環境の動作検証は行っていない。

| 役割 | 担い手 |
|---|---|
| クライアント | Redis プロトコルのクライアント |
| 処理と保存 | Linux 上の Redis Cluster 検証環境 |
| 設定・運用 | 利用者が管理する Linux と Redis |

## 5. 参考資料

- [Redis Cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
- [Redis replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/)
- [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
