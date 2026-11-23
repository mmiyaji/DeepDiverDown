# Terraform の構成計画と適用

## 1. 概要

S3 バケットは事前作成し、S3 backend の use_lockfile を有効化する例。Terraform はコマンド実行時に処理し、単独では常時照合しない。state は機密情報を含み得るため権限と保護が必要。

## 2. 仕組みと処理の流れ

- **HCL 構成**: 宣言したリソースと依存関係。
- **計画と適用**: plan は通常リモートを読み、構成と state を比較し、apply で変更する。
- **状態の保存**: リソース対応を保持し、対応 backend でロックできる。
- **リソース操作**: provider が外部 API を呼ぶ。
- **管理対象**: API により作成・更新される。

- HCL 構成 → 計画と適用: 構成を読む。
- 状態の保存 → 計画と適用: 状態を読む。
- 計画と適用 → リソース操作: 変更を依頼。
- リソース操作 → 管理対象: API で作成・更新。
- 計画と適用 → 状態の保存: 状態を保存。

## 3. 運用上の考慮

S3 バケットは事前作成し、S3 backend の use_lockfile を有効化する例。Terraform はコマンド実行時に処理し、単独では常時照合しない。state は機密情報を含み得るため権限と保護が必要。

## 4. 実装例：Linux の Terraform CLI と AWS

S3 バケットは事前作成し、S3 backend の use_lockfile を有効化する例。Terraform はコマンド実行時に処理し、単独では常時照合しない。state は機密情報を含み得るため権限と保護が必要。

公式資料を組み合わせた説明用構成であり、特定の導入事例や動作検証済み構成を示すものではありません。

| 機能 | 担い手 | 説明 |
| --- | --- | --- |
| HCL 構成 | Linux 上の .tf ファイル | 宣言したリソースと依存関係。 |
| 計画と適用 | Linux 上の Terraform CLI | plan は通常リモートを読み、構成と state を比較し、apply で変更する。 |
| 状態の保存 | Amazon S3 state とロックファイル | リソース対応を保持し、対応 backend でロックできる。 |
| リソース操作 | AWS provider プラグイン | provider が外部 API を呼ぶ。 |
| 管理対象 | AWS の EC2 インスタンス | API により作成・更新される。 |

## 公式資料

- [Terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan)
- [State](https://developer.hashicorp.com/terraform/language/state)
- [S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3)
