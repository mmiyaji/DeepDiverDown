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
