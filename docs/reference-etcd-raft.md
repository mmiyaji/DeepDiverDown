# etcd と Raft のクォーラム

## 1. モデルの範囲

注文 API の受付上限を etcd の設定キーに保存する架空の例を扱う。etcd の投票メンバーは A・B・C の3台とし、メンバー追加やスナップショットの詳細は省略する。

出典 [etcd Failure modes](https://etcd.io/docs/v3.6/op-guide/failures/)、[etcd FAQ](https://etcd.io/docs/v3.6/faq/)

## 2. クライアントとコミット

クライアントはキーに対する Put を送る。処理は合意を経てコミットされ、ストレージに適用される。図の「コミット済みの設定」はメンバーの状態機械で反映されるキーをまとめた表示である。タイムアウトや応答経路の途絶だけでは、コミット済みかどうかを判断できない。

出典 [etcd API guarantees](https://etcd.io/docs/v3.6/learning/api_guarantees/)

## 3. 通常時のログ複製

初めのリーダーは A。A は新しいログエントリをフォロワー B・C に複製する。今の任期のエントリは、自身を含む過半数に複製してコミットできる。3台の場合、必要なメンバー数は 2 台である。

出典 [In Search of an Understandable Consensus Algorithm (Raft)](https://raft.github.io/raft.pdf)、[etcd FAQ](https://etcd.io/docs/v3.6/faq/)

## 4. ネットワーク分断と過半数

A と B・C の間が切れると A は書き込みをコミットできず、リーダーから降りる。B・C の側は選挙で新しいリーダーを選べる。この例では B が当選し、選挙後は B・C の 2 台で書き込みをコミットできる。二つの側が同時に過半数を得ることはない。

出典 [etcd Failure modes](https://etcd.io/docs/v3.6/op-guide/failures/)、[In Search of an Understandable Consensus Algorithm (Raft)](https://raft.github.io/raft.pdf)

## 5. 分断が解消した後

通信が戻ると A は多数派のリーダーを認識し、状態を回復する。分断前後に応答を受け取れなかったクライアントは、応答待ちの終了だけで更新が未実行だったと判断できない。

出典 [etcd Failure modes](https://etcd.io/docs/v3.6/op-guide/failures/)、[etcd API guarantees](https://etcd.io/docs/v3.6/learning/api_guarantees/)

## 6. 実装例：3 台の VM で運用する etcd
受付上限のキーを 3 台の etcd メンバーに保持し、書き込み後の状態を etcdctl で確認する例。

| 機能配置 | この例での担い手 |
|---|---|
| 運用者 | 設定変更を行う運用者 |
| 状態更新のクライアント | etcdctl put |
| メンバー A | etcd member A の VM |
| メンバー B | etcd member B の VM |
| メンバー C | etcd member C の VM |
| 確定した設定値 | etcd MVCC の受付上限キー |

- **etcdctl endpoint status**。リーダーの識別と各エンドポイントの状態確認に使う。

クライアント通信とメンバー間通信にはそれぞれ TLS を構成する。B が選ばれるのはシナリオの一例。メンバーを単一の障害ドメインに集めると VM 台数だけでは耐障害性を確保できない。

公式資料
- [etcd Clustering Guide](https://etcd.io/docs/v3.6/op-guide/clustering/)
- [etcd Cluster Status](https://etcd.io/docs/v3.6/tasks/operator/how-to-check-cluster-status/)
- [etcd API guarantees](https://etcd.io/docs/v3.6/learning/api_guarantees/)
