# Android Automotive OS と VHAL

## 1. 対象

Android Automotive OS の車両向け API と Vehicle HAL の構成を、参照実装で整理する。

## 2. 機能配置と処理

車載アプリは Car API と Car Service を介して車両プロパティにアクセスする。AIDL VHAL の参照実装は FakeVehicleHardware を使い、模擬値を保持する。

## 3. 設計と利用上の注意

Android Automotive OS は車載 OS であり、スマートフォンを接続する Android Auto とは異なる。参照実装の模擬データは実車の CAN 接続を意味しない。

## 4. 実装例：AOSP VHAL 参照実装

FakeVehicleHardware を用いる参照実装の例。実車のハードウェア接続は OEM の実装による。

| 機能 | 担い手 |
|---|---|
| 車載アプリ | 車載 Android アプリ |
| 車載サービス | Android Car Service |
| 車両抽象化 API | AIDL Vehicle HAL |
| 模擬車両実装 | FakeVehicleHardware |
| 模擬プロパティ | 模擬車両プロパティ |

この参照実装では利用者が用意する AAOS 実行環境にアプリ、Car Service、VHAL と模擬値を置く。利用者がイメージ、アプリ、権限と模擬設定を管理する。実車 ECU や物理ネットワークは仮定しない。公式資料を組み合わせた未検証例で、実行機種とバージョンは未選定である。

[Vehicle HAL overview](https://source.android.com/docs/automotive/vhal)、[VHAL reference implementation](https://source.android.com/docs/automotive/vhal/reference-implementation)。

## 5. 実装例：Android 15 Cuttlefish の仮想 VHAL

AOSP の `android-15.0.0_r7` の x86-64 Automotive 用 Cuttlefish 構成例。仮想化を有効にした Linux ホストで AAOS のゲストを動かす。ゲストの AIDL VHAL が車両プロパティ要求をホスト側の `vhal_proxy_server` へ中継する。

| 機能配置 | 実装での担い手 |
|---|---|
| 車載アプリと車載サービス | AAOS ゲスト内のテストアプリ、Car API、Car Service |
| 車両抽象化とホスト境界 | ゲスト側の AIDL VHAL と `GRPCVehicleHardware`、gRPC / vsock |
| 模擬車両実装 | Linux ホスト側の `vhal_proxy_server` と `FakeVehicleHardware` |
| 模擬プロパティ | JSON のプロパティ定義とメモリー上の現在値 |

利用者が Linux ホスト、Cuttlefish、ゲストイメージとアプリ・権限を管理する。ホストとゲストの接続は仮想 vsock であり、実車 ECU や物理車載ネットワークは含まない。複数の公式資料を組み合わせた構成で、本リポジトリでは動作検証していない。Android 15 の参照ソースと実行環境の互換性は導入時に確認する。

アプリに必要な Car API の権限を与える。ホスト側の FakeVehicleHardware は模擬値を扱い、試験対象は仮想デバイス内の API である。実車の CAN や OEM のアクチュエーター接続とは別の構成になる。

- [Cuttlefish host requirements](https://source.android.com/docs/devices/cuttlefish/get-started)
- [AOSP Android 15 automotive product](https://android.googlesource.com/device/google/cuttlefish/+/refs/tags/android-15.0.0_r7/vsoc_x86_64_only/auto/aosp_cf.mk)
- [Cuttlefish guest VehicleService](https://android.googlesource.com/device/google/cuttlefish/+/refs/tags/android-15.0.0_r7/guest/hals/vehicle/VehicleService.cpp)
- [Cuttlefish host VHAL proxy](https://android.googlesource.com/device/google/cuttlefish/+/refs/tags/android-15.0.0_r7/host/commands/vhal_proxy_server/VhalProxyServer.cpp)
- [VHAL reference implementation](https://source.android.com/docs/automotive/vhal/reference-implementation)
