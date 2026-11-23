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

SWC、RTE、BSW と抽象化は同じ MCU を持つ Classic ECU 上のソフトウェアとして示す。利用者が ECU、実装製品、生成ツール、設定と配備を選定する。公式仕様を使った未検証の概念例であり、特定の ECU 製品や実動作を示さない。

[AUTOSAR Classic Platform](https://www.autosar.org/standards/classic-platform)、[AUTOSAR standards](https://www.autosar.org/standards/r24-11)。

## 5. 実装例：標準 Workflow Example の CAN ベンチ

AUTOSAR の Classic Platform Workflow Example 初回版では、CAN バスで接続した 2 台の ECU を題材にする。システム記述から ECU ごとの Extract を用意し、ARXML を対応ツールで処理する。公式資料は、Extract の検証後にアプリケーションの C ソースを提供元へ依頼できるとしている。その C ソースと生成した RTE・BSW 設定を対象 MCU 用にビルドし、実行用 HEX を作る。

| 機能配置 | この仕様ベースの例での担い手 |
|---|---|
| 組み込みアプリと RTE | ECU に割り当てた SWC と生成する RTE |
| 基盤サービスと抽象化 | 配備先に対応した Classic BSW、CAN Interface、CAN Driver |
| 実行環境と通信 | CAN 対応 MCU を使う 2 ECU とベンチ CAN バス |
| ビルド時の依存 | ECU Extract、対象 MCU 用の BSW / MCAL とツールチェーン |

開発ホストで生成・ビルドし、ECU A の MCU に書き込む。ECU B と CAN バスは ECU A の外側にある。利用者がツールチェーン、書込み方法、ネットワークと ECU の運用を担う。図は公式資料を組み合わせた未検証のベンチ構成である。図は特定製品を選定する前のベンチ構成を示す。公式資料は対象 MCU、BSW 製品、生成ツール、認証済み車両の組み合わせを指定していない。実装の利用条件は選んだソフトウェアとツールごとに確認する。

- [AUTOSAR Classic Platform Workflow Example](https://www.autosar.org/standards/classic-platform)
- [AUTOSAR R24-11 Classic Layered Software Architecture](https://www.autosar.org/fileadmin/standards/R24-11/CP/AUTOSAR_CP_EXP_LayeredSoftwareArchitecture.pdf)
- [AUTOSAR R24-11 releases](https://www.autosar.org/standards/r24-11)
