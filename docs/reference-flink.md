# Apache Flink の基本アーキテクチャ

Flink の stable 版ドキュメント（nightlies.apache.org）を基準に、構成部品・データの流れ・実行場所を整理する。ジョブグラフとスロット、イベント時刻、状態とチェックポイント、Kubernetes 上の運用は「仕組みの深掘り」の図で扱う。

## 1. Flink の位置づけ

Flink は、無限（unbounded）と有限（bounded）のデータストリームを状態付きで処理する分散処理エンジン。API は 4 層に分かれる。最下層の ProcessFunction は状態と時刻のコールバックを細かく制御する。DataStream API は変換・結合・ウィンドウ・状態の部品を持ち、多くのアプリケーションがここで書かれる。Table API は宣言的な関係演算、SQL はその最上位で、クエリを書く。

## 2. JobManager と TaskManager

ランタイムは JobManager と 1 つ以上の TaskManager の 2 種類のプロセスで構成される。クライアントはランタイムに含まれず、データフローを組み立てて提出する。

- **Dispatcher**：提出を受ける REST インターフェースと Web UI を持ち、ジョブごとに JobMaster を起動する。
- **JobMaster**：1 つのジョブの JobGraph の実行を管理する。ジョブごとに 1 つある。
- **ResourceManager**：タスクスロットを含むリソースの確保を担う。Standalone では既存の TaskManager のスロットを配るだけで、Kubernetes などでは基盤に TaskManager を要求できる。
- **TaskManager**：JVM プロセスで、Task を実行し、バッファを持ち、データストリームを交換する。スケジュールの最小単位はタスクスロット。
- 高可用性を設定すると、JobManager の 1 つが leader、残りが standby になる。

## 3. データの流れ：Source・Task・Sink

Source が外部システム（Kafka など）からイベントを読み、Operator をチェーンした Task が TaskManager のスロットで並列に動き、Sink が結果を外部へ書く。Operator chaining は複数の Operator を 1 つの Task（1 スレッド）にまとめ、スレッド間の受け渡しとバッファを減らす。スロット共有により、同じジョブの異なる Task の Subtask が同じスロットを使え、必要なスロット数はジョブの最大並列度で足りる。

## 4. 状態バックエンドとチェックポイント保存先

- **状態バックエンド**は、キー付き状態を動作中に持つ場所を決める。`state.backend.type` は `hashmap`（既定、JVM ヒープ）、`rocksdb`（TaskManager のローカルディスク）、`forst`（実験的）。
- **チェックポイント保存先**は、完了したチェックポイントを置く場所。`execution.checkpointing.dir` を指定するとファイルシステム型になり、指定しないと JobManager のメモリに置く型になる。この 2 つは独立に選ぶ。
- チェックポイントは、バリアを Source から流して、入力位置と各 Operator の状態の一貫したスナップショットを取る。障害時は最新の完了したチェックポイントから状態を戻し、Source を保存した位置に巻き戻す。
- 増分チェックポイントは RocksDB だけが対応する（公式の状態バックエンドのページ）。詳細は「Flink：状態バックエンドとチェックポイント」。

## 5. 動かし方

- **Application クラスタ**：1 つのアプリケーション専用で、`main()` がクラスタ上で動き、寿命がアプリケーションと同じ。資源の分離が良い。
- **Session クラスタ**：長く動き続け、複数のジョブを受け付ける。提出時にスロットを確保し、終了で解放する。ジョブ間で資源を共有するため、TaskManager の障害などの影響が全ジョブに及ぶ。起動の待ちがなく、短い対話的な処理に向く。
- 配備先は Standalone、Kubernetes（native）、マネージドサービスなど。Job Cluster は非推奨とされている。

## 6. シナリオ

「ジョブが提出されて動き出す」：クライアント → Dispatcher → JobMaster → ResourceManager でスロットを確保し、Task をデプロイして Source から Sink までイベントが流れる。「チェックポイントと復旧」：JobMaster がバリアを注入し、各 Task が状態を保存先へ書き、障害時に最新の完了点から再開する。

## 7. 実装例：Amazon Managed Service for Apache Flink と MSK

利用者が S3 にアプリケーションコードを置き、サービスにアプリケーションを作る。サービスが Flink を実行し、MSK の注文トピックを読んで別のトピックへ書く。

| 機能 | 担い手 |
| --- | --- |
| クライアント | AWS コンソール・CLI（CreateApplication・StartApplication） |
| Dispatcher・JobMaster・ResourceManager・Task・状態バックエンド | Managed Service for Apache Flink アプリケーション（内部配置は未確認） |
| チェックポイント保存先 | サービスが管理するチェックポイントとスナップショット（保存先は未確認） |
| Source・Sink | Amazon MSK のトピック |

実装で加わる部品は、S3 のコード、IAM サービス実行ロール、CloudWatch Logs。容量は KPU（1 vCPU・4 GB・実行用ストレージ 50 GB）で決まり、`Parallelism / ParallelismPerKPU` が割り当て KPU 数になる（別にオーケストレーション用の KPU が 1 つ課金される）。チェックポイントは既定で有効（間隔 60000 ms、最小間隔 5000 ms）。AWS が実行基盤を運用し、利用者がコード・並列度・チェックポイント設定・権限を管理する。JobManager と TaskManager の内部への操作範囲は確認した資料に記載がなく、未確認。

## 8. 実装例：自前ホストの Standalone クラスタと Kafka・HDFS

自前のサーバー群で JobManager と TaskManager を動かし、自前の Kafka を読み、チェックポイントを HDFS に置く。

| 機能 | 担い手 |
| --- | --- |
| クライアント | Flink CLI・Web UI |
| Dispatcher・JobMaster・ResourceManager | JobManager プロセス |
| Task | 複数ホストの TaskManager プロセス |
| 状態バックエンド | EmbeddedRocksDBStateBackend（TaskManager のローカルディスク） |
| チェックポイント保存先 | HDFS（`execution.checkpointing.dir` に hdfs:// のパス） |
| Source・Sink | 自前の Kafka のトピック |

すべて利用者が運用する。Standalone の起動方法、HA 構成、Java のバージョン、実動作は未確認。図は公式資料を組み合わせた代表例である。

## 公式資料

- [Flink · Flink Architecture](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/flink-architecture/)
- [Flink · Overview](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/overview/)
- [Flink · Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)
- [Flink · State Backends](https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/state/state_backends/)
- [Flink · Native Kubernetes](https://nightlies.apache.org/flink/flink-docs-stable/docs/deployment/resource-providers/native_kubernetes/)
- [Flink · Standalone deployment](https://nightlies.apache.org/flink/flink-docs-stable/docs/deployment/resource-providers/standalone/overview/)
- [Flink · Kafka connector](https://nightlies.apache.org/flink/flink-docs-stable/docs/connectors/datastream/kafka/)
- [Managed Service for Apache Flink · How it works](https://docs.aws.amazon.com/managed-flink/latest/java/how-it-works.html)
- [Managed Service for Apache Flink · Fault tolerance](https://docs.aws.amazon.com/managed-flink/latest/java/how-fault.html)
- [Managed Service for Apache Flink · Application scaling](https://docs.aws.amazon.com/managed-flink/latest/java/how-scaling.html)
