# Argo CD の GitOps 同期とセルフヒール

## 1. モデルの範囲

架空の注文 API の Deployment を Git の単一ソースから管理する。Argo CD の目標マニフェスト生成、差分検出と同期に絞っている。

出典 [Argo CD Architectural Overview](https://argo-cd.readthedocs.io/en/stable/operator-manual/architecture/)、[Argo CD Automated Sync Policy](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/)

## 2. コンポーネントと差分

Application で Git の対象とデプロイ先、同期方針を指定する。Repository Server は対象のソースから目標マニフェストを生成し、Application Controller は Kubernetes から得た実状態と比較する。差分があれば OutOfSync として扱う。

出典 [Argo CD Architectural Overview](https://argo-cd.readthedocs.io/en/stable/operator-manual/architecture/)、[Argo CD Diffing Customization](https://argo-cd.readthedocs.io/en/stable/user-guide/diffing/)

## 3. 自動同期とセルフヒール

自動同期を有効にすると、Git に新しいリビジョンが入り Application が OutOfSync になったときに同期できる。実クラスタの変更だけで再同期を起動するには、例の単一ソース構成では `selfHeal` も有効にする。Git から消したリソースを同期時に削除する `prune` は別の設定である。

出典 [Argo CD Automated Sync Policy](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/)

## 4. 注文 API のレプリカ数

この例では HPA を使わず、`spec.replicas` は差分の無視対象にも入れない。Git 側で 2 から 3 に上げた場合の同期と、運用者がクラスタ側で 3 から 1 に変えた後のセルフヒールを扱う。マニフェストが同期された状態と、Pod がすべて Ready になった状態は個別に確認する。

出典 [Argo CD Architectural Overview](https://argo-cd.readthedocs.io/en/stable/operator-manual/architecture/)、[Argo CD Automated Sync Policy](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/)、[Argo CD Diffing Customization](https://argo-cd.readthedocs.io/en/stable/user-guide/diffing/)

## 5. 実装例：Argo CD と Helm の宣言同期
運用と注文 API 用に 2 つの Amazon EKS クラスタを用意する。利用者が運用側の EC2 ノードに Argo CD をインストールし、GitHub の Helm chart を注文 API 側に同期する例。

| 機能配置 | この例での担い手 |
|---|---|
| Git リポジトリ | GitHub のプライベートリポジトリ内の注文 API Helm chart |
| 運用者 | kubectl を使う運用者 |
| 同期対象・方針の宣言 | Argo CD の Application CR |
| デプロイ定義の取得と生成 | argocd-repo-server Deployment |
| 望ましい状態と稼働状態の照合 | argocd-application-controller |
| 対象クラスタの制御 API | 対象 Kubernetes API |
| 注文 API の稼働構成 | 対象クラスタの注文 API Deployment |

- **Argo CD の Redis キャッシュ**。マニフェストや計算結果のキャッシュに使う。

Helm はマニフェストの生成に使い、同期は Application Controller が行う。手変更を戻すには自動同期だけでなく selfHeal の設定も確かめる。

repo-server には対象リポジトリを参照できる GitHub App の資格情報を設定する。運用側の Argo CD サービスアカウントには EKS Pod Identity で管理ロールを関連付け、対象クラスタ用の IAM ロールを引き受けさせる。対象 EKS ではアクセスエントリと Kubernetes RBAC で同期権限を割り当て、対象の API へプライベートに到達できるネットワークを用意する。AppProject でも許可するソース、配置先とリソースを制限する。Git のマージ承認は GitHub 側の責務で、Argo CD は同期ポリシーに従い適用する。

両 EKS の制御プレーンは AWS 管理 VPC にあり、利用者は Kubernetes API と公開設定を操作できるが、制御プレーンのサーバーには直接アクセスしない。利用者が EC2 ノード上の Argo CD、Redis、対象アプリ、IAM と RBAC を設定・運用する。GitHub は AWS の外にある。 これは複数の公式資料を組み合わせた代表構成であり、実在の導入例や動作検証済みの構成ではない。対応バージョン、ネットワーク、認証と権限は導入時に検証する。

公式資料
- [EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)
- [Argo CD Architecture](https://argo-cd.readthedocs.io/en/stable/operator-manual/architecture/)
- [Argo CD Helm guide](https://argo-cd.readthedocs.io/en/stable/user-guide/helm/)
- [Argo CD High Availability](https://argo-cd.readthedocs.io/en/stable/operator-manual/high_availability/)
- [Argo CD の EKS 認証](https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/#eks)
- [Argo CD のプライベートリポジトリ](https://argo-cd.readthedocs.io/en/stable/user-guide/private-repositories/)
