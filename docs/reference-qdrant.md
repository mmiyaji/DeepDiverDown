# Qdrant のベクトル検索

## 1. 対象

ベクトルと付随属性をコレクションに保存し、条件付き類似検索を行う。

## 2. 機能配置と処理

アプリがベクトルと属性をコレクションに登録する。検索要求はベクトル近傍探索と属性条件を組み合わせ、近い候補を返す。データと索引はセグメントに整理される。

## 3. 設計上の注意

埋め込みモデルの選択、検索精度、属性フィルター、次元、権限、シャードとレプリカを運用要件に合わせる。

## 4. 実装例

外部の埋め込みモデルで生成したベクトルを自己運用の Qdrant コレクションに登録し、検索する例。モデル提供者は固定しない。

| 機能 | 担い手 |
|---|---|
| 検索アプリ | 検索アプリ |
| ベクトルの生成 | 設定された埋め込みモデル |
| ベクトルと属性の保存 | Qdrant コレクション |
| 近傍・条件付き検索 | Qdrant 検索 API |
| 検索結果の利用 | 検索結果の利用者 |
| 索引とデータの単位 | Qdrant セグメント |

利用者が Qdrant の実行ホスト、永続ディスク、認証とバックアップを管理する。埋め込みモデルの提供元と実行場所は未選定で、特定のクラウドサービスを仮定しない。公式資料を組み合わせた未検証の例で、モデルや DB の版と復旧を導入時に確認する。

[Qdrant architecture](https://qdrant.tech/documentation/overview/)、[Qdrant](https://github.com/qdrant/qdrant)。

## 5. 実装例：AWS の EKS・Qdrant・EBS

Amazon EKS の EC2 ノードグループに Qdrant の OSS Helm チャートを配置する。アプリと Qdrant が別 Pod で動き、検索アプリから Kubernetes Service を通じて Qdrant に接続する。Qdrant Pod の PVC に EBS CSI ドライバーがブロックストレージを割り当てる。

| 機能配置 | 実装での担い手 |
|---|---|
| 検索アプリ・ベクトル生成 | EKS 上の Python アプリと同一プロセスの FastEmbed |
| ベクトルと属性・近傍検索 | Qdrant コレクションと検索 API |
| 索引とデータの単位・永続化 | Qdrant のセグメントと、PVC からマウントする EBS のファイルシステム |
| 検索結果の利用 | Python アプリから候補を受け取る利用者 |

EKS の制御プレーンは AWS 管理 VPC にあり、利用者は Kubernetes API と公開設定を操作できるがサーバーへ直接アクセスしない。利用者は Qdrant、アプリ、EBS CSI の権限とデータを管理し、AWS は EBS 基盤を運用する。FastEmbed はアプリ内で実行し、外部推論 API を仮定しない。複数の公式資料を組み合わせた未検証の例で、対応版、接続、バックアップと復旧を導入時に検証する。

例示の英語モデルは FastEmbed がサポートする `BAAI/bge-small-en-v1.5`（MIT、384 次元）。Qdrant 本体は Apache-2.0。AWS は Kubernetes 管理とブロックストレージを提供し、Qdrant の更新、認証、レプリケーション設定とバックアップ・復旧は自己運用する。

- [EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)
- [Qdrant installation and storage requirements](https://qdrant.tech/documentation/install/)
- [Qdrant Helm chart](https://github.com/qdrant/qdrant-helm)
- [FastEmbed model registry](https://qdrant.tech/documentation/embeddings/fastembed/)
- [Qdrant license](https://github.com/qdrant/qdrant/blob/master/LICENSE)
- [Amazon EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [Amazon EBS CSI driver](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html)
