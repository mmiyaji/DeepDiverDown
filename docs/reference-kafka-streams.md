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
