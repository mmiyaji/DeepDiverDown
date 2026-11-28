# Cadence の概要（ワークフロー実行・イベント履歴・タスクリスト）

2026 年 11 月時点で取得した公式資料に基づく。

## 1. 概要

Cadence は、分散アプリケーションをワークフローとアクティビティで書くためのオーケストレーション基盤である。ワークフローはタイマーで長時間待機でき、シグナルで外部イベントを受け、クエリで内部状態を返す。回復はイベントソーシングによるため、ワークフローのコードは決定的でなければならない。外部 API の呼び出しはアクティビティで行い、現在時刻の取得、スリープ、スレッドの生成は Cadence の API を使う。親子ワークフローの通信は非同期のシグナルに限られる。ワークフローの失敗時は、指数バックオフのリトライポリシー（`InitialInterval`、`BackoffCoefficient`、`MaximumAttempts` など）で先頭から再実行できる。ライセンスは Apache 2.0（GitHub リポジトリの記載）。ワーカーが障害から回復する際の履歴の再生手順は、取得した資料に詳細がなく未確認。

- [Cadence Introduction](https://cadenceworkflow.io/docs/concepts/)
- [Cadence Workflows](https://cadenceworkflow.io/docs/concepts/workflows/)
- [Cadence Deployment topology](https://cadenceworkflow.io/docs/concepts/topology/)（2026 年 11 月 28 日取得）
- [Cadence Service Dependencies](https://cadenceworkflow.io/docs/tech-review/day-0-planning/design/service-dependencies)（2026 年 11 月 28 日取得）
- [Cadence Cluster Configuration](https://cadenceworkflow.io/docs/operation-guide/setup/)（2026 年 11 月 28 日取得）
- [cadence-workflow/cadence (GitHub)](https://github.com/cadence-workflow/cadence)

## 2. サーバーのサービス

デプロイ構成の資料は、次のサービスを挙げている。

- Frontend：ステートレス。ワーカーなどからの要求を受け、外部のロードバランサーで分散する。
- History：ワークフローとアクティビティの進行を制御し、ワークフローの状態と永続的なタイマーを持つ。
- Matching：ワークフローとアクティビティのタスクを、実行できるワーカーに引き合わせる。History がタスクを割り当てる。
- Internal Worker（Worker サービス）：アーカイブなど Cadence 自身の内部ワークフローとアクティビティを動かす。サービス依存の資料によると、RPC の API は持たず、クラスタのメンバーシップ経由でのみ到達する。高度な可視性が有効なときは可視性のトピックを読み、検索ストアへ一括で書く。履歴のアーカイブは既定でこのサービスのシステムワークフローが行う。図には描いていない（接続の向きは未確認）。

サービス間の個別の呼び出し経路（Frontend から History への転送など）は、資料が各サービスの役割だけを述べているため、役割からの整理であり経路は未確認。確認できたのは、ワーカーが Frontend へ要求を送ること、History が Matching へタスクを割り当てること、サービス同士は YARPC（gRPC と Thrift）で通信し Ringpop で互いを見つけることである。

シャードは、運用ガイドによると、ワークフローごとに 1 つのシャードへ対応し、シャード内の作成・更新は直列化される。各シャードは一貫性ハッシュのリングで 1 つの History ノードが持つ。シャード数（`numHistoryShards`）はクラスタ作成時に決める静的な値で、後から変えられず、変更には別クラスタへの移行が必要になる。資料は 1K〜16K を目安とし、SQL 系の永続化なら 2K、Cassandra なら 8K を挙げる。シャード数を超えて History ノードを増やしても、シャードを持たないノードが出るだけである。シャードの所有は既定で Ringpop が扱い、任意の Shard Manager は Ringpop による所有に代わり etcd への依存を加える。

- [Cadence Deployment topology](https://cadenceworkflow.io/docs/concepts/topology/)（2026 年 11 月 28 日取得）

## 3. 永続化ストア

サーバーは永続化ストアを前提とする。Cassandra、MySQL、PostgreSQL は、プラグイン、スキーマ、CI が提供されている。CockroachDB と TiDB は PostgreSQL・MySQL のワイヤープロトコル経由で動く可能性があるが、プロジェクトは同梱も検証もしていない。ワークフローの進行はイベント履歴として保存される。

## 4. タスクリストとワーカー

タスクリストは、タスクをワーカーへ届ける内部のキューである。ワークフローが `ScheduleActivityTask` の決定を出すと、サービスがアクティビティタスクをアクティビティ用のタスクリストに追加する。ワークフローが外部イベントを処理する必要があるときは、決定タスクが決定用のタスクリストを通じてワークフローワーカー（デサイダー）に届く。タスクリストは事前登録が不要で、オンデマンドで作られ、数の制限はない。

ワーカーはタスクリストをロングポーリングで取得する。余力があるときだけポーリングするため過負荷にならず、ワーカー側でポートを開けることも、名前解決も不要である。サーバー側でディスパッチ率を制限できる。ワークフローワーカーは決定タスクを受けて決定を返し、アクティビティワーカーはアクティビティを実行して完了を報告する。ワーカーは利用者のプロセスで動き、公式は Go と Java の SDK（デプロイ構成の資料は Python も挙げる）を提供する。スティッキー実行は取得した資料に記載がなく未確認。

- [Cadence Task lists](https://cadenceworkflow.io/docs/concepts/task-lists/)

## 5. 可視性ストア

ワークフローの検索（高度な可視性）は、Elasticsearch、OpenSearch、Pinot のいずれかと Kafka を使う。クロスデータセンターレプリケーションとスケジュールは、サイドバーの項目名のみ確認し、内容は未確認。

## 6. 実装例：自前のサーバー群での Cadence クラスタ

| 機能 | 具体的な担い手 |
| --- | --- |
| クライアント | Go・Java の SDK、CLI、HTTP API を使うアプリケーション |
| Frontend | Cadence Frontend（ロードバランサーの背後に複数） |
| ワークフローの制御 | Cadence History |
| タスクの割り当て・タスクリスト | Cadence Matching |
| イベント履歴の永続化 | Cassandra クラスタ（MySQL・PostgreSQL も可） |
| 可視性ストア | Kafka と Elasticsearch |
| ワークフローワーカー・アクティビティワーカー | 利用者のアプリケーションホスト上の SDK ワーカー |

利用者が自前のサーバーで Cadence、データベース、ワーカーを運用する構成。公式資料を組み合わせた代表例であり、導入事例や動作検証済みの構成ではない。Matching がタスクリストを管理するという対応と、Frontend・History 間の経路は資料の役割記述からの整理で、個別の記載は未確認。台数、シャード数の具体値、認証、TLS も未確認。マネージド版の有無は取得した資料で確認していないため、実装例は自前構成のみとした。
