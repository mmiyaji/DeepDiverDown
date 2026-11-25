# Flink：イベント時刻とウォーターマーク・ウィンドウ

Flink の stable 版ドキュメントを基準に、イベント時刻で窓が確定する仕組みを追う。前提は「Flink：ジョブグラフ・Task とスロット」。

## 1. 対象と前提

- 対象は DataStream API の時刻・Watermark・窓。SQL の窓関数は扱わない。
- 状態の保存と復旧は次の図で扱う。

## 2. イベント時刻と処理時刻

- 処理時刻は、Operator を動かすマシンの時計。遅延が小さく速いが、到着の速さや障害に結果が左右される。
- イベント時刻は、イベントが発生した時刻でレコードに入っている。データだけで進むので、順序が乱れても遅れても、全データが届けば結果が一定になる。

## 3. Watermark の生成と進み方

- Watermark(t) は「イベント時刻が t まで進み、t 以下のイベントはもう来ないはず」という印。データと一緒に流れ、受けた Operator が時刻を進める。
- Source は並列の Subtask ごとに、通常は独立して生成する。複数の入力を持つ Operator（union や keyBy の後）は、入力の最小の時刻で進む。
- `WatermarkStrategy` はタイムスタンプ抽出と Watermark 生成を組にする。`forBoundedOutOfOrderness(Duration)` は乱れの上限を指定する。`withIdleness(Duration)` は一定時間イベントがない入力を遅れの判定から外す。Kafka の Source に渡すと、パーティションごとに生成して統合する。
- `withWatermarkAlignment` は、同じグループの Source が先に進みすぎるのを防ぐ（FLIP-27 の Source のみ）。

## 4. 窓の割り当て

- Tumbling（固定長・重ならない）、Sliding（長さとずらし幅）、Session（活動の間隔）、Global（キーごとに 1 つ。専用の Trigger が必要）。
- 窓の関数：ReduceFunction・AggregateFunction は増分で集計する。ProcessWindowFunction は全要素を保持し、窓のメタデータを使える。
- 窓の状態は窓ごとのキー付き状態で、最初の要素で作られ、終端と許容遅延を過ぎると消える。

## 5. Trigger と窓の確定

- イベント時刻の窓の既定は `EventTimeTrigger`。Watermark が窓の終端（最大タイムスタンプ）を越えると、その窓を計算し、結果を出す。Watermark はそのまま下流へ流れる。
- `trigger()` で既定を置き換えられる。`TriggerResult` は CONTINUE・FIRE・PURGE・FIRE_AND_PURGE。

## 6. 遅延データ

- 遅延データは、Watermark がそのタイムスタンプを過ぎた後に届く。許容遅延（`allowedLateness`）の既定は 0 で、遅れた要素は捨てられる。
- 許容遅延の期間内に届くと、窓に足され、`EventTimeTrigger` では再度の出力（遅延発火）になる。
- `sideOutputLateData(OutputTag)` で遅延データを別ストリームに回せる。

## 7. シナリオ

時刻付きのイベントが Source から Watermark と一緒に流れる → 窓の状態を更新する → Watermark が窓の終端を越えて確定し、結果を出す → 許容遅延を過ぎたデータは side output に回る。

## 8. 実装例：Amazon Managed Service for Apache Flink と MSK

MSK の注文トピックを、Managed Service for Apache Flink のジョブがイベント時刻の窓で集計し、別のトピックへ書く。

| 機能 | 担い手 |
| --- | --- |
| Source | MSK 注文トピック |
| WatermarkStrategy・窓・状態・Trigger・遅延データ | Managed Service for Apache Flink アプリケーション（1 つのジョブ） |
| Sink | MSK 集計トピック |

`Parallelism`（既定 1、最大 256）と `ParallelismPerKPU`（既定 1、最大 8）で KPU が決まる。`maxParallelism` を変えると、以前のスナップショットから再開できない（公式資料）。並列度が 128 を超える場合は、`maxParallelism` を明示する。状態バックエンドの選択可否は未確認。AWS が実行基盤を運用し、利用者がコードと設定を管理する。実動作は未検証。

## 公式資料

- [Flink · Timely Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/)
- [Flink · Generating Watermarks](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/event-time/generating_watermarks/)
- [Flink · Windows](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/operators/windows/)
- [Flink · Kafka connector](https://nightlies.apache.org/flink/flink-docs-stable/docs/connectors/datastream/kafka/)
- [Managed Service for Apache Flink · How it works](https://docs.aws.amazon.com/managed-flink/latest/java/how-it-works.html)
- [Managed Service for Apache Flink · Application scaling](https://docs.aws.amazon.com/managed-flink/latest/java/how-scaling.html)
