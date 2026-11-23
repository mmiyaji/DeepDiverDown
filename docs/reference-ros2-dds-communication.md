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

この例では送信・受信を別ホストとし、それぞれがミドルウェアを実行する。Topic は論理的な名前であり中央ブローカーを意味しない。利用者がホスト、ネットワーク、RMW と QoS を管理する。具体実装と接続条件は未選定で、公式資料を組み合わせた未検証の例である。

[ROS 2 topics](https://docs.ros.org/en/rolling/Concepts/Basic/About-Topics.html)、[ROS middleware interface](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Different-Middleware-Vendors.html)、[ROS 2 QoS](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Quality-of-Service-Settings.html)。

## 5. 実装例：Ubuntu 24.04 の ROS 2 Jazzy・Fast DDS

同じ有線 LAN に接続した 2 台の Ubuntu 24.04 に ROS 2 Jazzy を用意し、`demo_nodes_cpp` の `talker` と `listener` を別ホストで実行する。両側に `RMW_IMPLEMENTATION=rmw_fastrtps_cpp`、同じ `ROS_DOMAIN_ID`、`ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET` を選ぶ。

| 機能配置 | 実装での担い手 |
|---|---|
| Publisher / Subscriber | 送信側 `talker` と受信側 `listener` の別プロセス |
| Topic | `std_msgs/msg/String` を運ぶ `/chatter` |
| RMW と DDS | 各プロセスが使う `rmw_fastrtps_cpp` と Fast DDS |
| QoS | 両端のキューの深さや信頼性の設定 |
| プロセス間通信 | 同一 LAN 上の RTPS。参加者の発見にはマルチキャストが届くネットワークを使う |

利用者が両 Ubuntu ホスト、ROS 2、RMW、Domain ID、QoS と LAN を設定する。公式資料を組み合わせた例であり、本リポジトリで動作検証していない。使用バージョン、マルチキャストとファイアウォールの条件は導入時に確認する。

図の RTPS はネットワーク上の通信を示す。Fast DDS は各プロセス側にあり、トピック用の中央ブローカーは置かない。Domain ID は発見範囲の分類に使われるため、アクセス制御は別に設定する。これはデモの通信構成で、実機での遅延上限や機能安全を示すものではない。

- [ROS 2 Jazzy RMW selection](https://github.com/ros2/ros2_documentation/blob/jazzy/source/How-To-Guides/Working-with-multiple-RMW-implementations.rst)
- [ROS 2 Jazzy discovery range](https://github.com/ros2/ros2_documentation/blob/jazzy/source/Tutorials/Advanced/Improved-Dynamic-Discovery.rst)
- [ROS 2 Jazzy talker](https://github.com/ros2/demos/blob/jazzy/demo_nodes_cpp/src/topics/talker.cpp)
- [ROS 2 Jazzy listener](https://github.com/ros2/demos/blob/jazzy/demo_nodes_cpp/src/topics/listener.cpp)
- [Fast DDS SIMPLE discovery](https://fast-dds.docs.eprosima.com/en/latest/fastdds/discovery/simple.html)
