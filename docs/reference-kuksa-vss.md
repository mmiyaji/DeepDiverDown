# Eclipse Kuksa と VSS の車両データ

## 1. 対象

Eclipse Kuksa Databroker と Vehicle Signal Specification（VSS）を用いる信号共有を整理する。

## 2. 機能配置と処理

車両信号のプロバイダーが CAN 信号を DBC と VSS の対応付けに従い変換し、Databroker に登録する。アプリは Databroker の API から信号を取得する。

## 3. 設計と利用上の注意

信号の対応付け、アクセス制御、更新周期は実装ごとに設計する。図は Eclipse のブループリントに基づく読み取り例。

## 4. 実装例：Eclipse SDV ブループリントの信号共有

CAN Provider と Kuksa Databroker による読み取り例。信号の実際の種類と対応付けは車両による。

| 機能 | 担い手 |
|---|---|
| 車両ネットワーク | CAN バス |
| 信号変換 | CAN Provider |
| 車両データ共有 | Kuksa Databroker |
| 車載アプリ | 車載アプリ |
| 信号の対応付け | DBC / VSS mapping |
| 車両信号の定義 | Vehicle Signal Specification |

[Eclipse SDV blueprint architecture](https://sdv-blueprints.eclipse.dev/docs/e2e-demo-blueprint/architecture/)、[Signal mapping](https://sdv-blueprints.eclipse.dev/docs/e2e-demo-blueprint/signal-mapping/)。
