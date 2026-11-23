# Crossplane の Kubernetes API による基盤管理

## 1. 概要

利用者が管理する Kubernetes に Crossplane と AWS provider を導入し、認証設定を用いて AWS の S3 バケットを管理する概念例。provider のバージョン、API、権限および削除ポリシーは採用環境で確認する。

## 2. 仕組みと処理の流れ

- **要求の宣言**: 管理対象とする外部資源の目標状態を宣言する。
- **Kubernetes API**: CRD により資源定義を Kubernetes API に登録する。
- **外部資源の照合**: provider が目標状態と外部資源を照合する。
- **認証と設定**: provider は設定された認証情報を使う。
- **管理対象の資源**: 外部 API によって管理される。

- 要求の宣言 → Kubernetes API: 目標状態を登録。
- Kubernetes API → 外部資源の照合: managed resource を監視。
- 認証と設定 → 外部資源の照合: 認証設定を参照。
- 外部資源の照合 → 管理対象の資源: AWS API で照合・変更。

## 3. 運用上の考慮

利用者が管理する Kubernetes に Crossplane と AWS provider を導入し、認証設定を用いて AWS の S3 バケットを管理する概念例。provider のバージョン、API、権限および削除ポリシーは採用環境で確認する。

## 4. 実装例：Kubernetes の Crossplane と AWS provider

利用者が管理する Kubernetes に Crossplane と AWS provider を導入し、認証設定を用いて AWS の S3 バケットを管理する概念例。provider のバージョン、API、権限および削除ポリシーは採用環境で確認する。

公式資料を組み合わせた説明用構成であり、特定の導入事例や動作検証済み構成を示すものではありません。

| 機能 | 担い手 | 説明 |
| --- | --- | --- |
| 要求の宣言 | S3 Bucket managed resource | 管理対象とする外部資源の目標状態を宣言する。 |
| Kubernetes API | Kubernetes API と CRD | CRD により資源定義を Kubernetes API に登録する。 |
| 外部資源の照合 | AWS provider controller | provider が目標状態と外部資源を照合する。 |
| 認証と設定 | AWS ProviderConfig と認証情報 | provider は設定された認証情報を使う。 |
| 管理対象の資源 | Amazon S3 バケット | 外部 API によって管理される。 |

## 公式資料

- [Crossplane providers](https://docs.crossplane.io/latest/packages/providers/)
- [Managed resources](https://docs.crossplane.io/latest/managed-resources/managed-resources/)
- [Compositions](https://docs.crossplane.io/latest/composition/compositions/)
