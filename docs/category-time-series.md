# 時系列データの違い

| 観点 | TimescaleDB | Prometheus | InfluxDB 3 | QuestDB | VictoriaMetrics | Amazon Timestream |
| --- | --- | --- | --- | --- | --- | --- |
| 特徴 | **PostgreSQL 拡張**。hypertable と chunk で時間分割 | **スクレイプ型** のメトリクス収集と警告 | **Arrow・Parquet** 基盤。Python のプロセシングエンジン内蔵 | **WAL + 列ファイル** に時系列向け SQL 拡張 | **PromQL 互換** の MetricsQL。単一ノードとクラスタ | **サーバーレス** の AWS 時系列 DB（LiveAnalytics） |
| データの置き場所 | Linux ホストの **ローカルディスク**（PostgreSQL） | ローカルの **TSDB**（2 時間ブロック + WAL） | **オブジェクトストア**（Parquet）。ディスクレス | ローカルのテーブル列ファイル。過去分は Parquet | `-storageDataPath`（単一）、**vmstorage**（クラスタ） | **メモリストアとマグネティックストア**（AWS 管理） |
| 書き込み（取り込み）の経路 | クライアントが **SQL** で書く。行は該当 chunk へ | ターゲットを **スクレイプ**。短命ジョブは Pushgateway | CLI・HTTP API・**Telegraf**・クライアントライブラリ | **ILP**・PGWire・REST `/imp`・クライアントライブラリ | **remote write**・InfluxDB・Graphite・OpenTelemetry など多数 | **WriteRecords API**。Lambda・IoT Core・Kinesis・Telegraf など |
| クエリ言語 | **SQL**（PostgreSQL） | **PromQL** | **SQL・InfluxQL**（Flux は未確認） | **SQL**（SAMPLE BY・LATEST ON・ASOF JOIN） | **MetricsQL**（Prometheus の問い合わせ API 互換） | **SQL**（時系列関数・ウィンドウ関数） |
| 保持と階層化 | ポリシーで **rowstore → columnstore**。別ストレージへの移動ではない | 既定 **15 日**。サイズ上限は既定で無効。長期保存は remote write 先 | WAL 1 秒、Parquet 化 10 分（既定例）。長期はオブジェクトストア | WAL → ローカル → **Parquet**（層 3）。S3 などへの移動は Enterprise | `-retentionPeriod`、既定 **31 日**（最小 24 時間） | テーブルごとに **メモリ 1 時間〜、マグネティック 1 日〜**。経過後は自動で移動・削除 |
| スケールの方法 | 単一ホストの例が中心。複数ノード構成は未確認 | **単一ノード**。複製・長期保持は別設計 | Enterprise は **ノードの役割分け**（ingest・query・compact）。Core は単一プロセス | 単一ノード。Enterprise のレプリケーションは未確認 | クラスタ版は **vminsert・vmstorage・vmselect** を分けて増やす | **サーバーレス**。容量のプロビジョニングは不要 |
| 得意な用途 | **PostgreSQL の SQL と表** のまま時系列を扱う | **メトリクス監視** と警告（Alertmanager） | 直近データの監視・収集。Enterprise で履歴分析 | **集計と時刻結合** を SQL で書く。遅れて届く行も反映 | Prometheus の **長期保存と大量取り込み** | AWS 内の IoT・アプリの **時系列を SQL で分析** |
| 注意点 | 継続集計の **real-time aggregate は 2.13 以降で既定無効**。冗長化は別途 | 保存は単一ノードのみ。Remote Read は **安定とはされていない** | Core と Enterprise の **機能差は一部未確認**。タグ列の定義は後から変えられない | 既定の `nosync` では停電で確定済みの書き込みを失うことがある。実装例は **未作成** | クラスタ版の Graphite・OpenTSDB telnet 経路は **未確認** | **LiveAnalytics は 2025 年 6 月 20 日に新規顧客の受け付けを終了**。終了日は未確認 |

提供段階と制限は 2026 年 11 月時点の公式資料に基づきます。確認できなかった点は「未確認」と書いています。

## 選び方

- 既存の PostgreSQL に時系列を足し、SQL と結合をそのまま使う → **TimescaleDB**
- アプリや Exporter のメトリクスを集め、警告まで 1 つで済ませる → **Prometheus**
- Telegraf で書き込み、Parquet をオブジェクトストアに置く → **InfluxDB 3**
- 時刻で突き合わせる結合や等間隔の集計を SQL で書く → **QuestDB**
- Prometheus の remote write を受け、保持を長くする → **VictoriaMetrics**
- 既に Timestream for LiveAnalytics を使っている AWS の既存顧客 → **Amazon Timestream**（新規顧客は受け付け終了。AWS は Timestream for InfluxDB を案内）

## 公式資料

- [TimescaleDB Hypertables](https://www.tigerdata.com/docs/learn/hypertables/understand-hypertables)
- [TimescaleDB Hypercore](https://www.tigerdata.com/docs/learn/columnar-storage/understand-hypercore)
- [TimescaleDB Continuous aggregates](https://www.tigerdata.com/docs/learn/continuous-aggregates)
- [Prometheus Overview](https://prometheus.io/docs/introduction/overview/)
- [Prometheus Storage](https://prometheus.io/docs/prometheus/latest/storage/)
- [InfluxDB 3 Core and Enterprise architecture](https://www.influxdata.com/blog/influxdb3-core-enterprise-architecture)
- [InfluxDB 3 Core durability](https://docs.influxdata.com/influxdb3/core/reference/internals/durability/)
- [QuestDB Storage engine](https://questdb.com/docs/architecture/storage-engine/)
- [QuestDB Write-Ahead Log](https://questdb.com/docs/concept/write-ahead-log/)
- [VictoriaMetrics Single-node](https://docs.victoriametrics.com/victoriametrics/single-server-victoriametrics/)
- [VictoriaMetrics Cluster version](https://docs.victoriametrics.com/victoriametrics/cluster-victoriametrics/)
- [Amazon Timestream for LiveAnalytics availability change](https://docs.aws.amazon.com/timestream/latest/developerguide/AmazonTimestreamForLiveAnalytics-availability-change.html)
- [Amazon Timestream Storage](https://docs.aws.amazon.com/timestream/latest/developerguide/storage.html)
