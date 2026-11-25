# Snowflake：Kafka から管理 Iceberg への取り込み

## 1. 対象と前提

Kafka Connect と Snowpipe Streaming を使い、イベントを管理 Iceberg テーブルとして参照する。 公式資料を組み合わせた説明用のモデルで、実機の配置や導入事例ではない。

## 2. 構成と役割

- **イベント送信元**：アプリケーションが注文イベントを発行する。
- **イベントログ**：イベントをトピックに保持する。
- **外部の接続処理**：トピックを購読し、Snowpipe Streaming を使って対象表に送信する。
- **取り込みと検証**：受信し PIPE の定義に従って検証や対応する変換を行う。
- **行エラーの記録**：行エラーの記録を有効にした場合に、取り込み中に拒否された行を保持する。
- **テーブル書き込み**：受信データから Iceberg 互換のデータファイルとメタデータを作る。
- **Iceberg メタデータ**：スナップショットやファイルの情報を保持する。
- **データファイル**：Parquet データを保持し、管理テーブルの compaction がファイル配置を保守する。
- **SQL による参照**：取り込んだテーブルを SQL で直接問い合わせる。

## 3. 処理の流れ

1. 既存 Kafka と Connect からイベントを送信する。
2. PIPE で検証と変換を行う。取り込み中に拒否された行はエラーテーブルで確認する。
3. Snowflake が管理 Iceberg のファイルとメタデータを作り、SQL で参照する。

Snowflake Connector for Kafka v4 は既存 Kafka Connect ランタイム上で動き、Snowpipe Streaming に取り込みを委ねる。Snowflake は管理 Iceberg テーブルの Parquet とメタデータ、compaction を管理する。サーバー側の検証エラーと、レコード変換時に Kafka Connect 側で起きるエラーは発生場所が異なる。

## 4. 留意点

対象は Snowflake 管理 Iceberg 表であり、外部カタログ管理の Iceberg 表への書き込みとは区別する。変換器での失敗は Snowflake 側へ到達する前のため別途 Kafka 側のエラー処理が必要。Snowflake SQL での可視化時点と外部エンジンに見える Iceberg snapshot の更新時点は同一とは限らない。行イベントの追加と CDC の現在状態反映は別の処理。

## 5. 実装例

この例では、利用者が管理するデータセンターの別々の Linux ホストで Kafka と Kafka Connect を運用する。Snowflake Connector v4 はサーバー側検証を使い、事前作成した Snowflake 管理 Iceberg テーブルにイベントを追記する。`EXTERNAL_VOLUME = SNOWFLAKE_MANAGED` で Snowflake 提供のストレージを選び、テーブルで `ERROR_LOGGING = TRUE` を設定する。図の Snowflake アカウント枠はサービスとファイルの論理的な所属を示す。コネクター用の Snowflake ユーザーとロールには、対象テーブルへの取り込みに必要な権限を与える。認証方式は鍵ペアを選ぶ。ホストの配置は説明用の仮定である。鍵管理、ネットワーク経路、コネクターと Kafka のバージョンの組み合わせは未検証である。

| 機能 | 担い手 |
| --- | --- |
| イベント送信元 | 注文アプリケーション |
| イベントログ | 既存 Kafka トピック |
| 外部の接続処理 | Kafka Connect と Snowflake Connector v4 |
| 取り込みと検証 | Snowpipe Streaming と、利用者が設定する名前付き PIPE |
| 行エラーの記録 | Snowflake のエラーテーブル |
| テーブル書き込み | Snowflake 管理 Iceberg の書き込み |
| Iceberg メタデータ | 管理 Iceberg メタデータ |
| データファイル | 管理 Iceberg の Parquet |
| SQL による参照 | SQL 利用者が送るクエリを Snowflake Warehouse で実行 |

## 公式資料

- [Kafka topics を Iceberg に取り込む](https://www.snowflake.com/en/blog/engineering/kafka-topics-iceberg-tables-snowflake/)
- [Snowflake Connector for Kafka](https://docs.snowflake.com/en/user-guide/kafka-connector)
- [Snowpipe Streaming](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/data-load-snowpipe-streaming-overview)

- [Kafka Connector の設定と認証](https://docs.snowflake.com/en/user-guide/kafka-connector/setup-kafka)
- [Iceberg テーブルのストレージ](https://docs.snowflake.com/en/user-guide/tables-iceberg-storage)
- [Kafka Connector の Iceberg 取り込み](https://docs.snowflake.com/en/user-guide/kafka-connector/iceberg)
