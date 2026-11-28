# Mender の概要（サーバー・デバイス認証・A/B 更新）

## 1. 概要

Mender は大量のデバイスへソフトウェアを無線（OTA）で配る更新システムである。クライアントとサーバーの構成で、Mender Server がデプロイを一元管理し、各デバイスのクライアントが更新を確認しに行く（取得日 2026 年 11 月 28 日）。更新の種類は、OS の全体イメージ、アプリケーション（Update Module の枠組みでファイル・ディレクトリ・コンテナイメージを置き換える）、両者の組み合わせ、Enterprise のみのオーケストレーション（複数 ECU を全体で成功か全体ロールバックにする）がある。差分更新は転送量を減らす手段として言及されるが、詳細は未確認。クライアントは C++ 製で Apache License 2.0。サーバーのライセンス種別は確認できず未確認。Eclipse hawkBit と同様に、デバイスへの更新配布を管理するサーバーの位置づけである。

- [Mender overview](https://docs.mender.io/overview/introduction)
- [mendersoftware/mender](https://github.com/mendersoftware/mender)

## 2. サーバー

運用者は管理 UI または API で成果物（Mender Artifact）を登録し、デバイスへデプロイを作成する。サーバーは複数のリポジトリからなり、GitHub の mender-server にまとまっている。取得した資料から確認できたサービス名は useradm と tenantadm のみで、deployments・inventory・workflows などの名称、データベース、ストレージの製品は未確認。評価用の構成に S3 互換ストレージを示唆するホスト名があるが、製品は未確認。Enterprise 用の構成は有償ライセンスを要する。

- [mendersoftware/mender-server](https://github.com/mendersoftware/mender-server)

## 3. デバイス認証

デバイスは識別属性（MAC アドレスなど）、公開鍵、tier（standard・micro・system）の組を認証セットとして持つ。秘密鍵はデバイスから出ない。認証要求は秘密鍵で署名して送る。認証セットの状態は保留、承認、拒否、事前承認。承認の流れは 2 つある。要求受信後に管理者が承認する方式と、接続前に認証セットを登録する事前承認である。Enterprise ではクライアント証明書による認証（mender-gateway）もある。承認後にサーバーが JWT を発行し、mender-auth が保存して DBus で公開し、mender-update が API 呼び出しごとの Authorization ヘッダーに付ける。期限は既定で 1 週間で、自動更新される。テナントトークンとポーリング間隔は未確認。

- [Device authentication](https://docs.mender.io/overview/device-authentication)

## 4. クライアント

デバイス側は mender-auth（認証・トークン保持）と mender-update（更新の確認・取得・適用・報告）に分かれる。更新確認は定期的にサーバーへ問い合わせる方式で、間隔の既定値は未確認。

## 5. A/B パーティションの更新とロールバック

OS の全体イメージ更新は、非アクティブ側のパーティションに新しいイメージを書き込み、再起動して新しい側から起動する。起動に成功すればデバイスが更新を確定し、失敗すればロールバックする。全体イメージ更新は再起動を要し、差分更新を使わない場合は転送量が多い。ステートスクリプトとブートローダー連携の詳細は未確認。

- [Mender overview](https://docs.mender.io/overview/introduction)

## 6. エディション

Hosted Mender と Enterprise が存在する。Open Source・Professional との機能差と価格は取得した資料で確認できず未確認。

## 7. 実装例：自前のサーバーと組み込みデバイス

| 機能 | 具体的な担い手 |
| --- | --- |
| 運用者 | 管理 UI または API |
| 管理 UI・API、デバイス認証、デプロイ管理 | Mender Server（内部サービスの分け方は未確認） |
| 成果物ストレージ | S3 互換と示唆されるストレージ（製品は未確認） |
| 認証 | デバイス上の mender-auth |
| 更新の確認・適用 | デバイス上の mender-update |
| 更新先とロールバック | A/B の 2 つの OS パーティション |

利用者が自前のサーバーで Mender Server を運用し、Linux 系の組み込みデバイスにクライアントを入れる構成。公式資料に基づく代表例であり、導入事例や動作検証済みの構成ではない。ブートローダー連携、ネットワーク構成、TLS、台数規模は未確認。
