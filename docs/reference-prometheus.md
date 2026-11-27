# Prometheus の基本アーキテクチャ

## 1. 概要

Prometheus はサーバーがターゲットから HTTP でメトリクスを取得（スクレイプ）し、時系列としてローカルに保存する。保存したデータに PromQL で問い合わせ、ルールで集計や警告を作る。警告は Alertmanager が扱い、可視化は Grafana などの API クライアントが担う。2026 年 11 月時点の公式資料に基づく。

[Prometheus Overview](https://prometheus.io/docs/introduction/overview/)

## 2. 構成要素とデータの流れ

- ターゲットの決定：サービスディスカバリーまたは静的設定。
- メトリクスの供給元：クライアントライブラリで計装したアプリ、Exporter、短命ジョブ向けの Pushgateway。
- Prometheus サーバー：スクレイプと保存を行い、ルールを評価する。
- Alertmanager：サーバーが生成した警告を処理する。
- Grafana など：PromQL で保存データを問い合わせて可視化する。

スクレイプ間隔、サービスディスカバリーの種類ごとの設定は未確認。

[Prometheus Overview](https://prometheus.io/docs/introduction/overview/)

## 3. データモデルとメトリクスの型

データはすべて時系列で、メトリクス名とラベル（キーと値の組）で識別する。ラベルを 1 つでも変える・足す・消すと別の時系列になる。サンプルは float64 値（またはネイティブヒストグラム）とミリ秒精度のタイムスタンプからなる。メトリクスの型は Counter、Gauge、Histogram、Summary の 4 種類。

[Data model](https://prometheus.io/docs/concepts/data_model/)
[Metric types](https://prometheus.io/docs/concepts/metric_types/)

## 4. ローカルストレージ

取り込んだサンプルは 2 時間単位のブロックにまとめる。ブロックは chunks ディレクトリ、メタデータ、インデックスを持ち、バックグラウンドでより大きなブロックに圧縮（コンパクション）される。現在のブロックはメモリ上にあり、WAL（128MB のセグメント）で保護する。保持期間の既定は 15 日で、サイズ上限は既定で無効。公式資料は 1 サンプルあたり平均 1〜2 バイトとしている。内部の索引構造の詳細は別の図（prometheus-tsdb-internals）で扱い、ここでは扱わない。

[Storage](https://prometheus.io/docs/prometheus/latest/storage/)

## 5. リモートストレージ

サンプルを Remote Write 形式で外部へ送れ、Remote Read 形式で読み戻せる。Remote Write 1.0 は安定、2.0 は実験的。Remote Read は安定とはされておらず、取得するのは生の系列だけで、PromQL の評価はローカルで行う。どちらも snappy 圧縮の protocol buffers を HTTP で送る。接続先の具体的な製品は未確認。

[Storage](https://prometheus.io/docs/prometheus/latest/storage/)

## 6. ルールと警告

サーバーはルールを保存データに対して評価し、既存の系列から新しい系列を作る（Recording ルール）か、警告を生成する。警告は Alertmanager に渡る。ルールの評価間隔、Alertmanager の通知先やグルーピングは未確認。

[Prometheus Overview](https://prometheus.io/docs/introduction/overview/)

## 7. 実装例：自前のサーバー構成

| 機能 | 具体的な担い手 |
| --- | --- |
| メトリクスの供給元 | アプリ（クライアントライブラリ）、Exporter、Pushgateway |
| 収集・保存・ルール | Prometheus サーバー（ローカル TSDB） |
| 警告 | Alertmanager |
| 可視化 | Grafana |

代表的な構成であり、導入事例や動作検証済みの構成ではない。台数、冗長化、認証は未確認。
