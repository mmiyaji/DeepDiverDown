# PostgreSQL の論理デコーディング：WAL・スロット・再開

## 1. 題材と範囲

PostgreSQL 18 の `orders` を Debezium が購読し、Kafka Connect を通して変更を Kafka に送る構成を想定する。[Debezium の教材](reference-debezium.md) の継続 CDC を、WAL と再開位置に焦点を当てて詳しく見る。図の T1・T2 と LSN は説明用で、実環境は計測していない。

## 2. WAL から論理的な行変更へ

更新はデータベースの WAL に記録される。論理デコーダはストレージレベルの記録から行の変更を復元する。出力プラグイン `pgoutput` を使うと、Publication で選んだテーブルと操作の変更をコネクタが受け取る。Publication は公開範囲を定義し、スロットは購読のための状態を持つ。Debezium は変更を Kafka に発行する。初回スナップショットを行う設定では、既存行の読取りと後続 WAL の開始位置を対応付ける。

`UPDATE` や `DELETE` で旧行を識別できる情報は、レプリカアイデンティティの設定による。更新前の行全体が常に届くと仮定すると、下流が必要とする旧値を欠く場合がある。

## 3. スロットが管理する二つの位置

LSN は WAL 上の位置。論理スロットは接続が切れた後も存続する。

| 項目 | 意味 |
| --- | --- |
| `restart_lsn` | スロットがまだ必要とする可能性のある最も古い WAL の位置。 |
| `confirmed_flush_lsn` | 論理スロットのクライアントが受信済みと確認した位置。 |
| Kafka Connect のソースオフセット | コネクタが処理済みとして外部に保存し、再開を要求するときに使う位置。 |

スロットの受信確認とソースオフセットの永続化は管理主体が異なる。Kafka のイベントを下流がどこまで適用したかは、下流の処理が管理する。

## 4. 障害後に変更が再配信される場合

図では T1 のオフセットが保存され、T2 は Kafka へ発行された直後にコネクタが停止する。T2 のオフセット保存とサーバーへの確認は済んでいない。有効なスロットと必要な WAL が残っていれば、コネクタは保存位置から再開し、T2 を再配信することがある。PostgreSQL のクラッシュでも、最後のチェックポイント以降のスロット位置が戻ることで直近の変更が再送され得る。

下流では再適用しても状態が変わらない更新にするか、再配信を判別して処理する。1 トランザクションから複数の行イベントが生じるため、すべてのイベントについて LSN 単独で一意性を保証する設計にはしない。

## 5. 保持の監視と再同期

```sql
SELECT slot_name, active, restart_lsn, confirmed_flush_lsn, wal_status
FROM pg_replication_slots
WHERE slot_type = 'logical';
```

停止中も更新が続くと、スロットのために保持される WAL が増える。保持制限に達して必要な WAL が失われたり、スロットが消えたりした場合は、既存のオフセットによる連続した再開ができる前提が崩れる。欠けた期間を確認し、必要に応じてスナップショットによる再同期を行う。

## 6. 公式資料

- [PostgreSQL 18 Logical Decoding Concepts](https://www.postgresql.org/docs/18/logicaldecoding-explanation.html)
- [PostgreSQL 18 pg_replication_slots](https://www.postgresql.org/docs/18/view-pg-replication-slots.html)
- [PostgreSQL 18 Logical Replication Publications](https://www.postgresql.org/docs/18/logical-replication-publication.html)
- [Debezium PostgreSQL Connector](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)

## 7. 実装例：PostgreSQL 18・Debezium・Kafka Connect

PostgreSQL 18 の論理デコードを pgoutput で公開し、Debezium を配置した分散 Kafka Connect が注文の変更を送る例。データベースの保持状態とコネクターの進捗を分ける。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 注文トランザクション、WAL、論理スロット、Publication、論理デコーダと出力プラグイン | PostgreSQL 18 Primary と pgoutput | 注文テーブル、WAL、論理スロット、Publication、組み込みプラグインは同じ PostgreSQL インスタンスが担う。 |
| 変更データ捕捉タスク | 分散 Kafka Connect の Debezium Source Task | 確認済みの進捗を保持し、変更イベントを Kafka へ発行する。 |
| 捕捉タスクの永続オフセット、下流の変更イベントログ | Kafka の CDC トピックと Connect 内部トピック | 業務イベントと、分散 Connect のソースオフセットを別のトピックに保持する。 |

実装で加わる部品を以下に示す。

- pg_replication_slots の監視。restart_lsn と confirmed_flush_lsn、wal_status を監視し、停止中の保持と消失の兆候を区別する。

公式資料

- [PostgreSQL 18 Logical Decoding Concepts](https://www.postgresql.org/docs/18/logicaldecoding-explanation.html)
- [PostgreSQL 18 pg_replication_slots](https://www.postgresql.org/docs/18/view-pg-replication-slots.html)
- [PostgreSQL 18 Logical Replication Publications](https://www.postgresql.org/docs/18/logical-replication-publication.html)
- [Debezium PostgreSQL Connector](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)
- [Kafka Connect Distributed mode](https://kafka.apache.org/44/kafka-connect/user-guide/)
