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

この例では CAN Provider、Databroker とアプリを同じ車載計算機に置き、信号元 ECU と CAN バスを分ける。利用者が計算機、ソフトウェア、アクセス権と DBC・VSS 対応を管理する。実車の ECU、CAN 接続と機種は未選定で、公式資料を組み合わせた未検証の構成例である。

[Eclipse SDV blueprint architecture](https://sdv-blueprints.eclipse.dev/docs/e2e-demo-blueprint/architecture/)、[Signal mapping](https://sdv-blueprints.eclipse.dev/docs/e2e-demo-blueprint/signal-mapping/)。

## 5. 実装例：Raspberry Pi 5 と Ankaios の Eclipse SDV ベンチ

公式 E2E Demo Blueprint のうち、Arduino LED ECU からの状態フィードバックを読む経路。Ubuntu 24.04 の Raspberry Pi 5 で Eclipse Ankaios 0.7.0 が Podman を使って Kuksa Databroker 0.6.0 と CAN Provider 0.4.4 を運用する。コンテナはホストのネットワーク名前空間を共有する。

| 機能配置 | 実装での担い手 |
|---|---|
| 車両ネットワーク相当のデモ接続 | Arduino の MCP2515、物理 CAN バス、Raspberry Pi の CAN HAT と SocketCAN |
| 信号変換 | Kuksa CAN Provider の読み取り処理 |
| 車両データ共有 | Kuksa Databroker の VSS 現在値と gRPC |
| デモの信号を読むアプリ | Pi の診断端末で動かす `databroker-cli` |
| 信号定義と対応付け | COVESA VSS とデモの DBC・VSS 対応 JSON |

利用者が Pi、Arduino、CAN 配線、Ankaios、コンテナ、信号定義を管理する。公式資料の一部を組み合わせた代表構成であり、本リポジトリで動作検証していない。ハードウェア、バージョン、ネットワークとアクセス制御は実行時に確認する。

CAN Provider が `BlinkerStatus` を受け、Databroker の現在値を更新する。診断アプリは localhost の gRPC で購読する。ここで扱うのは物理ベンチ上の読み取り経路で、実車 CAN への接続や実車の機能安全・性能の検証とは別である。

- [Eclipse SDV E2E Demo architecture](https://sdv-blueprints.eclipse.dev/docs/e2e-demo-blueprint/architecture/)
- [Eclipse SDV hardware bill of materials](https://sdv-blueprints.eclipse.dev/docs/e2e-demo-blueprint/hardware/)
- [Eclipse SDV VSS and CAN signal mapping](https://sdv-blueprints.eclipse.dev/docs/e2e-demo-blueprint/signal-mapping/)
- [Eclipse SDV communication workflow](https://sdv-blueprints.eclipse.dev/docs/e2e-demo-blueprint/communication-workflow/)
- [Kuksa Databroker user guide](https://github.com/eclipse-kuksa/kuksa-databroker/blob/main/doc/user_guide.md)
