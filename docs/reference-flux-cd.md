# Flux CD の GitOps と継続的な照合

## 1. 概要

利用者が管理する Kubernetes に source-controller と kustomize-controller を配置し、外部 Git の YAML を同じクラスタに反映する例。prune と照合停止は設定に依存する。

## 2. 仕組みと処理の流れ

- **変更の保存元**: マニフェストを Git に置く。
- **ソースの取得**: GitRepository の参照先を取得し変更を監視する。
- **取得物**: 取得したリビジョンを tar.gz artifact として公開する。
- **構成の照合**: artifact のマニフェストを生成し Kubernetes API に適用、指定間隔で差分を照合する。
- **稼働中の構成**: Deployment の目標仕様が更新される。

- 変更の保存元 → ソースの取得: Git リビジョンを取得。
- ソースの取得 → 取得物: artifact を生成。
- 取得物 → 構成の照合: artifact を取得。
- 構成の照合 → 稼働中の構成: 構成を適用・照合。

## 3. 運用上の考慮

利用者が管理する Kubernetes に source-controller と kustomize-controller を配置し、外部 Git の YAML を同じクラスタに反映する例。prune と照合停止は設定に依存する。

## 4. 実装例：Kubernetes クラスタ内の Flux

利用者が管理する Kubernetes に source-controller と kustomize-controller を配置し、外部 Git の YAML を同じクラスタに反映する例。prune と照合停止は設定に依存する。

公式資料を組み合わせた説明用構成であり、特定の導入事例や動作検証済み構成を示すものではありません。

| 機能 | 担い手 | 説明 |
| --- | --- | --- |
| 変更の保存元 | 外部 Git リポジトリ | マニフェストを Git に置く。 |
| ソースの取得 | source-controller と GitRepository | GitRepository の参照先を取得し変更を監視する。 |
| 取得物 | リビジョン付き artifact | 取得したリビジョンを tar.gz artifact として公開する。 |
| 構成の照合 | kustomize-controller と Kustomization | artifact のマニフェストを生成し Kubernetes API に適用、指定間隔で差分を照合する。 |
| 稼働中の構成 | Kubernetes API と Deployment | Deployment の目標仕様が更新される。 |

## 公式資料

- [GitRepository](https://fluxcd.io/flux/components/source/gitrepositories/)
- [Kustomization](https://fluxcd.io/flux/components/kustomize/kustomizations/)
- [Flux architecture](https://fluxcd.io/flux/flux-e2e/)
