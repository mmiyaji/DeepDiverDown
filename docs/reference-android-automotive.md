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

[Vehicle HAL overview](https://source.android.com/docs/automotive/vhal)、[VHAL reference implementation](https://source.android.com/docs/automotive/vhal/reference-implementation)。
