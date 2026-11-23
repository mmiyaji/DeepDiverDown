# KubeEdge のクラウド・エッジ連携

## 1. 対象

KubeEdge の管理側とエッジ側のコンポーネント、およびワークロード配置を整理する。

## 2. 機能配置と処理

Kubernetes API と CloudCore の CloudHub が管理側で動作し、EdgeCore の EdgeHub が接続する。edged がエッジワークロードを実行する。

## 3. 設計と利用上の注意

管理側は特定のクラウド事業者を前提としない。切断時に利用できる機能と状態の同期は構成とワークロードに依存する。

## 4. 実装例：CloudCore と EdgeCore の配置

管理側 Kubernetes と現場端末を接続する例。クラウド事業者は固定しない。

| 機能 | 担い手 |
|---|---|
| クラスタ管理 API | Kubernetes API |
| 管理側ゲートウェイ | KubeEdge CloudCore / CloudHub |
| エッジ実行基盤 | KubeEdge EdgeCore / EdgeHub |
| 現場の処理 | エッジワークロード |
| 現場デバイス | 現場デバイス |

[CloudHub](https://release-1-17.docs.kubeedge.io/docs/architecture/cloud/cloudhub/)、[EdgeHub](https://release-1-18.docs.kubeedge.io/docs/architecture/edge/edgehub/)。
