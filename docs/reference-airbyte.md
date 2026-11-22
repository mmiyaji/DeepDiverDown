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
