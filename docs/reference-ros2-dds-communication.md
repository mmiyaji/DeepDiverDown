# ROS 2 と DDS の通信

## 1. 対象

ロボットや自動運転向けの ROS 2 における、publish / subscribe を中心とした通信の例。

## 2. 機能配置と処理

送信ノードがトピックにメッセージを発行し、互換性のある QoS の受信ノードが購読する。ROS middleware interface は選択したミドルウェア実装に接続する。サービスや action は用途の異なる別の通信方式。

## 3. 設計と利用上の注意

ROS 2 は DDS に限定されず RMW 実装を選択できる。QoS の不一致は通信を妨げる。設定だけでリアルタイム性や機能安全が保証されるわけではない。

## 4. 実装例：ROS 2 と DDS による pub/sub

ROS 2 の Publisher と Subscriber が DDS ベースの RMW を介してトピックを交換する例。DDS 実装やプロセス配置は環境による。

| 機能 | 担い手 |
|---|---|
| 送信ノード | ROS 2 Publisher |
| 名前付きの通信 | ROS 2 Topic |
| 受信ノード | ROS 2 Subscriber |
| ミドルウェア接続 | ROS 2 RMW |
| データ配信実装 | DDS / RTPS 実装 |
| 通信品質の方針 | ROS 2 QoS 設定 |

[ROS 2 topics](https://docs.ros.org/en/rolling/Concepts/Basic/About-Topics.html)、[ROS middleware interface](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Different-Middleware-Vendors.html)、[ROS 2 QoS](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Quality-of-Service-Settings.html)。
