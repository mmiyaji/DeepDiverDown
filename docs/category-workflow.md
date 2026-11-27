# ワークフロー実行基盤の違い

自前運用型

| 観点 | Temporal | Restate | Cadence |
| --- | --- | --- | --- |
| 特徴 | **Workflow と Activity** で書く耐久実行基盤。Temporal Service が Event History を永続化する | **ハンドラー** を耐久的に実行する基盤。単一の Rust バイナリのサーバーが前段に立つ | **ワークフローとアクティビティ** で書くオーケストレーション基盤。イベントソーシングで回復する |
| 実行モデル | **履歴の再生**。別の Worker が Event History でコードを再実行して状態を戻す。コードは決定的にする | **ジャーナルの再生**。ステップと結果を記録し、完了済みのステップを飛ばして続きから実行する | **イベント履歴による回復**。コードは決定的にする。Worker 回復時の再生手順は未確認 |
| 状態の保存先 | Event History は Temporal Service が永続化。例では **PostgreSQL**（Persistence と Visibility のスキーマ） | サーバーが状態と実行履歴を保持する。保存形式は未確認。ログは **パーティションごと**、スナップショットは S3 互換 | **Cassandra、MySQL、PostgreSQL**。CockroachDB と TiDB は未検証 |
| 拡張のしかた | Worker が Task Queue をポーリングする。Worker の追加で処理を増やす例がある。サーバー側の分割方法は未確認 | ログ・ノードの役割（`admin`、`http-ingress`、`log-server`、`metadata-server`、`worker`）で構成する。パーティション数は既定 24 で **後から変更できない**。自動増減は想定外 | Worker はロングポーリングで取得し、余力がある時だけ受ける。タスクリストは事前登録が不要。シャードの扱いは未確認 |
| 運用の形態 | 自前の Kubernetes と PostgreSQL を利用者が運用する例。Temporal Cloud は資料の範囲外 | 自前の Linux 上のクラスタ。Restate Cloud の仕様は未確認 | 自前のサーバー群。マネージド版の有無は未確認 |
| 検索（可視性） | **Visibility** スキーマで実行一覧を絞り込む。Web UI と CLI から使う | 未確認 | **Elasticsearch、OpenSearch、Pinot** のいずれかと Kafka |
| 呼び出しと SDK | Worker を Temporal SDK で作る。対応言語は未確認 | HTTP、Kafka、プログラムから起動。冪等キーで重複を防ぐ。SDK は TypeScript、Java、Kotlin、Python、Go、Rust、Ruby | 公式 SDK は Go と Java。Python も構成資料に記載がある |
| 得意な用途 | 外部 API を呼ぶ長い業務処理（例：注文と決済）を、Worker 障害後も続ける | 状態を持たないサービスに耐久実行と **キーごとの状態** を足す | タイマー、シグナル、クエリを使う長時間の業務フロー |
| 注意点 | Activity は再試行で **重複実行** されうる。外部操作は冪等にする。リプレイと再試行は別の処理 | **Virtual Object** はキーごとに書き込み 1 つ。Workflow の `run` は ID ごとに 1 回。構成の細部は未確認 | 親子ワークフローの通信は **シグナルのみ**。スティッキー実行、クロス DC レプリケーションは未確認 |
| ライセンス | 未確認 | **BUSL 1.1**（OSI 定義のオープンソースではない）。自組織での本番利用は可。第三者への公開マネージド提供は除く。公開 4 年後に Apache 2.0。SDK は未確認 | **Apache 2.0**（GitHub リポジトリの記載） |

内容は 2026 年 11 月時点の公式資料に基づきます。確認できなかった点は「未確認」と書いています。

## 選び方

- Worker が履歴を再生する形で、外部呼び出しを Activity に分けたい → **Temporal**
- 既存サービスへ耐久実行とキー単位の状態を足したい（BUSL 1.1 の条件を確認のうえ） → **Restate**
- Apache 2.0 で、Cassandra・MySQL・PostgreSQL の上で動かしたい → **Cadence**
- どの製品でも、外部の副作用は **冪等キー** で守る

## 公式資料

- [Temporal Event History](https://docs.temporal.io/encyclopedia/event-history)
- [Temporal Activity Definition](https://docs.temporal.io/activity-definition)
- [Temporal Retry Policy](https://docs.temporal.io/encyclopedia/retry-policies)
- [Temporal Visibility setup](https://docs.temporal.io/self-hosted-guide/visibility)
- [Temporal Task Queues](https://docs.temporal.io/task-queue)
- [Restate Durable Execution](https://docs.restate.dev/concepts/durable_execution)
- [Restate Services](https://docs.restate.dev/foundations/services)
- [Restate Clusters](https://docs.restate.dev/operate/clusters)
- [Restate LICENSE](https://github.com/restatedev/restate/blob/main/LICENSE)
- [Cadence Introduction](https://cadenceworkflow.io/docs/concepts/)
- [Cadence Deployment topology](https://cadenceworkflow.io/docs/concepts/topology/)
- [Cadence Task lists](https://cadenceworkflow.io/docs/concepts/task-lists/)
- [cadence-workflow/cadence (GitHub)](https://github.com/cadence-workflow/cadence)
