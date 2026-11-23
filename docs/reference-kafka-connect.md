# Apache Kafka Connect の基本アーキテクチャ

## 1. Connector と Worker

Kafka Connect は Kafka と外部システムの間でデータを移動する。Connector は接続の設定と Task の作り方を定義し、Worker が Task を実行する。分散モードでは複数の Worker で Task を分担できる。図の Source Connector と Sink Connector は、それぞれの Task を含む役割として描く。Worker は実行基盤の代表点。

出典 [Kafka Connect Overview](https://kafka.apache.org/44/kafka-connect/overview/)・[User Guide](https://kafka.apache.org/44/kafka-connect/user-guide/)

## 2. 外部DBからの読み取り

例では Debezium の PostgreSQL Source Connector で受注テーブルを読む。初回に既存データのスナップショットを取得する構成を選び、その後は PostgreSQL の変更ログを使って追加や更新を読み取る。初回スナップショットや CDC の仕組みはコネクターによって異なる。

出典 [Debezium Connector for PostgreSQL](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)

## 3. Kafka Topic への発行

Source Task は取得したレコードを Kafka Topic に発行する。図では受注データを1つの Topic に集約した例。Kafka に保持されたレコードを Sink Task が自分の進捗に従って取得する。

出典 [Kafka Connect Overview](https://kafka.apache.org/44/kafka-connect/overview/)・[Debezium Connector for PostgreSQL](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)

## 4. 保存先への書き込み

Sink Task は購読した Topic を読み、保存先へ書き込む。図はオブジェクトストレージにファイルを保存する例。書き込み単位・形式・再試行時の扱いは選択した Sink Connector に依存する。

出典 [Kafka Connect Overview](https://kafka.apache.org/44/kafka-connect/overview/)・[User Guide](https://kafka.apache.org/44/kafka-connect/user-guide/)

## 5. オフセットと再開

Source 側はソースをどこまで読んだかを記録する。分散モードの Connect では Source オフセットの内部 Topic を設定できる。Sink 側も Kafka の Consumer Group オフセットで次に取得する位置を管理する。これらの進捗を図ではまとめて表示する。保存後、進捗をコミットする前に停止すると、一部が再取得される場合がある。保存先での重複防止は選んだコネクターや出力方式に依存する。

出典 [Kafka Connect User Guide](https://kafka.apache.org/44/kafka-connect/user-guide/)・[Debezium Connector for PostgreSQL](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)

## 6. 実装例：Kafka Connect Distributed と S3

PostgreSQL の変更を Debezium で取り込み、Kafka Connect の分散ワーカー上の S3 Sink でバケットへ格納する例。ワーカー設定の内部トピックと業務イベントのトピックは用途が異なる。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 外部の業務データベース | PostgreSQL の注文テーブル | 論理レプリケーションを有効にしたデータベース。 |
| タスク実行基盤 | 分散 Kafka Connect ワーカー | 同じグループに参加し、配置されたソース・シンクタスクを動かす。 |
| 取り込みアダプター | Debezium PostgreSQL コネクター | 初期同期と WAL の変更イベント化を担う。 |
| 出力アダプター | Confluent S3 Sink コネクター | Kafka のイベントを設定した形式でオブジェクトに書く。 |
| 変更イベントのログ、再開位置の保存領域 | Kafka クラスター | 業務トピック、ソースオフセットトピックおよびコンシューマーグループの位置を保存する。 |
| 保存先（オブジェクトストレージ） | Amazon S3 バケット | S3 Sink の書き出したオブジェクトを保持する。 |

実装で加わる部品を以下に示す。

- 各ワーカーの plugin.path。コネクターのプラグインと依存 JAR を各ワーカーに用意する。
- 設定・状態の内部トピック。分散ワーカーのコネクター設定とタスク状態を保存する。

公式資料

- [Kafka Connect Overview](https://kafka.apache.org/44/kafka-connect/overview/)
- [Kafka Connect User Guide](https://kafka.apache.org/44/kafka-connect/user-guide/)
- [Debezium Connector for PostgreSQL](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)
- [Confluent S3 Sink Connector](https://docs.confluent.io/kafka-connectors/s3-sink/current/overview.html)
