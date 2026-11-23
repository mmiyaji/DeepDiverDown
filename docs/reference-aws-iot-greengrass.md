# AWS IoT Greengrass のエッジ処理

## 1. 対象

AWS IoT Greengrass V2 でエッジ端末にコンポーネントを配備する構成例。

## 2. 機能配置と処理

AWS IoT Greengrass のクラウド管理から端末上の Greengrass Nucleus にデプロイする。クライアントデバイスはローカル MQTT ブローカーに接続でき、MQTT bridge を設定した場合に AWS IoT Core とメッセージを転送できる。

## 3. 設計と利用上の注意

ローカルブローカー、認証、MQTT bridge は必要なコンポーネントを設定する。切断時の保存や再送は設定と利用条件による。Nucleus は端末側で動作する。

## 4. 実装例：Greengrass V2 と MQTT bridge

AWS IoT Greengrass、AWS IoT Core と現場端末を分けた例。MQTT broker・認証・bridge は別途構成する。

| 機能 | 担い手 |
|---|---|
| 配備の管理 | AWS IoT Greengrass |
| クラウド通信 | AWS IoT Core |
| 端末の実行基盤 | Greengrass Nucleus |
| 現場の処理 | エッジコンポーネント |
| ローカル MQTT | Moquette MQTT broker |
| メッセージ転送 | MQTT bridge |
| クライアントデバイス | センサー / クライアント |

利用者が現場の Linux コア端末、証明書、Nucleus とブローカー、認証・ブリッジ設定を運用する。AWS はクラウドサービス基盤を運用し、利用者は配備やアクセス権を設定する。Client device auth を追加し、ローカル接続の認証と認可を行う。公式資料を組み合わせた未検証例で、現場機器とバージョン・通信条件は導入時に確認する。

[How Greengrass works](https://docs.aws.amazon.com/greengrass/v2/developerguide/how-it-works.html)、[Connect client devices](https://docs.aws.amazon.com/greengrass/v2/developerguide/connect-client-devices.html)、[Create deployments](https://docs.aws.amazon.com/greengrass/v2/developerguide/create-deployments.html)。

## 5. 実装例：Ubuntu ゲートウェイの Greengrass V2 と AWS

AWS IoT Greengrass の公式チュートリアルを基に、Java を備えた Ubuntu Linux の現場ゲートウェイに Nucleus V2 を systemd サービスとして配置する。AWS アカウントには Greengrass の配備管理、IoT Core、カスタム成果物用の S3 バケットを用意する。

| 機能配置 | 実装での担い手 |
|---|---|
| 配備とアーティファクト | AWS IoT Greengrass と Amazon S3。端末の Nucleus が取得して実行する |
| 端末の実行と保存 | Ubuntu ゲートウェイの Nucleus、ローカル SSD の Greengrass root |
| 現場 MQTT と認証 | Moquette と Client device auth。センサーの Thing と X.509 証明書を関連付ける |
| 転送と現場処理 | MQTT bridge が選んだトピックを AWS IoT Core とローカル Pub/Sub に転送。Python コンポーネントがローカル購読する |

AWS がクラウドサービスの基盤を運用し、利用者は配備・データ・権限を操作する。利用者は現場ゲートウェイの OS と各コンポーネントの設定・更新を管理する。この構成は複数の公式資料を組み合わせた未検証例であり、実在の導入例ではない。

ゲートウェイの IoT ポリシー、成果物アクセス用 IAM ロール、クライアントの認証とブローカーの接続先を設定する。ローカル MQTT 接続の可否は証明書とオフライン認証設定に依存する。切断中の観測値保持と再送は、選んだ QoS、スプールとアプリ側の保存設定に依存する。

- [Greengrass nucleus component](https://docs.aws.amazon.com/greengrass/v2/developerguide/greengrass-nucleus-component.html)
- [Greengrass client device tutorial](https://docs.aws.amazon.com/greengrass/v2/developerguide/client-devices-tutorial.html)
- [Greengrass component artifacts on S3](https://docs.aws.amazon.com/greengrass/v2/developerguide/upload-first-component.html)
- [Greengrass client device auth](https://docs.aws.amazon.com/greengrass/v2/developerguide/client-device-auth-component.html)
- [Greengrass MQTT bridge](https://docs.aws.amazon.com/greengrass/v2/developerguide/mqtt-bridge-component.html)
- [Greengrass core connectivity and system service](https://docs.aws.amazon.com/greengrass/v2/developerguide/configure-greengrass-core-v2.html)
- [AWS IoT Core credential provider](https://docs.aws.amazon.com/iot/latest/developerguide/authorizing-direct-aws.html)
