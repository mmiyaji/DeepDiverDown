# RustFS の S3 互換オブジェクトストレージ

## 1. 対象

S3 互換 API からオブジェクトを保存し、分散配置されたディスクを利用する。

## 2. 機能配置と処理

クライアントが S3 互換 API でオブジェクトを読み書きし、ストレージノードがデータをディスクへ保存する。分散構成では erasure coding を利用する。

## 3. 設計上の注意

S3 互換はすべての API や暗号化形式が互換である保証ではない。単一ノード・単一ディスクは冗長化されない。

## 4. 実装例

RustFS Helm の分散構成で複数 Pod と PVC を使う例。Kubernetes の実行場所と PVC の提供先は固定しない。

| 機能 | 担い手 |
|---|---|
| オブジェクト利用者 | S3 互換クライアント |
| オブジェクト API | RustFS S3 API |
| ストレージノード群 | RustFS 分散 Pod |
| 永続ディスク群 | Kubernetes PVC |
| ストレージ運用者 | 運用担当者 |
| 配置・冗長化の設定 | RustFS Helm 設定 |

利用者が Kubernetes ノード、RustFS、認証、PVC とバックアップを管理する。PVC の実際の提供元と配置先は未選定であり、S3 互換 API は Amazon S3 を意味しない。公式資料を組み合わせた未検証の例で、ストレージと障害復旧は導入時に検証する。

[RustFS Helm deployment](https://docs.rustfs.com/en/installation/cloud-native)、[S3 compatibility](https://docs.rustfs.com/en/reference/s3-compatibility)。

## 5. 実装例：AWS の EKS・RustFS 分散 Helm・EBS

公式 Helm チャートを Amazon EKS の EC2 ノードグループに配置する。分散モードで 4 Pod・各 4 データ PVC を選ぶ例。EBS CSI を使う StorageClass を指定し、各 Pod のデータ PVC と、ログをファイルに保存する際のログ用 PVC に EBS を割り当てる。

| 機能配置 | 実装での担い手 |
|---|---|
| 利用アプリとオブジェクト API | クラスタ内の S3 互換クライアントと RustFS の Kubernetes Service |
| ストレージノード群 | EKS の EC2 上で動く RustFS StatefulSet |
| 永続ディスク | CSI で割り当てた各 Pod の EBS ボリューム |
| 冗長化と運用 | Helm の設定、認証用 Secret、RustFS の消失訂正符号化、運用担当者 |

EKS の制御プレーンは AWS 管理 VPC にあり、利用者は Kubernetes API と公開設定を操作できるがサーバーへ直接アクセスしない。利用者は RustFS と CSI の設定、認証、データ、更新とバックアップを管理し、AWS は EBS の基盤を運用する。EBS CSI はボリュームを作成・接続する。複数の公式資料を組み合わせた未検証の例であり、対応バージョン、AZ 配置と復旧を導入時に検証する。

オブジェクトの保存と API は RustFS が担当し、Amazon EBS はブロックデバイスを提供する。EBS と Pod の配置先は AZ の制約を受けるため、PVC の配置と RustFS の耐障害性は構成時に設計する。このチャート例ではクラスタ内の Service を使う。RustFS は Apache-2.0 で、更新とバックアップ・復旧は運用者が担当する。

- [EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)
- [RustFS Kubernetes Helm installation](https://docs.rustfs.com/en/installation/cloud-native)
- [RustFS deployment and Apache-2.0](https://docs.rustfs.com/en/installation)
- [RustFS S3 compatibility](https://docs.rustfs.com/en/reference/s3-compatibility)
- [Amazon EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [Amazon EKS EBS CSI driver](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html)
