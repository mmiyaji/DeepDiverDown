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

この例では利用者がアプリホストと監視ホストを別々に管理し、Prometheus、Grafana、Alertmanager、ローカル TSDB とネットワークを運用する。設定、問い合わせと通知先は利用者が操作する。公式資料を組み合わせた未検証例で、OS、永続ディスク、バックアップと通知先は導入時に選定する。

[Prometheus overview](https://prometheus.io/docs/introduction/overview/)、[Grafana and Prometheus](https://prometheus.io/docs/visualization/grafana/)、[Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/)。

## 5. 実装例：EKS・Managed Prometheus・Managed Grafana

EKS の EC2 ノード上で Prometheus 形式のメトリクスを公開するアプリを動かし、Amazon Managed Service for Prometheus（AMP）のマネージドスクレイパーが定期取得する例。AMP ワークスペースのデータを Amazon Managed Grafana から参照し、AMP のルールと Alertmanager で評価した通知を Amazon SNS に送る。

| 機能 | 担い手 |
| --- | --- |
| 監視対象と公開エンドポイント | EKS / EC2 上のアプリ Pod と /metrics |
| 収集 | AMP マネージドスクレイパー |
| 時系列の保存・ルール評価 | AMP ワークスペースとルール、Alertmanager |
| ダッシュボード | Amazon Managed Grafana |
| 通知 | Amazon SNS トピックと購読先 |

EKS 制御プレーンは AWS 管理 VPC にあり、利用者は公開 API・クラスタ設定を操作するが制御プレーンのサーバーへ直接アクセスしない。AWS がマネージドスクレイパーや AMP、Grafana、SNS の基盤を運用し、利用者は設定、権限、データとアラートの内容を管理する。これらを独立サービスとして EKS ノードの外に置く。複数の公式資料を組み合わせた未検証の例で、サービスの対応バージョンとネットワークを導入時に確認する。

スクレイパーは EKS クラスタのプライベート API アクセス、対象の発見設定、サブネットと IAM 権限を構成する。Grafana は AMP をデータソースに追加し、ワークスペースの認証とアクセス権を設定する。Alertmanager の SNS 通知と購読先は別途設定する。図はセルフホストの Prometheus サーバーをそのまま AWS サービスに置き換えたものではなく、管理対象の異なる代替例である。

[EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)、[AMP managed collectors for EKS](https://docs.aws.amazon.com/prometheus/latest/userguide/AMP-collector-how-to.html)、[Amazon Managed Grafana と Prometheus](https://docs.aws.amazon.com/grafana/latest/userguide/amazon-prometheus-data-source.html)、[AMP Alertmanager](https://docs.aws.amazon.com/prometheus/latest/userguide/AMP-alert-manager.html)、[EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)。
