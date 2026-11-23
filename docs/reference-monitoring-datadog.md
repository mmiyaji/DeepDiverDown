# Datadog による監視と分析

## 1. 対象
監視対象のホストやアプリケーションで生成されるメトリクス、ログ、トレースを収集し、Datadog に送って調査や通知に利用する例。

## 2. 機能配置と処理
対象で計測したデータをホスト側の収集部品に渡す。収集部品がデータを外部の監視基盤に送る。監視基盤は受信データを分析・表示し、設定した条件で通知する。運用担当者は通知と画面を使って状況を確認する。監視対象と SaaS の責任境界を区別する。

## 3. 設計上の注意
メトリクス、ログ、トレースは収集設定・保持期間・課金条件が異なる。API キーや通信先の保護、機微データの除去、送信量、Agent の停止と遅延を確認する。OTLP 受信は Agent の既定では無効で、ログの OTLP 取り込みには別途有効化が必要。図は指定した収集方法の一例であり、すべての監視データが同じ経路を通るとは限らない。

## 4. 実装例：Datadog Agent と Datadog SaaS
ホストに Datadog Agent を配置し、インフラメトリクスや設定したログを収集する。計装アプリのトレースは有効な APM Agent に送る。Agent の forwarder が Datadog に送信し、SaaS のダッシュボードや Monitor で分析と通知を行う。APM 計装、ログ収集、モニターと通知先は別途設定する。

| 機能 | 担い手 |
|---|---|
| 監視対象と収集 | 計装アプリとホスト側 Datadog Agent |
| 受信・分析 | Datadog SaaS の取り込みと分析画面 |
| 通知 | Datadog Monitor と通知先 |
| 対応 | 運用担当者 |

[Datadog Agent architecture](https://docs.datadoghq.com/agent/architecture/)、[OTLP endpoint](https://docs.datadoghq.com/opentelemetry/setup/otlp_ingest_in_the_agent/)、[Monitors](https://docs.datadoghq.com/monitors/)。


### AWS 上の実行環境

この例では Linux の Amazon EC2 インスタンスで監視対象アプリと Datadog のホスト Agent を実行する。アプリに組み込む APM 計装とホストの Agent は役割が異なり、Datadog SaaS の保存・ダッシュボード・通知はホスト外にある。Agent の導入、キー保護、送信ネットワーク、ログやトレースの有効化・秘匿は利用者が構成する。EC2 自体が SaaS の機能を提供するわけではない。

| 役割 | 実行先 |
| --- | --- |
| 監視対象・ホスト Agent | Amazon EC2 の Linux ホスト |
| 取り込み・保存・画面・通知 | Datadog SaaS |

Datadog は SaaS の基盤を提供し、利用者は管理画面や公開 API でダッシュボード・Monitor・通知設定を操作する。保存基盤の内部構成は図示しない。利用者は EC2 のゲスト OS と Agent、アプリ計装、API キーと送信先を管理する。Agent から Datadog への送信が開始され、通信は SSL を使う。この構成は複数資料を組み合わせた未検証の代表例で、対応バージョン、送信先とネットワーク経路は導入時に確認する。

[Datadog Agent network traffic](https://docs.datadoghq.com/agent/configuration/network/)、[EC2 の責任分担](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security.html)、[Datadog Agent 資料](https://docs.datadoghq.com/agent/architecture/)、[Amazon EC2 instances](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Instances.html)。
