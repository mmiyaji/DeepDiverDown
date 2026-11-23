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
