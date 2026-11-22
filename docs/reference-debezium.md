# Debezium の CDC アーキテクチャ

## 1. 範囲と読み方
PostgreSQL の注文テーブルを初期スナップショットし、その後の変更をログからイベント化して Kafka に届ける例を示す。Debezium は Kafka Connect の Source Connector として動かす構成を中心に扱う。

出典 [Debezium Architecture](https://debezium.io/documentation/reference/stable/architecture.html)・[PostgreSQL connector](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)

## 2. 初期スナップショット
Connector は既存テーブルを読み、後続の変更を取りこぼさない位置まで進める。スナップショットのモードやロックは設定とDBに依存する。

出典 [Snapshot](https://debezium.io/documentation/reference/stable/connectors/postgresql.html#postgresql-property-snapshot-mode)

## 3. 変更ログの捕捉
PostgreSQL の論理レプリケーションを使い、WAL の変更を読み取る。INSERT、UPDATE、DELETE はイベントに変換される。

出典 [PostgreSQL connector](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)

## 4. Kafka への発行
Debezium の Source Task は変更イベントを Kafka topic へ発行する。topic 命名、キー、スキーマ形式は設定・コンバーターに依存する。

出典 [Debezium Architecture](https://debezium.io/documentation/reference/stable/architecture.html)

## 5. 再開位置と障害
コネクターはデータベースのログ位置をオフセットとして保持し、再起動時にその位置から読める。ログ保持期間や重複処理は運用設計で決める。

出典 [Debezium Architecture](https://debezium.io/documentation/reference/stable/architecture.html)・[Kafka Connect User Guide](https://kafka.apache.org/44/kafka-connect/user-guide/)

## 6. シナリオ
図は Database、Logical replication、Debezium Connector、Connect Worker、Kafka Topic、Offset、Consumer の7ノードで、初回同期と継続配信、再開位置を同時に示す。イベント遅延や保存先は未確定である。

## 7. 参考資料
- [Debezium Architecture](https://debezium.io/documentation/reference/stable/architecture.html)
- [PostgreSQL connector](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)
