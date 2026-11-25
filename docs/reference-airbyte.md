# Airbyte の基本アーキテクチャ

## 1. Connection と Connector
Airbyte の Connection は Source Connector と Destination Connector の関係であり、対象データ、読み書き方式、同期条件を定義する。ここでは受注 API から分析用ウェアハウスへ複製する例を示す。

1. [PostgreSQL の初回スナップショットと CDC](reference-airbyte-postgres-cdc.md)
2. [Connector Builder の宣言・試し読み・公開](reference-airbyte-connector-builder.md)

出典 [Connections and streams](https://docs.airbyte.com/platform/using-airbyte/getting-started/set-up-a-connection)・[Airbyte Protocol](https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol)

## 2. Source Connector の読み取り
Source Connector は Stream を Full Refresh または Incremental で読む。HTTP API の Incremental では前回の State のカーソルを使う。State がない初回は Source の設定で指定した開始位置から読む。

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

## 6. 実装例：自前 Kubernetes の Connector Builder と PostgreSQL

自前 Linux Kubernetes に Airbyte を導入する。カスタム HTTP Source は注文 API の更新日時をカーソルとして取得する。API が時刻フィルターと必要な順序を提供する前提である。Airbyte 設定 DB と分析用 PostgreSQL は自前のサーバー群のうち Kubernetes クラスターの外側に置く想定である。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 受注 API | 注文 API の orders エンドポイント | 更新日時パラメーターとページングで注文を提供する。 |
| 入力 API アダプター | Airbyte のカスタム Source | Connector Builder でページングと updated_at を使う増分取得を定義する。 |
| 同期対象と実行設定、同期の実行単位 | Airbyte の Connection と同期ジョブ | 自前 Kubernetes の管理 Pod と同期ワークロードで動く。 |
| 増分の再開位置 | Airbyte 設定用 PostgreSQL サーバー | Destination からコミット済み State の確認を受け、Airbyte が設定 DB に保存する。 |
| 出力アダプター | Airbyte Postgres Destination | 受け取ったレコードを接続先のデータベースへ書く。 |
| 分析用データベース | 分析用 PostgreSQL サーバー | 同期された orders データを分析用スキーマに保存する。 |

実装で加わる部品を以下に示す。

- カスタム Source の YAML 宣言をワークスペースに公開する。API 認証の方式と入力項目、ページング、カーソルを宣言する。資格情報の値は Source 作成時に指定する。

利用者が Airbyte の導入・更新、Kubernetes から両 DB と外部 API への到達性、資格情報、TLS を管理する。分析用 DB のユーザーはテーブルと必要なスキーマを作成し、行を書き込める必要がある。ログ用ストレージとホスト台数は未指定である。

公式資料

- [Airbyte Protocol](https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol)
- [Connections and streams](https://docs.airbyte.com/platform/using-airbyte/getting-started/set-up-a-connection)
- [Sync Modes](https://docs.airbyte.com/platform/using-airbyte/core-concepts/sync-modes)
- [Incremental Sync](https://docs.airbyte.com/platform/connector-development/connector-builder-ui/incremental-sync)
- [Connector Builder](https://docs.airbyte.com/platform/connector-development/connector-builder-ui/overview)
- [Airbyte プラットフォーム構成](https://docs.airbyte.com/platform/understanding-airbyte/high-level-view)
- [Airbyte 設定 DB](https://docs.airbyte.com/platform/understanding-airbyte/database-data-catalog/config-database-connections)
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

AWS 例は公式資料を組み合わせた構成であり、動作は未検証である。AWS が EKS 制御プレーンと EC2・RDS・S3 の基盤を運用する。利用者は Kubernetes API、ノード、Airbyte、コネクター設定、DB・S3 のデータと権限を管理する。EKS ワーカーと RDS を同じ利用者 VPC に置く想定である。S3 と EKS 制御プレーンの論理的な所属は AWS アカウントの枠で示す。Airbyte のエディション、バージョンと Helm チャートの互換性は未検証である。

- [Deploying Airbyte](https://docs.airbyte.com/platform/deploying-airbyte)
