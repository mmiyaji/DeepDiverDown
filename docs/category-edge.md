# エッジコンピューティングの違い

ここでは端末の更新配布を比べる

| 観点 | Eclipse hawkBit | Mender |
| --- | --- | --- |
| 特徴 | **端末向けソフトウェア更新の配布管理**。運用者が成果物とロールアウトを管理し、端末は DDI API をポーリングして取得する | **デバイス認証、A/B パーティション更新、自動ロールバック**を備えた OTA 更新のサーバーとクライアント |
| データモデル・実行モデル | 成果物・ロールアウト・配備状態を扱う。pull 型。端末・配備メタデータは PostgreSQL、成果物は artifactrepo ボリュームに置く | 成果物（Mender Artifact）をデプロイ単位でデバイスへ割り当て、デバイスが定期的に問い合わせる pull 型 |
| 一貫性・耐久性の仕組み | SWUpdate/Suricatta などの端末側 updater と組み合わせる | 非アクティブ側のパーティションへ書き込み、起動成功で確定し、失敗でロールバックする |
| 拡張のしかた | 管理 UI と Management API、DMF（AMQP）を使う | Update Module でアプリ・コンテナを更新する。Enterprise ではオーケストレーションを使う（詳細は **未確認**） |
| 運用の形態 | 自前運用。例は Docker Compose で hawkBit、PostgreSQL、RabbitMQ、UI を動かす構成 | 自前サーバーまたは Hosted Mender |
| 得意な用途 | 組み込み Linux などへの更新配布とロールアウト管理 | Linux 系の組み込み・車載の OS 全体更新 |
| 注意点 | 端末側の署名検証・適用・ロールバックは別途実装する。車載 OTA の安全認証にはならない | サーバー構成とサーバーのライセンスは **未確認**。全体イメージの更新は再起動が必要 |
| ライセンス | 未確認（docs に記載なし） | クライアントは Apache 2.0。サーバーは **未確認**。Enterprise 機能は有償 |

内容は 2026 年 11 月時点の公式資料に基づく。確認できなかった点は「未確認」と書く。

## 選び方

- ロールアウト管理を自前で運用し、端末側の updater は自分で選ぶ → **Eclipse hawkBit**
- 管理 UI・Management API・AMQP で既存の運用基盤とつなぐ → **Eclipse hawkBit**
- A/B パーティションと自動ロールバックまでまとめて使う → **Mender**
- 組み込み・車載 Linux の OS 全体を更新する → **Mender**
- アプリやコンテナだけを Update Module で更新する → **Mender**

## 公式資料

- [Eclipse hawkBit](https://hawkbit.eclipse.dev/)
- [Device integration API](https://hawkbit.eclipse.dev/concepts/device-integration/)
- [Mender overview](https://docs.mender.io/overview/introduction)
- [mendersoftware/mender](https://github.com/mendersoftware/mender)
