# Kafka：Kafka Streams の Task と状態ストア

Apache Kafka 4.4 の公式ドキュメントを基準に、Kafka Streams のアプリが入力パーティションを Task に分け、状態を持つ処理の状態を changelog で復旧する仕組みを追う。前提は「Apache Kafka の基本アーキテクチャ」。Kafka Streams は Kafka と別のライブラリで、アプリの JVM プロセスの中で動く。

## 1. 対象と前提

- 受注イベントの Topic を集計し、結果を出力 Topic に書く例。集計の状態は Task ごとのローカルストアに持つ。
- 図の「Topic から集計・状態復元」シナリオで、Task、トポロジー、状態ストア、changelog、復旧を順に追える。

## 2. Topic パーティションと Task

- 入力 Topic のパーティションに基づいて、固定数の Task が作られる。各 Task は入力パーティションの一覧を受け持ち、その割り当ては変わらない。
- 並列度の上限は Task の数。パーティションが 5 つなら、動けるインスタンスは最大 5 つで、余りは待機する。
- 1 つのインスタンスは複数のスレッドを持てる。スレッドは状態を共有せず、それぞれ 1 つ以上の Task を実行する。

## 3. Processor Topology

- アプリは Source、変換、集計などのプロセッサをつないだトポロジーとして書く。各 Task が自分のトポロジーを持ち、レコードを順に処理する。
- 結果は出力 Topic に書く。

## 4. ローカル状態ストア

- join、aggregate、window など状態を持つ処理では、DSL が Task ごとにローカルの状態ストアを作る。ストアは永続のキーバリュー、メモリ上のハッシュマップなどにできる。
- ストアは Interactive Queries で、アプリの外から読み取り専用で照会できる。

## 5. changelog と復元

- 状態ストアの更新は、複製された changelog Topic に記録される。changelog はパーティション化され、ストアごとに専用のパーティションを持つ。ログ圧縮が有効で、古い値は消える。
- Task が別のインスタンスへ移ると、changelog を再生して状態を復元してから処理を再開する。

## 6. スタンバイと障害時の動き

- `num.standby.replicas` を設定すると、ローカル状態のコピーを持つスタンバイ Task が置かれ、移動後の復元時間が短くなる。追い付いたコピーを持つインスタンスが優先して割り当てられる。
- インスタンスが落ちると、その Task は残りのインスタンスで再起動する。スレッドは実行中に増減でき、パーティションは再配分される。

## 7. 時刻と遅れて届くレコード

- 時刻には、イベントの発生時刻、処理時刻、Broker の追記時刻がある。どれを使うかは Kafka 側の設定（Topic の時刻の種類）とタイムスタンプの取り出し方で決まる。既定の TimestampExtractor はレコードに埋め込まれた時刻をそのまま使う。
- Kafka Streams の時計（stream time）は、新しいレコードが届いたときだけ進む。
- ウィンドウ処理では、grace period の間は遅れたレコードを受け付け、ウィンドウ終了と猶予を過ぎたレコードは捨てる。

## 8. 処理保証

- `processing.guarantee` の既定は `at_least_once`。`exactly_once_v2` にすると、入力 offset のコミット、状態ストアの更新、出力 Topic への書き込みを原子的にコミットする。Kafka のトランザクションとべき等な Producer に基づく。
- `exactly_once_v2` には 2.5 以降のブローカーが要る。

## 9. 実装例：Kafka Streams JVM と RocksDB

Kafka Streams を組み込んだ JVM アプリケーションを複数起動する例。分割・タスク・状態はアプリケーション ID の範囲で管理する。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 入力ログ | Kafka 入力トピック | 注文イベントをパーティションに分ける。 |
| 分割ごとの実行単位、ストリームの処理グラフ | Java アプリの Stream Task と Topology | 各 JVM 内のタスクが処理グラフを実行する。 |
| ローカル状態ストア | ローカルの RocksDB ストア | 永続ストアを使用し、担当タスクの集計状態を保持する。 |
| 出力ログ、状態の変更ログ | Kafka 出力トピックと内部 changelog トピック | 結果と復旧用の状態変更を異なるトピックで保持する。 |

実装で加わる部品を以下に示す。

- application.id と state.dir。同じアプリケーションの実行個体で ID を揃え、ローカル状態の保存先を設定する。

公式資料

- [Kafka Streams Architecture](https://kafka.apache.org/44/streams/architecture/)
- [Configuring a Streams Application](https://kafka.apache.org/44/streams/developer-guide/config-streams/)

## 10. 実装例：Amazon ECS on Fargate と Amazon MSK

Kafka Streams を組み込んだ Java コンテナを Amazon ECS のサービスとして Fargate で実行する例。Amazon MSK が入力、出力、状態変更ログを保持する。

| 機能 | 担い手 |
| --- | --- |
| 入力・出力・状態変更ログ | 同じ MSK クラスター上の入力、出力、内部 changelog の各 Kafka トピック。 |
| 実行単位と処理グラフ | Fargate で動く JVM 内の Kafka Streams Task と Topology。 |
| ローカル状態ストア | Fargate の一時ストレージ上の RocksDB。 |

ECS サービスで実行個体数を管理し、個体間で同じ `application.id` を指定する。Kafka Streams がパーティション単位で処理を割り当てる。置き換えで新しい ECS タスクになった場合は、changelog を再生してローカル状態を復元する。タスクと MSK の到達性、Kafka クライアントの認証、入力と出力に加えて内部トピックへ必要なアクセスを設定する。

公式資料

- [ECS on Fargate のタスク定義](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html)
- [Fargate タスクの一時ストレージ](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-storage.html)
- [Fargate サービスタスクの置き換え](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-maintenance.html)
- [MSK クライアントのアクセス](https://docs.aws.amazon.com/msk/latest/developerguide/client-access.html)
- [Kafka Streams Architecture](https://kafka.apache.org/44/streams/architecture/)

自前例は利用者管理の Linux ホスト群で JVM アプリを起動し、別の自前 Kafka ブローカーホスト群を用いる。具体的なホスト数とネットワークは未指定である。AWS 例は公式資料を組み合わせた代表構成であり、動作検証済み事例ではない。AWS は Fargate・ECS・MSK の基盤を運用し、利用者はタスク定義、コンテナ、必要な一時ストレージ容量、Kafka 認証・権限とトピックを管理する。Fargate の基盤ホストには直接アクセスしない。Linux Fargate プラットフォーム 1.4.0 以降を想定し、イメージも一時ストレージを使用する。Kafka Streams と MSK のバージョン互換性は未検証。

## 未確認

- Kafka Streams の内部のリバランス手順（Task の再割り当てが停止を伴うか）は、確認した資料の範囲では扱っていない。
- changelog の復元にかかる時間とスタンバイの必要数は、状態の大きさに依存し、資料に目安がない。
- Fargate の一時ストレージ上の状態と changelog のみで運用するときの復元時間は未検証。

## 公式資料

- [Kafka Streams Architecture](https://kafka.apache.org/44/streams/architecture/)
- [Kafka Streams Core Concepts](https://kafka.apache.org/44/streams/core-concepts/)
- [Configuring a Streams Application](https://kafka.apache.org/44/streams/developer-guide/config-streams/)
