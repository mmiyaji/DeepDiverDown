# AUTOSAR Adaptive Platform のサービス

## 1. 対象

高性能 ECU 向けの AUTOSAR Adaptive Platform と、Classic 側との連携を整理する。

## 2. 機能配置と処理

Adaptive Application は ARA のインターフェースを使い、通信管理や実行管理、永続化などの機能を利用する。Classic ECU の信号と Adaptive のサービスは適切な変換を通じて連携する。

## 3. 設計と利用上の注意

層の構成は標準が定める役割の例であり、特定製品の安全認証を意味しない。Classic / Adaptive の配置や信号変換は実装に依存する。

## 4. 実装例：Adaptive Platform の標準構成例

ARA の機能クラスタと Classic ECU への接続を示す標準構成例。具体的な OS や信号変換の配置は実装による。

| 機能 | 担い手 |
|---|---|
| 車載アプリ | Adaptive Application |
| 標準ランタイム API | AUTOSAR ARA |
| サービス間通信 | Communication Management |
| 実行と状態の管理 | Execution Management |
| 永続データ | Persistency |
| 基盤 OS | POSIX OS |
| 従来 ECU との接続 | Classic ECU / 信号変換 |

Adaptive ECU 上で POSIX 対応 OS とアプリ・機能クラスタを実行し、Classic ECU は別の実行対象として示す。利用者が ECU、OS と AUTOSAR 実装、通信設定を選定・管理する。接続方式と変換の配置は未確定であり、公式仕様に基づく未検証の例である。

[AUTOSAR Adaptive Platform](https://www.autosar.org/standards/adaptive-platform/)、[AUTOSAR Classic Platform](https://www.autosar.org/standards/classic-platform)。

## 5. 実装例：R24-11 仕様に基づく Adaptive / Classic ECU の連携

AUTOSAR R24-11 が示す信号・サービス変換を、別々の ECU の境界が見えるように配置した仕様例。Adaptive Application は POSIX 対応のマシン上のプロセスとして起動し、Classic ECU とのサービス通信には Ethernet 上の SOME/IP を選ぶ。

| 機能配置 | この仕様ベースの例での担い手 |
|---|---|
| アプリと実行環境 | Adaptive Application プロセス、ARA、POSIX 対応 OS |
| 起動・停止と配備 | Execution Management と Execution / Machine Manifest |
| サービス通信 | Communication Management と SOME/IP の Service Instance Manifest |
| Classic ECU への変換 | Classic 側の Translation SWC。SOME/IP のサービスイベントと Sender/Receiver 信号を変換する |
| 永続データ | Persistency API。保存媒体は採用する実装で選ぶ |

Adaptive ECU と Classic ECU を別のハードウェアとして示し、Ethernet と配備設定を外に分ける。利用者が両 ECU の実装、マニフェスト、通信と更新を管理する。複数の公開仕様から構成した代表例であり、通信スタックの具体製品と変換方式の互換性は未確認で、動作検証していない。公開仕様は機能とインターフェースを定義する。特定の OS 製品・ボード、配備可能な ECU イメージや実車認証はこの例の範囲外である。AUTOSAR の Release Overview が説明する内部 Demonstrator は、仕様の部分的な検証に用いられる。

- [AUTOSAR Adaptive R24-11 Platform Design](https://www.autosar.org/fileadmin/standards/R24-11/AP/AUTOSAR_AP_EXP_PlatformDesign.pdf)
- [AUTOSAR Adaptive R24-11 Software Architecture](https://www.autosar.org/fileadmin/standards/R24-11/AP/AUTOSAR_AP_EXP_SWArchitecture.pdf)
- [AUTOSAR Classic R24-11 Layered Software Architecture](https://www.autosar.org/fileadmin/standards/R24-11/CP/AUTOSAR_CP_EXP_LayeredSoftwareArchitecture.pdf)
- [AUTOSAR Adaptive R24-11 Release Overview](https://www.autosar.org/fileadmin/standards/R24-11/AP/AUTOSAR_AP_TR_ReleaseOverview.pdf)
