# VictoriaMetrics の基本アーキテクチャ

## 1. 概要

VictoriaMetrics は時系列データを保存し、PromQL 互換の MetricsQL で問い合わせる OSS のデータベースである。単一ノード版（1 つの実行ファイル）とクラスタ版がある。2026 年 11 月時点の公式資料に基づく。

[Single-node VictoriaMetrics](https://docs.victoriametrics.com/victoriametrics/single-server-victoriametrics/)

## 2. 単一ノード版

実行ファイル 1 つで取り込みと問い合わせを行い、外部依存はない。データは `-storageDataPath` のディレクトリに置く。既定のポートは 8428。保持期間は `-retentionPeriod` で指定し、既定は 1 か月（31 日）、最小は 24 時間。Prometheus の問い合わせ API（`/api/v1/query`、`/api/v1/query_range` など）と Web UI（`/vmui`）を同じポートで提供する。スナップショットは `/snapshot/create`、バックアップは vmbackup と vmrestore で取る。

## 3. クラスタ版の構成

| コンポーネント | 役割 | ポート |
| --- | --- | --- |
| vminsert | 取り込みを受け、メトリック名とラベル全体の一貫性ハッシュで vmstorage に振り分ける | HTTP 8480 |
| vmstorage | 生データを保存し、時間範囲とラベル条件に合うデータを返す | HTTP 8482、vminsert からの受信 8400、vmselect 用 RPC 8401 |
| vmselect | 全 vmstorage からデータを集めて問い合わせに答える | HTTP 8481 |

vmstorage 同士は互いを知らず、通信もデータ共有もしない（shared-nothing）。vminsert や vmselect を複数台にするときは、vmauth や nginx などの HTTP ロードバランサーを前に置き、`/insert` を 8480、`/select` を 8481 に振り分ける。

[Cluster version](https://docs.victoriametrics.com/victoriametrics/cluster-victoriametrics/)

## 4. テナントとレプリケーション

クラスタ版の書き込み URL は `http://<vminsert>:8480/insert/<accountID>/<suffix>`、読み出し URL は `http://<vmselect>:8481/select/<accountID>/prometheus/<suffix>`。`accountID` と `projectID` は 32 ビット整数で、`projectID` の既定は 0。vminsert の `-replicationFactor=N` で、各サンプルを N 台の別の vmstorage に保存する。N-1 台までの停止ならデータを引ける。必要な vmstorage は 2N-1 台以上。レプリケーションを使うときは vmselect に `-dedup.minScrapeInterval=1ms` が必要。マルチ AZ では、AZ ごとに独立したクラスタを置き、前段に vmagent を置く構成が案内されている。

## 5. 取り込み互換

単一ノード版は次を受け付ける。Prometheus の remote write と Prometheus 形式のスクレイプ、InfluxDB 行プロトコル（HTTP・TCP・UDP）、Graphite、OpenTSDB（telnet と `/api/put`）、DataDog、NewRelic、OpenTelemetry、Zabbix Connector、JSON 行（`/api/v1/import`）、CSV、ネイティブ形式。remote write の宛先は単一ノード版が `http://<addr>:8428/api/v1/write`、クラスタ版が `http://<vminsert>:8480/insert/<tenant>/prometheus`。クラスタ版の vminsert が受ける形式は、Prometheus remote write、JSON 行、ネイティブ、CSV、Prometheus テキスト、OpenTelemetry、Datadog、InfluxDB、NewRelic、OpenTSDB HTTP。クラスタ版の Graphite と OpenTSDB telnet の経路は、取得範囲で個別に確認できず未確認。

[Prometheus integration](https://docs.victoriametrics.com/victoriametrics/integrations/prometheus/)

## 6. 単一ノード版とクラスタ版の選び方

クラスタ版は単一ノード版の機能をすべて持つとされる。公式資料は、1 秒あたり 100 万データポイント未満の取り込みなら、設定と運用が簡単な単一ノード版を勧めている。クラスタ版では小さな vmstorage を多く並べるほうがよいとされる。単一ノード版の「Scalability and cluster version」節の具体的な基準は未確認。

## 7. 実装例：自前のクラスタ構成

| 機能 | 具体的な担い手 |
| --- | --- |
| 取り込み元 | Prometheus（remote write）、vmagent |
| 取り込み・問い合わせの入口 | vmauth |
| 取り込み | vminsert |
| 保存 | vmstorage（複数台） |
| 問い合わせ | vmselect |
| 利用者 | Grafana など |

代表的な構成であり、導入事例や動作検証済みの構成ではない。vmagent と vmauth の設定、台数、認証は未確認。Grafana からの接続設定は今回の取得範囲になく未確認。
