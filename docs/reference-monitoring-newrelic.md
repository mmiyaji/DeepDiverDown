# New Relic による監視と分析

## 1. 対象
アプリケーションとインフラのテレメトリを New Relic に送信し、クエリ、可視化とアラートに利用する例。

## 2. 機能配置と処理
アプリケーションとホストの監視データを、適切な計装やエージェントから監視基盤へ送る。受信したデータを検索・分析し、通知条件を満たしたときに運用担当者に知らせる。ホスト内のエージェントと外部 SaaS は分けて扱う。

## 3. 設計上の注意
インフラエージェントと APM 計装は異なり、それぞれ導入と設定が必要。クラウド連携や OTLP などは別経路を取り得る。NRDB の保存期間や取り込み上限、属性、サンプリング、ログに含まれる機微情報、ライセンスキーの管理を確認する。通知条件を作るだけでは運用対応が自動完了するわけではない。

## 4. 実装例：New Relic Agents と SaaS
ホストの Infrastructure Agent がインフラ情報と設定したログを収集する。アプリの APM Agent はアプリ内で動作し、アプリケーションの性能データを New Relic に送る。SaaS の NRDB の対象データを NRQL で検索し、ダッシュボードとアラート条件に利用する。取り込み方式と信号により保存・取得の詳細は異なる。

| 機能 | 担い手 |
|---|---|
| アプリの性能 | アプリ内 New Relic APM Agent |
| ホスト・ログ | ホスト内 Infrastructure Agent |
| 保存と検索 | New Relic SaaS の NRDB と NRQL |
| 通知と調査 | New Relic Alerts、ダッシュボードと運用担当者 |

[Infrastructure monitoring](https://docs.newrelic.com/docs/infrastructure/introduction-infra-monitoring/)、[Infrastructure agent behavior](https://docs.newrelic.com/docs/infrastructure/infrastructure-agent/manage-your-agent/agent-behavior/)、[NRDB](https://docs.newrelic.com/docs/data-apis/get-started/nrdb-horsepower-under-hood/)、[データ上限](https://docs.newrelic.com/docs/data-apis/manage-data/view-system-limits/)。


### AWS 上の実行環境

この例では Linux の Amazon EC2 インスタンスで監視対象アプリと New Relic のホスト Agent を実行する。アプリに組み込む APM 計装とホストの Agent は役割が異なり、New Relic SaaS の保存・ダッシュボード・通知はホスト外にある。Agent の導入、キー保護、送信ネットワーク、ログやトレースの有効化・秘匿は利用者が構成する。EC2 自体が SaaS の機能を提供するわけではない。

| 役割 | 実行先 |
| --- | --- |
| 監視対象・ホスト Agent | Amazon EC2 の Linux ホスト |
| 取り込み・保存・画面・通知 | New Relic SaaS |

New Relic は SaaS の基盤を提供し、利用者は公開された画面や API でクエリ、ダッシュボードとアラートを設定する。NRDB の内部構成は図示しない。利用者は EC2 のゲスト OS、Infrastructure Agent とアプリ内 APM Agent、認証情報、収集対象を管理する。Infrastructure Agent と APM Agent はそれぞれ New Relic に送信する。この構成は複数資料を組み合わせた未検証の代表例で、エージェントの対応バージョンとネットワーク経路は導入時に確認する。

[Infrastructure agent behavior](https://docs.newrelic.com/docs/infrastructure/infrastructure-agent/manage-your-agent/agent-behavior/)、[EC2 の責任分担](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security.html)、[New Relic Agent 資料](https://docs.newrelic.com/docs/infrastructure/infrastructure-agent/linux-installation/package-manager-install/)、[Amazon EC2 instances](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Instances.html)。
