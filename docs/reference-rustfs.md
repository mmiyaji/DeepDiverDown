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

[RustFS Helm deployment](https://docs.rustfs.com/en/installation/cloud-native)、[S3 compatibility](https://docs.rustfs.com/en/reference/s3-compatibility)。
