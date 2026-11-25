# Snowflake：Snowpipe Streaming の受信と取り込み

## 1. 対象と前提

Snowpipe Streaming の高性能アーキテクチャで、受信からテーブルへの反映までを扱う。Snowflake が 2025 年の技術記事で公開した内部処理と、現在の設定ガイドに基づく論理図である。

## 2. 構成と役割

- **イベント送信**：アプリケーションは SDK または REST から行を送信する。
- **認証と振り分け**：Ingress は認証した要求を受け、Assigner のルーティングに従って Buffering Tier に振り分ける。
- **負荷に応じた割当**：Assigner は Buffering Tier の負荷情報を基に割当を調整する。
- **一時バッファ**：Buffering Service は暗号化された行または blob 参照を保持し、負荷情報を提供する。
- **取り込み定義**：PIPE は対象テーブルと取り込み時の処理を指定するスキーマ内のオブジェクトである。
- **取り込みジョブ**：Snowpipe がサーバーレスのジョブをスケジュールし、チャネルのスループットに応じて処理を分担する。
- **取り込み時の配置**：設定した場合、ミニバッチを作り、クラスタリングキーに沿って書き込み前に配置を調整する。
- **分析対象の表**：Snowflake テーブルまたは Snowflake 管理 Iceberg テーブルへ書き込み、クエリ可能にする。
- **読み取り**：テーブルに反映されたデータを SQL で読み取る。

## 3. 処理の流れ

1. SDK または REST から行を受信して認証し、バッファに振り分ける。
2. 負荷を観測し、Assigner が振り分け先を調整する。
3. PIPE の定義に基づき、サーバーレスジョブがバッファから取得する。
4. 表への反映後に SQL で読む。取り込み時のクラスタリングを有効にした場合は、内部ジョブが書き込み前にミニバッチを整理する。

2025 年の技術ブログでは SDK の Rust コアが Rowset Mode と File Mode の転送を使い分け、前者は Ingress で暗号化し、後者は内部ステージ上の blob と参照を利用する。Assigner はバッファの使用状況を受け取りルーティングを調整する。pre-clustering のミニバッチはチャネル名を使い、書き込み前の配置を整える。クラスタリングの設定と対応条件は現行ガイドを確認する。

## 4. 留意点

取り込み時のクラスタリングは任意である。対象表にクラスタリングキーを定義し、名前付き PIPE の `COPY INTO` で `CLUSTER_AT_INGEST_TIME` を有効にする。今回の構成例におけるクラスタリングの実動作は未確認である。[The PIPE object](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/snowpipe-streaming-pipe-object)

行の受付と表への反映は別の段階である。Named Channel を再開する場合は `last_committed_offset_token` で反映位置を読み、送信元の再開位置を決める。エラーで拒否された行はチャネルの状態も参照して確認する。内部ホスト、バッファの耐久化方式、ジョブのスケジューリングしきい値は未確認である。[Named Channels](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/snowpipe-streaming-channels)

## 5. 実装例：注文イベントを取り込み、SQL で照会

利用者のアプリが `order_id` と `event_ts` を持つ注文イベントを、Snowpipe Streaming SDK の Named Channel から名前付き PIPE に送る。PIPE の `COPY INTO` で入力の列を管理 Iceberg テーブルへ対応付ける。テーブルは `CATALOG = 'SNOWFLAKE'` と `EXTERNAL_VOLUME = 'SNOWFLAKE_MANAGED'` を使う Iceberg v3 の例である。Snowflake がデータファイルとメタデータを保存する。照会用 SQL クライアントがコミット済みの注文イベントを読む。[CREATE PIPE](https://docs.snowflake.com/en/sql-reference/sql/create-pipe) [Snowpipe Streaming with Iceberg tables](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/snowpipe-streaming-high-performance-iceberg)

| 機能 | 担い手 |
| --- | --- |
| イベント送信 | 利用者が運用するアプリと Snowpipe Streaming SDK |
| 送信の認証・権限とデータの振り分け | 送信用ユーザー・ロールと Snowpipe Streaming の受信サービス。サービス内の Ingress が認証し、データを振り分ける。 |
| 負荷に応じた割当と一時バッファ | Snowflake が運用する Assigner と Buffering Tier |
| 取り込み定義 | 利用者が作る名前付き PIPE |
| 取り込み・書き込み前のクラスタリング | Snowflake が運用するサーバーレスジョブ。クラスタリングは任意 |
| 取り込み結果 | Snowflake ストレージを使う管理 Iceberg テーブル |
| SQL 照会 | 利用者の SQL クライアントと照会用 Virtual Warehouse |

送信アプリは Snowflake アカウントの URL へ TLS で接続し、JWT のキーペア認証を使う。利用者は送信用ユーザーに公開鍵を登録する。送信ロールにはデータベースとスキーマの `USAGE`、対象表の `INSERT`、名前付き PIPE の `OPERATE` を付与する。この例では Snowflake ストレージを使うため、利用者の外部ボリュームの権限は不要である。プロジェクトのネットワーク制限と SDK バージョンは要件に合わせて選ぶ。[SDK の設定](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/snowpipe-streaming-high-performance-configurations) [アクセス制御](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/snowpipe-streaming-access-control)

PIPE の管理者は、許可されたデータベースとスキーマで名前付き PIPE を作り、`COPY INTO` の対象表と列マッピングを定義する。自動作成される既定 PIPE の作成・変更・削除は Snowflake が管理する。Ingress、Assigner、Buffering Tier、サーバーレスジョブの実行基盤も Snowflake が運用する。図はそれらの公開された処理とアカウントの論理境界を示す。[The PIPE object](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/snowpipe-streaming-pipe-object) [Snowpipe Streaming engineering architecture](https://www.snowflake.com/en/blog/engineering/next-gen-snowpipe-streaming-architecture/)

照会ロールには対象表の `SELECT` とデータベース・スキーマ・Warehouse の `USAGE` を付与する。照会用 Virtual Warehouse はコミット後の SQL に使う。取り込みと PIPE の列変換は Snowflake 管理のサーバーレスジョブが実行する。リージョン、利用アカウントの設定値、実動作は未確認である。[Virtual warehouses](https://docs.snowflake.com/en/user-guide/warehouses-overview) [Snowflake の権限](https://docs.snowflake.com/en/user-guide/security-access-control-privileges)

## 公式資料

- [次世代 Snowpipe Streaming の内部構造](https://www.snowflake.com/en/blog/engineering/next-gen-snowpipe-streaming-architecture/)
- [Snowpipe Streaming の現行仕様](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/data-load-snowpipe-streaming-overview)
- [Kafka から Iceberg へ](https://www.snowflake.com/en/blog/engineering/kafka-topics-iceberg-tables-snowflake/)
- [取り込み設計と性能](https://www.snowflake.com/en/blog/engineering/efficient-snowflake-ingestion-query-ready/)
- [The PIPE object](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/snowpipe-streaming-pipe-object)
- [アクセス制御](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/snowpipe-streaming-access-control)
- [SDK の設定](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/snowpipe-streaming-high-performance-configurations)
- [Virtual warehouses](https://docs.snowflake.com/en/user-guide/warehouses-overview)
