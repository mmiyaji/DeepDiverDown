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

[How Greengrass works](https://docs.aws.amazon.com/greengrass/v2/developerguide/how-it-works.html)、[Connect client devices](https://docs.aws.amazon.com/greengrass/v2/developerguide/connect-client-devices.html)、[Create deployments](https://docs.aws.amazon.com/greengrass/v2/developerguide/create-deployments.html)。
