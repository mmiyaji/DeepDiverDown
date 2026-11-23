# Pulumi のプログラムからの IaC

## 1. 概要

Linux 上の Node.js と Pulumi CLI から AWS provider を使用し EC2 を管理する例。state は Pulumi Cloud に保存する選択で、AWS の外側にある。継続的ドリフト検知は別のサービスや設定に依存する。

## 2. 仕組みと処理の流れ

- **構成プログラム**: 言語 SDK を使ってリソースを登録する。
- **実行と差分計算**: language host と engine が宣言された依存と差分を処理する。
- **状態バックエンド**: stack ごとの状態を保持し、別の backend も選択可能。
- **リソース操作**: provider プロセスが外部 API を呼ぶ。
- **管理対象**: プロバイダー経由で管理される。

- 構成プログラム → 実行と差分計算: リソースを登録。
- 状態バックエンド → 実行と差分計算: stack state を読む。
- 実行と差分計算 → リソース操作: 差分の操作を依頼。
- リソース操作 → 管理対象: AWS API で作成・更新。
- 実行と差分計算 → 状態バックエンド: stack state を保存。

## 3. 運用上の考慮

Linux 上の Node.js と Pulumi CLI から AWS provider を使用し EC2 を管理する例。state は Pulumi Cloud に保存する選択で、AWS の外側にある。継続的ドリフト検知は別のサービスや設定に依存する。

## 4. 実装例：Node.js の Pulumi と AWS

Linux 上の Node.js と Pulumi CLI から AWS provider を使用し EC2 を管理する例。state は Pulumi Cloud に保存する選択で、AWS の外側にある。継続的ドリフト検知は別のサービスや設定に依存する。

公式資料を組み合わせた説明用構成であり、特定の導入事例や動作検証済み構成を示すものではありません。

| 機能 | 担い手 | 説明 |
| --- | --- | --- |
| 構成プログラム | TypeScript プログラムと Node.js | 言語 SDK を使ってリソースを登録する。 |
| 実行と差分計算 | Linux 上の Pulumi CLI と engine | language host と engine が宣言された依存と差分を処理する。 |
| 状態バックエンド | Pulumi Cloud の stack state | stack ごとの状態を保持し、別の backend も選択可能。 |
| リソース操作 | Pulumi AWS provider | provider プロセスが外部 API を呼ぶ。 |
| 管理対象 | AWS の EC2 インスタンス | プロバイダー経由で管理される。 |

## 公式資料

- [How Pulumi works](https://www.pulumi.com/docs/iac/guides/basics/how-pulumi-works/)
- [Providers](https://www.pulumi.com/docs/iac/concepts/providers/)
- [State and backends](https://www.pulumi.com/docs/iac/concepts/state-and-backends/)
