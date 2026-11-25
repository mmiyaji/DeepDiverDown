# Debezium：初期スナップショットと変更ストリーム

## 1. 対象

PostgreSQL コネクターが既存行をイベントとして取り込み、変更ストリームへ切り替えるまでを扱う。対象は Kafka Connect 上で動かす Debezium 3.7 の初回起動である。

## 2. 開始位置と完了記録

コネクターはスナップショット用のトランザクションを開始し、変更ログの位置を取得する。対象表のスキーマと既存行を読み、行ごとに `READ` イベントを発行する。スナップショットを終えると完了をソースオフセットに記録し、初めに取得した位置から変更ストリームを読む。

## 3. スナップショット中の変更

スナップショット用の読み取りが始まった後に注文行が更新されると、その更新は変更ログに残る。コネクターは既存行の読み取りを完了した後、開始位置からログを読み、更新イベントを発行する。スナップショットの完了記録より前にタスクが止まった場合、次の起動でスナップショットをやり直す。

## 4. 実装例：自前の PostgreSQL・Kafka Connect・Kafka

運用者が自前 Linux に PostgreSQL と Kafka を用意し、分散 Kafka Connect の Worker に Debezium プラグインを配置する。PostgreSQL で論理レプリケーションを設定し、取り込み対象表の publication と `pgoutput` 用の論理レプリケーションスロットを作る。コネクターにその名前を指定し、`publication.autocreate.mode=disabled` とする。専用 DB ユーザーには論理レプリケーションと対象表の読み取りに必要な権限を付ける。Connect には業務トピックへの発行、内部トピックと Worker グループへのアクセスに必要な権限を付ける。

同じ Source Task が初回の読み取りと継続配信を順に担当する。PostgreSQL サーバーはタスクに SQL 接続から既存行を返し、論理レプリケーション接続から `pgoutput` の変更を返す。Kafka の業務トピックには行と変更のイベントを発行し、Connect の `offset.storage.topic` にはソースオフセットを保存する。

| 機能 | 担い手 |
| --- | --- |
| 取り込み対象の表 | PostgreSQL の注文テーブル |
| 順序付きの変更ログ | PostgreSQL の WAL と論理スロット |
| コネクター実行基盤 | 自前 Linux 上の Kafka Connect Worker |
| 初回の行読み取り | Debezium Source Task のスナップショット処理 |
| 継続ログ読み取り | 同じ Source Task の変更読み取り |
| 配信イベントのログ | Kafka の CDC トピック |
| 読み取り位置の記録 | Kafka のソースオフセットトピック |

## 5. 未確認

スナップショットの所要時間、変更ログの必要容量、構成全体の実機動作は未確認である。読み取り中の同時更新や DDL の扱いは、選んだスナップショット分離モードとロック設定に依存する。

## 公式資料

- [Debezium 3.7 PostgreSQL Connector](https://debezium.io/documentation/reference/3.7/connectors/postgresql.html)
- [Debezium 3.7 Architecture](https://debezium.io/documentation/reference/3.7/architecture.html)
- [Kafka Connect User Guide](https://kafka.apache.org/44/kafka-connect/user-guide/)
- [PostgreSQL の論理レプリケーションのアーキテクチャ](https://www.postgresql.org/docs/18/logical-replication-architecture.html)
