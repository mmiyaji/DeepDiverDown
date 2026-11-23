# OPA と Conftest による PR のポリシーチェック

## 1. モデルの範囲

注文 API の Deployment に CPU request を設定するチームルールを、GitHub の PR に対する CI で検査する架空例。図はマージ前の評価を扱う。

出典 [Conftest Usage](https://www.conftest.dev/)、[GitHub About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

## 2. 入力をそろえる

CI は PR の評価対象コミットから Deployment の YAML を取得し、Conftest に渡す。テンプレートを使う場合は、検査したい最終マニフェストを生成してから渡す。チェックの結果は評価対象のコミットに紐付く。

出典 [Conftest Usage](https://www.conftest.dev/)、[GitHub Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)

## 3. Rego と Conftest の評価

Rego は構造化された入力に対する条件を記述する。例の `deny` は注文 API のコンテナに `resources.requests.cpu` がなければ理由を返す。Conftest は YAML を解析して評価し、`deny` があれば違反として非ゼロで終了する。通常の `warn` は設定によって失敗にできる。

出典 [Open Policy Agent Policy Language](https://www.openpolicyagent.org/docs/policy-language)、[Conftest Usage](https://www.conftest.dev/)、[Conftest Options](https://www.conftest.dev/options/)

## 4. マージ条件

CI ジョブが Conftest の失敗をチェックの失敗として報告し、保護ブランチがそのチェックを必須にする。修正後は最新の評価対象コミットでチェックが成功して初めて、このマージ条件を満たす。承認などの他のマージ条件はそれぞれ適用される。

出典 [GitHub About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)、[GitHub Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)

## 5. 実装例：GitHub Actions のマージ前ポリシー検査
GitHub の PR で注文 API 用の Kubernetes マニフェストを Conftest で評価し、検査成功を main のマージ条件にする例。

| 機能配置 | この例での担い手 |
|---|---|
| 注文 API の開発者 | GitHub の開発者 |
| レビュー対象の変更 | GitHub Pull Request |
| 注文 API の配備定義 | Git 内の deployment.yaml |
| 配備条件のポリシー | Git 内の policy/*.rego |
| CI ジョブ | GitHub-hosted Ubuntu runner 上の policy-ci ジョブ |
| ポリシーの評価 | 同じ一時 VM で実行する固定版の Conftest CLI |
| マージ可否に使う検査結果 | policy-ci の必須チェック |
| 保護されたブランチ | 保護された main |

- **GitHub Actions workflow YAML**。.github/workflows で対象イベントとジョブを定義する。

再現性のため CLI とアクションの版を固定する。GitHub がマージ条件として参照するチェック名とジョブ名を揃え、評価対象の PR に書き込み権限を渡す必要がない構成にする。

`pull_request` で起動し、チェックアウトに使う `GITHUB_TOKEN` は `contents: read` に限定する。ワークフロー、Rego ポリシー、CODEOWNERS 自体に担当を割り当て、保護された main で必須チェックとコードオーナーの承認を求める。Conftest の結果はマージ判定の入力として GitHub が管理する。クラスタの Admission 制御は別に設定する。

GitHub がホストされた runner VM と GitHub サービスの基盤を提供し、利用者は workflow、Conftest の版、Rego、権限、保護ルールと承認を設定する。Conftest は runner 内の CLI であり、別のマネージドサービスではない。複数の公式資料を組み合わせた代表例で、本リポジトリでは動作検証していない。固定版の互換性とブランチ保護設定は導入時に確認する。

公式資料
- [Conftest](https://www.conftest.dev/)
- [GitHub Actions: Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub-hosted runners](https://docs.github.com/en/actions/how-tos/manage-runners/github-hosted-runners)
- [GitHub の CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
