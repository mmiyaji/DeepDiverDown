# Prometheus と Grafana によるメトリクス監視

## 1. 対象
監視対象のメトリクスを Prometheus が収集・蓄積し、Grafana の可視化と Alertmanager の通知を使う例。

## 2. 機能配置と処理
監視対象または exporter がメトリクスの HTTP エンドポイントを公開する。Prometheus が定期的に取得し時系列データとして保存する。クエリと記録・アラートルールを評価し、アラートを通知部品に送る。運用担当者はダッシュボードと通知を確認する。

## 3. 設計上の注意
Prometheus は主に数値の時系列メトリクスを扱い、ログや分散トレースの統合保存を単独で担う図ではない。プル方式では対象までのネットワークと発見が必要。ラベル数、保存期間、欠損、アラートの閾値、通知経路、可用性と運用責任を設計する。Grafana や Alertmanager は別の部品である。

## 4. 実装例：Prometheus・Grafana・Alertmanager
計装済みアプリまたは exporter のエンドポイントを Prometheus が scrape してローカル時系列ストレージに保存する。Grafana は Prometheus データソースを問い合わせる。Prometheus のルールで発生したアラートを Alertmanager に送り、グループ化・配送する。構成の配置場所は利用者が選ぶ。

| 機能 | 担い手 |
|---|---|
| メトリクスの公開 | アプリの計装または exporter |
| 取得・保存・ルール | Prometheus |
| 可視化 | Grafana |
| 通知 | Alertmanager と通知先 |

[Prometheus overview](https://prometheus.io/docs/introduction/overview/)、[Grafana and Prometheus](https://prometheus.io/docs/visualization/grafana/)、[Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/)。
