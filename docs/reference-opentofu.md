# OpenTofu の IaC と状態暗号化

## 1. 概要

事前作成した S3 backend を使い、OpenTofu の state 暗号化を設定した例。暗号化は明示的な設定が必要で、鍵の管理と既存 state の移行を検討する。Terraform との互換性はバージョンや機能ごとに確認する。

## 2. 仕組みと処理の流れ

- **構成定義**: 宣言したリソースと依存関係。
- **計画と適用**: plan と apply を実行時に処理する。
- **状態と暗号化**: 設定により state と plan を暗号化できる。鍵の保管と復旧が必要。
- **リソース操作**: provider が外部 API を呼ぶ。
- **管理対象**: API により作成・更新される。

- 構成定義 → 計画と適用: 構成を読む。
- 状態と暗号化 → 計画と適用: 状態を読み復号。
- 計画と適用 → リソース操作: 変更を依頼。
- リソース操作 → 管理対象: API で作成・更新。
- 計画と適用 → 状態と暗号化: 状態を暗号化して保存。

## 3. 運用上の考慮

事前作成した S3 backend を使い、OpenTofu の state 暗号化を設定した例。暗号化は明示的な設定が必要で、鍵の管理と既存 state の移行を検討する。Terraform との互換性はバージョンや機能ごとに確認する。

## 4. 実装例：Linux の OpenTofu と AWS

事前作成した S3 backend を使い、OpenTofu の state 暗号化を設定した例。暗号化は明示的な設定が必要で、鍵の管理と既存 state の移行を検討する。Terraform との互換性はバージョンや機能ごとに確認する。

公式資料を組み合わせた説明用構成であり、特定の導入事例や動作検証済み構成を示すものではありません。

| 機能 | 担い手 | 説明 |
| --- | --- | --- |
| 構成定義 | Linux 上の OpenTofu 構成 | 宣言したリソースと依存関係。 |
| 計画と適用 | Linux 上の tofu CLI | plan と apply を実行時に処理する。 |
| 状態と暗号化 | Amazon S3 の暗号化 state | 設定により state と plan を暗号化できる。鍵の保管と復旧が必要。 |
| リソース操作 | AWS provider プラグイン | provider が外部 API を呼ぶ。 |
| 管理対象 | AWS の EC2 インスタンス | API により作成・更新される。 |

## 公式資料

- [OpenTofu state encryption](https://opentofu.org/docs/language/state/encryption/)
- [OpenTofu state](https://opentofu.org/docs/language/state/)
- [OpenTofu S3 backend](https://opentofu.org/docs/language/settings/backends/s3/)
