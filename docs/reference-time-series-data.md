# 時系列データの保存・分析と階層化

## 1. 時系列データ
観測時刻、値、測定対象を識別する属性を結びつける。観測時刻と受信時刻、タイムゾーン、精度、遅延到着、欠測、重複と順序は区別する。系列の識別方法や重複書き込み時の挙動は製品ごとに異なる。

## 2. 時間範囲と集計
時刻でデータを区切り、対象期間と系列属性で絞って読み、時間幅ごとに集計する。保持期間や集計粒度を決めると、元の高精度値が残らない可能性がある。カウンターとゲージ、リセット、欠測、遅延データ、集計の境界と再計算を用途ごとに確認する。

## 3. Hot / Warm / Cold と保持
Hot は最近の高頻度読み書き、Warm は過去データの比較的低頻度の照会、Cold は長期保管を想定する設計上の区分であり、製品共通の実装ではない。各層の保存先、移動条件、圧縮、読み出し時間、料金、保持期限、削除・復元を個別に定義する。生データと集計結果の保持期間を分ける場合、遅延到着時の再集計範囲も整合させる。オブジェクトストレージへの自動移動や即時クエリを前提にしない。

## 4. 実装例と対応
以下は公式資料を組み合わせた代表構成で、各環境での接続・可用性は未検証。

| 役割 | TimescaleDB | InfluxDB 3 Core | Prometheus |
|---|---|---|---|
| 取り込み | SQL INSERT | line protocol | 対象を scrape |
| 保持 | hypertable の時間別 chunk | テーブルの tag / field / time | ローカル TSDB、WAL とブロック |
| 読み出し | SQL と continuous aggregate | SQL | PromQL |
| 運用境界 | 利用者管理の PostgreSQL | 利用者管理の Core | 単一ノードのローカル TSDB |

TimescaleDB の continuous aggregate は更新設定を確認し、2.13 以降の real-time aggregate は既定で無効。InfluxDB 3 Core のタグ値カーディナリティの扱いを旧 1.x / 2.x の TSM ベース製品と混同しない。Prometheus のメトリクス名とラベルの組合せが系列を識別する。ローカル保存自体にクラスタ複製はなく、remote write は外部ストレージとの連携であり、保管と冗長性は連携先に依存する。

## 5. 参考資料

- [Timescale hypertables](https://www.tigerdata.com/docs/learn/hypertables/understand-hypertables)
- [Timescale continuous aggregates](https://www.tigerdata.com/docs/learn/continuous-aggregates)
- [InfluxDB 3 Core schema](https://docs.influxdata.com/influxdb3/core/write-data/best-practices/schema-design/)
- [InfluxDB 3 line protocol](https://docs.influxdata.com/influxdb3/core/reference/line-protocol/)
- [Prometheus data model](https://prometheus.io/docs/concepts/data_model/)
- [Prometheus local storage](https://prometheus.io/docs/prometheus/latest/storage/)
