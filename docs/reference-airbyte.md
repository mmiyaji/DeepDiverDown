# Airbyte の基本アーキテクチャ

## 1. Connection と Connector
Airbyte の Connection は Source Connector と Destination Connector の関係であり、対象データ、読み書き方式、同期条件を定義する。ここでは受注 API から分析用ウェアハウスへ複製する例を示す。

出典 [Connections and streams](https://docs.airbyte.com/platform/using-airbyte/getting-started/set-up-a-connection)・[Airbyte Protocol](https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol)

## 2. Source Connector の読み取り
Source Connector は Stream を Full Refresh または Incremental で読む。Incremental は前回の State 以降だけを返し、cursor が境界になる。初回の Incremental は全件取得に相当する。

出典 [Sync Modes](https://docs.airbyte.com/platform/using-airbyte/core-concepts/sync-modes)・[Incremental Sync](https://docs.airbyte.com/platform/connector-development/connector-builder-ui/incremental-sync)

## 3. Sync Job と Destination Connector
Connection の各実行は Sync である。Sync Job は Source のレコードと State を受け取り、Destination Connector が Append、Overwrite、Deduped などの方式で保存する。

出典 [Connections and streams](https://docs.airbyte.com/platform/using-airbyte/getting-started/set-up-a-connection)・[Airbyte Protocol](https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol)・[Sync Modes](https://docs.airbyte.com/platform/using-airbyte/core-concepts/sync-modes)

## 4. State とチェックポイント
Source が State を出し、Destination がその State までのレコードをコミットしたことを確認してから、次回の Source に渡す。途中失敗時もコミット済み State から再開できる。

出典 [Airbyte Protocol — State & Checkpointing](https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol)

## 5. 再開とスキーマ変更
Connection は自動スケジュールまたは手動で繰り返し実行できる。State の編集やスキーマ変更は再実行・再同期が必要になる場合があるため、具体的な実行間隔や内部配置は断定しない。

出典 [Connections and streams](https://docs.airbyte.com/platform/using-airbyte/getting-started/set-up-a-connection)・[Modifying connection state](https://docs.airbyte.com/platform/cloud/managing-airbyte-cloud/manage-connection-state)・[Schema change management](https://docs.airbyte.com/platform/using-airbyte/schema-change-management)

## 6. 実装例：Airbyte Connector Builder と PostgreSQL

注文 API の更新日時をカーソルとし、Airbyte の増分接続から PostgreSQL に集める例。API が時刻フィルターと必要な順序を提供する前提で同期範囲を決める。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 受注 API | 注文 API の orders エンドポイント | 更新日時パラメーターとページングで注文を提供する。 |
| 入力 API アダプター | Airbyte のカスタム Source | Connector Builder でページングと updated_at を使う増分取得を定義する。 |
| 同期対象と実行設定、同期の実行単位、増分の再開位置 | Airbyte の Connection・同期ジョブ・状態 | 同期頻度とストリームを設定し、接続ごとの進捗を管理する。 |
| 出力アダプター | Airbyte Postgres Destination | 受け取ったレコードを接続先のデータベースへ書く。 |
| 分析用データベース | PostgreSQL の分析用スキーマ | 同期された orders データを保存する。 |

実装で加わる部品を以下に示す。

- カスタム Source の宣言ファイル。API の認証、ページング、ストリームのカーソル設定を定義する。

公式資料

- [Airbyte Protocol](https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol)
- [Connections and streams](https://docs.airbyte.com/platform/using-airbyte/getting-started/set-up-a-connection)
- [Sync Modes](https://docs.airbyte.com/platform/using-airbyte/core-concepts/sync-modes)
- [Incremental Sync](https://docs.airbyte.com/platform/connector-development/connector-builder-ui/incremental-sync)
- [Airbyte Postgres Destination](https://docs.airbyte.com/integrations/destinations/postgres)
