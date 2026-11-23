# Automotive Grade Linux の車載基盤

## 1. 対象

Automotive Grade Linux（AGL）の車載アプリケーション向けのソフトウェア層を整理する。

## 2. 機能配置と処理

車載アプリと HMI はアプリフレームワークやユーザー空間のサービスを利用し、その下で Linux カーネルとドライバーがハードウェアに接続する。

## 3. 設計と利用上の注意

AGL の機能はリリースや画像構成によって変わる。図は IVI 系の一般的な層であり、安全機能や認証を保証するものではない。

## 4. 実装例：AGL の IVI 向け層構成

AGL の公式アーキテクチャに基づく IVI 向けの層構成例。具体的なハードウェアやリリースは固定しない。

| 機能 | 担い手 |
|---|---|
| 車載アプリと HMI | AGL App / HMI |
| アプリ管理 API | AGL Application Framework |
| ユーザー空間サービス | AGL Services |
| OS とドライバー | Linux kernel / drivers |
| 車載ハードウェア | 車載ボード |

[AGL architecture overview](https://docs.automotivelinux.org/en/vimba/03_Architecture_Guides/01_Introduction/01_Overview/)、[AGL platform](https://docs.automotivelinux.org/en/quillback/03_Architecture_Guides/02_Security_Blueprint/06_Platform/)。
