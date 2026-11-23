# Apache Kafka Streams の基本アーキテクチャ

## 1. 読み方と範囲

Kafka Topic の受注イベントをアプリケーション内の Kafka Streams トポロジーで集計し、状態ストアと changelog から復元する例を示す。

出典 [Kafka Streams Architecture](https://kafka.apache.org/44/streams/architecture/)

## 2. Topic パーティションと Task

入力 Topic のパーティションは処理の並列単位となり、Kafka Streams はそれらに基づき固定数の Task を作る。Task は割り当てられたパーティションのレコードを処理する。

出典 [Kafka Streams Architecture](https://kafka.apache.org/44/streams/architecture/)

## 3. Processor Topology

アプリケーションは Source、変換、集計などのプロセッサをトポロジーとして構成する。各 Task は自身のトポロジーを持ち、レコードを順に処理する。

出典 [Kafka Streams Architecture](https://kafka.apache.org/44/streams/architecture/)

## 4. Local State Store

join、aggregate、window などの状態付き処理では、Task にローカル状態ストアが作られる。ストアは処理に必要な集計値を保持し、照会もできる。

出典 [Kafka Streams Architecture](https://kafka.apache.org/44/streams/architecture/)

## 5. Changelog と復元

状態ストアの更新は複製された changelog Topic に記録される。Task が別インスタンスへ移ると、changelog を再生して状態を復元してから処理を再開する。

出典 [Kafka Streams Architecture](https://kafka.apache.org/44/streams/architecture/)

## 6. スケールと障害

アプリケーションのインスタンスやスレッドを増やすと、Topic パーティションを別 Task が処理する。インスタンス障害時は割り当てられた Task が別インスタンスで再起動される。

出典 [Kafka Streams Architecture](https://kafka.apache.org/44/streams/architecture/)

## 7. シナリオ

「Topic から集計・状態復元」シナリオをクリックすると、Task、トポロジー、状態ストア、changelog、復旧を追える。

## 8. 実装例：Kafka Streams JVM と RocksDB

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

## 9. 実装例：Amazon ECS on Fargate と Amazon MSK

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
