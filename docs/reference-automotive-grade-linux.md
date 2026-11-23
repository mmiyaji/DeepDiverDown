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

車載ボード上で Linux カーネル、フレームワーク、サービスとアプリを実行する。利用者がボード、リリース、ドライバーとアプリを選び管理する。対向 ECU と物理ネットワークはこの例では未指定である。複数の公式資料を組み合わせた未検証の概念例で、実車搭載や動作確認を意味しない。

[AGL architecture overview](https://docs.automotivelinux.org/en/vimba/03_Architecture_Guides/01_Introduction/01_Overview/)、[AGL platform](https://docs.automotivelinux.org/en/quillback/03_Architecture_Guides/02_Security_Blueprint/06_Platform/)。

## 5. 実装例：AGL Unagi 21.0.0 の Qt IVI を QEMU で実行

Linux x86-64 の開発ホストで QEMU/KVM を使う。公式配布サイトの Unagi 21.0.0 の `qemux86-64` から Qt IVI の ext4 イメージと同じリリースのカーネルを選ぶ。ホスト側の VNC ビューアーでゲストの画面を確認する。

| 機能配置 | 実装での担い手 |
|---|---|
| 車載アプリと HMI | Qt Homescreen とデモアプリ |
| アプリ管理 API | `applaunchd` の gRPC と `systemd` |
| ユーザー空間サービス | ゲスト内の `agl-compositor` / Wayland |
| OS とドライバー | ゲストの AGL カーネル。QEMU の仮想デバイスを使う |
| ハードウェア相当と試験画面 | Linux ホストの QEMU / KVM、virtio、VNC |

利用者が Linux 開発ホスト、QEMU、イメージと VNC を管理する。ゲストの仮想デバイスは物理車載 ECU ではなく、この例には対向 ECU や車載物理ネットワークを仮定しない。複数の公式資料を組み合わせた構成で、本リポジトリでは動作検証していない。

この説明は Unagi 21.0.0 の Qt IVI イメージを対象にする。別の AGL リリースやボード用イメージでは機能やデバイス構成が変わる。ゲストの仮想デバイスで IVI を確認する例で、実車への接続や安全認証とは別である。

- [AGL Unagi quickstart](https://docs.automotivelinux.org/en/unagi/01_Getting_Started/01_Quickstart/01_Using_Ready_Made_Images/)
- [AGL Unagi 21.0.0 Qt IVI image manifest](https://download.automotivelinux.org/AGL/release/unagi/21.0.0/qemux86-64/deploy/images/qemux86-64/agl-ivi-demo-qt-qemux86-64.manifest)
- [AGL Unagi compositor](https://docs.automotivelinux.org/en/unagi/06_Component_Documentation/01_Graphics_Service/01_agl_compositor/)
- [AGL application launcher](https://docs.automotivelinux.org/en/salmon/06_Component_Documentation/Application_Framework/02_Application_Startup/)
