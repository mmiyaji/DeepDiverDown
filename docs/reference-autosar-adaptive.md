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

[AUTOSAR Adaptive Platform](https://www.autosar.org/standards/adaptive-platform/)、[AUTOSAR Classic Platform](https://www.autosar.org/standards/classic-platform)。
