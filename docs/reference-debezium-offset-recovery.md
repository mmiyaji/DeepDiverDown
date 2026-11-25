# Debezium：オフセットと再起動時の再送

## 1. 対象

分散 Kafka Connect 上の Debezium コネクターが、初期スナップショット完了後にワーカー障害から再開する場面を扱う。Worker は `exactly.once.source.support=disabled` とする。初期取り込みは [初期スナップショットと変更ストリーム](reference-debezium-snapshot-streaming.md) を参照。

## 2. イベントとオフセットの保存

PostgreSQL コネクターは WAL の変更を読み、CDC トピックに発行する。Kafka Connect は読み取り位置を別のソースオフセットトピックに記録する。PostgreSQL の論理スロットは変更の配送位置と保持に関わる。下流コンシューマーの購読位置は、CDC トピックをどこまで読んだかを表す。

## 3. 異常終了からの再開

変更イベントを発行した直後にワーカーが異常終了し、直近のオフセットが未保存だったとする。分散 Kafka Connect は別のワーカーでタスクを再起動する。コネクターは保存済みの位置から読み直すため、発行済みの一部の変更が再送される場合がある。対象スロットと再開に必要なログが利用できることが条件である。

## 4. 実装例：自前 PostgreSQL・分散 Kafka Connect・Kafka

自前 Linux 環境の分散 Kafka Connect に Debezium PostgreSQL Connector を登録する。どの Worker でも Source Task を再起動できるように、同じプラグインを配置する。PostgreSQL に対象表の publication と `pgoutput` 用の論理スロットを作り、専用 DB ユーザーに論理レプリケーションと対象表の読み取りに必要な権限を付ける。Connect には業務トピックへの発行、内部トピックと Worker グループへのアクセス権限を付ける。

PostgreSQL サーバーは論理スロットと WAL を使い、タスクに `pgoutput` の変更を返す。CDC トピックは変更イベントを保持し、`offset.storage.topic` は Source Task が再開に使うオフセットを保持する。下流の Kafka Consumer には CDC トピックと購読グループに必要な権限を付ける。利用者は重複処理を見込んで、書き込みを冪等にするなどの対策を設計する。Consumer の稼働場所は指定しない。

| 機能 | 担い手 |
| --- | --- |
| 変更ログ | PostgreSQL の論理スロットと WAL |
| コネクター実行基盤 | 自前 Linux の分散 Kafka Connect Worker 群 |
| 変更捕捉タスク | Debezium PostgreSQL Source Task |
| 発行済みイベント | Kafka の CDC トピック |
| 記録済みソースオフセット | Kafka Connect のソースオフセットトピック |
| 下流の購読処理 | 外部の Kafka Consumer |

## 5. 未確認

再開時間、再送される件数、必要な WAL 保持容量、構成全体の実機動作は未確認である。PostgreSQL のフェイルオーバーを伴う場合は、昇格先の論理スロットと再開位置の保持を別途確認する。

## 公式資料

- [Debezium 3.7 PostgreSQL Connector](https://debezium.io/documentation/reference/3.7/connectors/postgresql.html)
- [Kafka Connect User Guide](https://kafka.apache.org/44/kafka-connect/user-guide/)
- [PostgreSQL 18 の論理デコーディング](https://www.postgresql.org/docs/18/logicaldecoding-explanation.html)
- [PostgreSQL の論理レプリケーションのアーキテクチャ](https://www.postgresql.org/docs/18/logical-replication-architecture.html)
