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

## 9. 実装例：GKE Standard のリージョンクラスタ
GKE Standard で基盤用とアプリ用のノードプールを置き、Artifact Registry の注文 API を外部 L4 ロードバランサーで公開する例。

| 機能配置 | この例での担い手 |
|---|---|
| 運用者 | gcloud と kubectl |
| マネージド制御 API | GKE リージョン制御プレーン |
| 基盤用ノード群（配置例） | Compute Engine 基盤用プール |
| アプリ用ノード群（配置例） | Compute Engine アプリ用プール |
| 注文 API の実行単位 | 注文 API Deployment / Pod |
| アプリ公開・振り分け | 外部パススルー Network Load Balancer |
| コンテナイメージの保管 | Artifact Registry |

- **注文 API の LoadBalancer Service**。Service のポートと注文 API のエンドポイントを対応させる。

基盤用とアプリ用のプール分割はこの例の配置方針。ゾーン分散、LB の種類、ノードのリポジトリへのアクセス権を用途に合わせて設定する。

外部パススルー Network Load Balancer のバックエンドはノード VM。ノード側の Service ルールが注文 API の Pod へ転送する。この例では `externalTrafficPolicy: Local` を使い、正常なローカル Pod があるノードで外部トラフィックを受ける。リージョン制御プレーンの配置と各ノードプールのゾーン指定は個別に確認する。

GKE が制御プレーンのライフサイクルを管理し、制御プレーンは GKE 管理プロジェクトで動く。利用者は Kubernetes API と公開されたクラスタ設定を権限に応じて操作し、Standard のノードプールを設定・管理する。外枠は Google Cloud のサービス領域、クラスタ枠は論理的な所属であり、単一の顧客プロジェクトや VPC を意味しない。ロードバランサーと Artifact Registry は独立サービスである。

この構成は複数の公式資料を組み合わせた例であり、実在の導入例や動作検証済み構成ではない。具体的な権限、ネットワークとバージョンは導入時に確認する。

公式資料
- [GKE cluster architecture](https://cloud.google.com/kubernetes-engine/docs/concepts/cluster-architecture)
- [GKE network isolation](https://cloud.google.com/kubernetes-engine/docs/concepts/network-isolation)
- [GKE cluster modes](https://cloud.google.com/kubernetes-engine/docs/concepts/choose-cluster-mode)
- [GKE node pools](https://cloud.google.com/kubernetes-engine/docs/concepts/node-pools)
- [GKE LoadBalancer Services](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/service-load-balancer)
- [Artifact Registry integration with GKE](https://cloud.google.com/artifact-registry/docs/integrate-gke)
- [GKE のリージョンクラスタとノードロケーション](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/regional-clusters)
