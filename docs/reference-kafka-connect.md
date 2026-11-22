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
