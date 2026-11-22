# Google GKE Standard マネージド境界とノード更新

## 1. 範囲
Google Kubernetes Engine（GKE）のマネージドコントロールプレーン、Standard モードのノードプール、デプロイと置換を示す。選択は regional GKE Standard とし、ノードプールの構成・スケール・アップグレードを明示的に扱えるようにする。Autopilot は比較対象だが、この図の選択ではない。

出典 [GKE overview](https://cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview)・[Choose a cluster mode](https://cloud.google.com/kubernetes-engine/docs/concepts/choose-cluster-mode)

## 2. マネージド境界
Google Cloud が GKE のコントロールプレーンとシステムコンポーネントを管理する。Standard では利用者がノードプールと基盤設定を選び、ノードの責任が残る。Autopilot ならノード、スケール、セキュリティまで Google が管理するため、Standard と責任境界が異なる。

出典 [GKE overview](https://cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview)・[GKE modes](https://cloud.google.com/kubernetes-engine/docs/concepts/choose-cluster-mode)

## 3. 採用するノード方式
regional Standard cluster に複数の node pool を置く方式を採用する。図では基盤ワークロード用とアプリワークロード用という責務分担を例示するが、GKE Standard に AKS の system/user のような固定された二種類の pool があるわけではない。実際の台数・マシンタイプ・リージョン・autoscaling は未確定であり、モデルに replicas は記録しない。Autopilot を選ぶ場合はノードを直接設計せず、Pod のリソース要求を入力に GKE がノードを管理する。

出典 [About node pools](https://cloud.google.com/kubernetes-engine/docs/concepts/node-pools)・[GKE Autopilot overview](https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview)

## 4. API とデプロイ
運用者は Google Cloud API/gcloud でクラスタを管理し、Kubernetes API で Deployment を適用する。GKE コントロールプレーンが Pod を node pool にスケジュールし、Artifact Registry からイメージを取得する。Service と外部ロードバランサが利用者向け入口になる。

出典 [GKE overview](https://cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview)・[Artifact Registry with GKE](https://cloud.google.com/artifact-registry/docs/integrate-gke)

## 5. 更新・置換
GKE はコントロールプレーンとノードを別々に更新する。Standard の node pool では surge、blue-green などの更新戦略を選べ、更新中はノードを drain して Pod を別ノードへ移す。コントロールプレーン更新後に node pool を更新できるが、同時に完了するとは限らない。Regional control plane は更新中も可用性を保つ設計である。

出典 [Manually upgrade a cluster](https://cloud.google.com/kubernetes-engine/docs/how-to/upgrading-a-cluster)・[Manage cluster lifecycle changes](https://cloud.google.com/kubernetes-engine/docs/concepts/managing-clusters)

## 6. 論理図の読み方
Google Cloud API と Kubernetes API を入口に、GKE cluster 境界内のコントロールプレーン、基盤用/アプリ用という責務を例示した pool、ワークロードへ流れる。Artifact Registry はイメージ供給、外部ロードバランサは公開境界である。Standard の pool を描くことで、Autopilot の「ノードを利用者が設計しない」境界との差を明示する。

出典 [GKE modes](https://cloud.google.com/kubernetes-engine/docs/concepts/choose-cluster-mode)・[About node pools](https://cloud.google.com/kubernetes-engine/docs/concepts/node-pools)

## 7. シナリオ：同じ順序の API・デプロイ・置換
1. **受付** — 運用者が Google Cloud/Kubernetes API にクラスタ設定または Deployment を送る。
2. **配置** — GKE コントロールプレーンが Pod を責務に応じた Standard node pool へ割り当て、Artifact Registry からイメージを取得する。
3. **公開** — Service と外部ロードバランサがワークロードを外部へ公開する。
4. **置換** — コントロールプレーン更新後、選択した node pool 戦略で新ノードを増設し、drain・再スケジュールして旧ノードを削除する。

## 8. 参考資料
- [GKE overview](https://cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview)
- [Choose a cluster mode](https://cloud.google.com/kubernetes-engine/docs/concepts/choose-cluster-mode)
- [About node pools](https://cloud.google.com/kubernetes-engine/docs/concepts/node-pools)
- [Manually upgrade a cluster](https://cloud.google.com/kubernetes-engine/docs/how-to/upgrading-a-cluster)
