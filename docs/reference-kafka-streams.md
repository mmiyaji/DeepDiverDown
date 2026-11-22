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
