# AUTOSAR Classic Platform の層

## 1. 対象

AUTOSAR Classic Platform が規定するマイクロコントローラー向けの基本層を整理する。

## 2. 機能配置と処理

アプリケーションの software component は RTE を通じて他の部品や基盤サービスと通信する。BSW はサービス、ECU 抽象化、マイコン抽象化等からなり、ハードウェアへ接続する。

## 3. 設計と利用上の注意

AUTOSAR は標準仕様であり、図は特定の実装製品や認証済み ECU を表さない。ライセンス条件と対象版を確認する。

## 4. 実装例：Classic Platform の標準構成例

AUTOSAR Classic の仕様に基づく一般的な ECU 構成。特定の認証済み実装ではない。

| 機能 | 担い手 |
|---|---|
| 組み込みアプリ | Classic Application SWC |
| アプリの実行環境 | AUTOSAR RTE |
| システム・通信サービス | Classic BSW Services |
| ハードウェア抽象化 | ECU / MCU Abstraction |
| マイクロコントローラー | 車載マイクロコントローラー |

[AUTOSAR Classic Platform](https://www.autosar.org/standards/classic-platform)、[AUTOSAR standards](https://www.autosar.org/standards/r24-11)。
