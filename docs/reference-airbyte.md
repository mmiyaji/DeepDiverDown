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

## 7. 実装例：Amazon EKS 上の Airbyte・RDS・S3

EC2 ノードを持つ EKS に Helm で Airbyte を自己管理展開する。カスタム Source で注文 API を増分取得し、分析用の RDS for PostgreSQL に格納する。

| 機能 | 担い手 |
| --- | --- |
| 同期の定義と投入 | Helm で導入した Airbyte の管理 Pod。接続でカーソルと頻度を設定する。 |
| 増分入力と同期 | EKS の EC2 ノード上の同期 Pod。宣言型 Source が受注 API を取得する。 |
| 増分の再開位置 | Airbyte プラットフォーム用の RDS PostgreSQL。 |
| 出力とログ | Postgres Destination が分析専用の RDS PostgreSQL に書き、ワークロードのログ等は S3 に保持する。 |

Airbyte のバージョンと Helm チャートの組み合わせを固定し、利用するエディションでカスタム Source と外部ストレージ設定を確認する。自己管理構成では利用者が EKS と Airbyte を運用する。受注 API の資格情報、2つの PostgreSQL のユーザーと TLS、EKS から S3 への IAM 権限を設定する。API へは HTTPS で到達でき、受注 API が更新日時による増分取得を提供する前提とする。

公式資料

- [Airbyte の Kubernetes への導入](https://docs.airbyte.com/platform/deploying-airbyte)
- [Airbyte の状態・ログ用オブジェクトストレージ](https://docs.airbyte.com/platform/deploying-airbyte/integrations/storage)
- [Airbyte 設定 DB の接続と同期 State](https://docs.airbyte.com/platform/understanding-airbyte/database-data-catalog/config-database-connections)
- [EKS マネージドノードグループ](https://docs.aws.amazon.com/eks/latest/userguide/create-managed-node-group.html)
- [Connector Builder](https://docs.airbyte.com/platform/connector-development/connector-builder-ui/overview)
- [Postgres Destination](https://docs.airbyte.com/integrations/destinations/postgres)

自前例は Linux Kubernetes ノードで Airbyte を自己管理し、分析先と別の PostgreSQL に接続設定と確定済み State を保存する。ログ用ストレージ、ネットワークとホストの具体的な構成は未指定である。AWS 例は公式資料の組み合わせによる代表構成であり、動作検証済み導入事例ではない。AWS が EKS 制御プレーンと EC2・RDS・S3 基盤を運用し、利用者は Kubernetes API、ノード、Airbyte、コネクター設定、DB・S3 のデータと権限を管理する。制御プレーンサーバーには直接アクセスしない。Airbyte のエディション、バージョンと Helm チャートの互換性は未検証。

- [Deploying Airbyte](https://docs.airbyte.com/platform/deploying-airbyte)
