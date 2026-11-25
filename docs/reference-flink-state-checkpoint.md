# Flink：状態バックエンドとチェックポイント

Flink の stable 版ドキュメントを基準に、状態の置き場所、チェックポイントの手順、exactly-once の範囲を追う。前提は「Flink：イベント時刻とウォーターマーク・ウィンドウ」（ウィンドウの状態）。

## 1. 対象と前提

- 対象は、キー付き状態、状態バックエンド、チェックポイントとその保存先、復旧。
- Kubernetes の運用は次の図で扱う。

## 2. キー付き状態とキーグループ

- キー付き状態は、キー付きストリームに分割されて配られる組み込みの key/value ストア。アクセスは現在のイベントのキーに限られる。
- キーグループは、状態を再配分する最小単位で、数は最大並列度に等しい。

## 3. 状態バックエンド

| | HashMapStateBackend | EmbeddedRocksDBStateBackend |
| --- | --- | --- |
| 状態の場所 | JVM ヒープ上のオブジェクト | TaskManager のローカルディスクの RocksDB |
| 形式 | シリアライズなし | シリアライズ済みのバイト列 |
| 上限 | クラスタのメモリ | ディスク（1 キー・値は 2^31 バイトまで） |
| 速度 | 速い | 毎回のシリアライズで遅い |
| 増分チェックポイント | 非対応 | 対応 |

- `state.backend.type` は既定 `hashmap`。`rocksdb`、実験的な `forst` も指定できる。ForSt は SST ファイルを S3 などに置けるが、資料上は実験的で本番向けとは言えない。

## 4. チェックポイントの手順

- バリアが Source で注入され、レコードを追い越さずに流れる。各 Operator は、複数の入力があるとき全入力のバリアがそろうまで待つ（アライメント）。
- 全 Sink がバリアを受けると、チェックポイントが完了する。
- アライメントを省く at-least-once や、unaligned checkpoint（`execution.checkpointing.unaligned.enabled`）もある。unaligned は exactly-once と同時実行 1 が条件。

## 5. 保存先と設定

- チェックポイント保存先は状態バックエンドと別に選ぶ。`execution.checkpointing.dir` を指定するとファイルシステム型（`filesystem`）、なければ JobManager のメモリ型（`jobmanager`）。
- 主な設定：`execution.checkpointing.interval`、`mode`（既定 EXACTLY_ONCE）、`min-pause`（既定 0）、`timeout`（既定 10 分）、`max-concurrent-checkpoints`（既定 1）、`tolerable-failed-checkpoints`（既定 0）、`externalized-checkpoint-retention`（既定は保持なし）、`execution.checkpointing.incremental`。
- tolerable を超えて失敗が続くとジョブがフェイルオーバーする。

## 6. exactly-once の範囲

- 状態の exactly-once は、チェックポイントからの復元と、Source の巻き戻し（例：Kafka の offset）で成り立つ。Source は決められた位置に巻き戻せる必要がある。
- KafkaSource の offset の Kafka への commit は監視用で、復旧には使わない。
- KafkaSink の `DeliveryGuarantee` は NONE（既定）、AT_LEAST_ONCE、EXACTLY_ONCE。EXACTLY_ONCE は Kafka のトランザクションに書いてチェックポイントで確定する。`setTransactionalIdPrefix` が必須で、Kafka のクラスタ内で一意にする。読む側が確定済みだけを読むよう `isolation.level` を設定する。`transaction.timeout.ms` は、最大のチェックポイント時間と再起動時間の和以上にする。
- 外部システムまで含めた保証は、Source と Sink のコネクタに依存する。

## 7. 復旧とセーブポイント

- 最新の完了したチェックポイントを選び、データフローを再配置し、状態を復元し、Source をその位置に戻す。増分の場合は全体スナップショットと以降の増分から再構築する。
- セーブポイントは手動で取り、新しいチェックポイントが完了しても期限切れにならない。プログラムやクラスタの更新に使える。

## 8. シナリオ

JobMaster がバリアを注入する → Operator が全入力のバリアを待って状態を保存先へ書く → 完了後に Sink のトランザクションが確定する → 障害時は最新の完了点から状態と入力位置を戻す。

## 9. 実装例：EKS 上の Flink・RocksDB・S3・MSK

EKS の JobManager Pod と TaskManager Pod が MSK の注文トピックを読み、RocksDB の状態を持ち、チェックポイントを S3 に置き、exactly-once で MSK の集計トピックへ書く。

| 機能 | 担い手 |
| --- | --- |
| チェックポイントの調整 | JobManager Pod |
| キー付き Operator | TaskManager Pods |
| 状態バックエンド | EmbeddedRocksDBStateBackend（ノードのローカルディスク） |
| チェックポイント保存先 | S3 のディレクトリ（`execution.checkpointing.dir`） |
| Source・Sink | MSK の 2 つのトピック |

加わる部品は EKS の Kubernetes API と、Pod に S3・MSK のアクセスを付与する IAM ロール。AWS が EKS・S3・MSK の基盤を運用し、利用者が Flink の設定・ジョブ・権限を管理する。S3 のために必要な Flink のファイルシステム設定、ディスクの種別、権限の中身、バージョン互換性は未確認。実動作は未検証。

## 公式資料

- [Flink · Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)
- [Flink · State Backends](https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/state/state_backends/)
- [Flink · Checkpointing](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/fault-tolerance/checkpointing/)
- [Flink · Kafka connector](https://nightlies.apache.org/flink/flink-docs-stable/docs/connectors/datastream/kafka/)
- [Flink · Parallel Execution](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/execution/parallel/)
- [Flink · Kubernetes HA Services](https://nightlies.apache.org/flink/flink-docs-stable/docs/deployment/ha/kubernetes_ha/)
- [Flink · Native Kubernetes](https://nightlies.apache.org/flink/flink-docs-stable/docs/deployment/resource-providers/native_kubernetes/)
- [IAM roles for service accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
