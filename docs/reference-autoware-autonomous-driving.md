# Autoware の自動運転処理

## 1. 対象

Autoware のモジュール構成を使って、自動運転の観測から制御指令までの情報の流れを整理する。

## 2. 機能配置と処理

センサー値を前処理し、認識は物体や信号を捉える。自己位置推定はセンサーと地図を用いる。計画は認識、位置、地図に基づき軌道を作り、制御と車両インターフェースが車両へ指令を送る。

## 3. 設計と利用上の注意

構成やアルゴリズムは車両・センサー・運行設計によって異なる。Autoware の利用やシミュレーション成功だけで実車の機能安全や安全運行は保証されない。

## 4. 実装例：Autoware のモジュール構成例

Autoware の説明に基づく機能例。実際のセンサー、車両固有インターフェースとアルゴリズムは環境ごとに異なる。

| 機能 | 担い手 |
|---|---|
| センサーデータ取得 | Autoware Sensing |
| 周辺の認識 | Autoware Perception |
| 走行軌道の計画 | Autoware Planning |
| 軌道追従の制御 | Autoware Control |
| 車両インターフェース | Autoware Vehicle Interface |
| センサー | LiDAR・カメラ・GNSS / IMU |
| 自己位置推定 | Autoware Localization |
| 地図 | Autoware 地図 |
| 車両・アクチュエーター | 車両の制御対象 |

この例は利用者が管理する車載計算機上の Autoware と、実車のセンサー・制御対象を区別する。利用者が計算機、地図、センサー接続と車両固有インターフェースを選定・管理する。具体機種や車載ネットワークは未選定であり、公式資料を組み合わせた未検証の代表構成である。

[Autoware module overview](https://autowarefoundation.github.io/AWSIM-Labs/main/Introduction/Autoware/)、[Autoware Core](https://autowarefoundation.github.io/autoware_core/main/)。

## 5. 実装例：Ubuntu 上の Autoware・AWSIM Labs

AWSIM Labs の公式 E2E デモに基づく構成例。Ubuntu 22.04 の NVIDIA GPU 搭載ワークステーション上で AWSIM Labs と ROS 2 Humble の Autoware を起動する。Autoware の `e2e_simulator.launch.xml` で AWSIM Labs 用の車両・センサーキットと西新宿の地図を選ぶ。

| 機能配置 | 実装での担い手 |
|---|---|
| 車両と観測 | AWSIM Labs 内の仮想 Lexus RX 450h、仮想 LiDAR・カメラ・GNSS・IMU |
| センシング・認識・自己位置 | Autoware の ROS 2 モジュール |
| 軌道・制御 | Autoware Planning、Control、AWSIM 用 Vehicle Interface |
| 地図 | デモに対応する点群 PCD と Lanelet2 OSM |
| プロセス間の接続 | ROS 2 Humble と Cyclone DDS。公式デモではループバックを使う |

利用者がワークステーション、Autoware、AWSIM Labs、DDS 設定と地図を管理する。資料を組み合わせた構成であり、本リポジトリで動作検証したものではない。対応バージョン、GPU、地図と設定は実行時に確認する。AWSIM は名前に AWS を含むが、この例はローカル実行であり AWS クラウドを前提としない。

車両インターフェースの制御先はシミュレーター内の車両モデルである。実車ではセンサーやアクチュエーターの接続、車両固有の制御、検証環境が別途必要になる。デモでの走行結果は実車の機能安全や性能の根拠にはならない。

- [AWSIM Labs Quick Start Demo](https://autowarefoundation.github.io/AWSIM-Labs/main/GettingStarted/QuickStartDemo/)
- [AWSIM Labs architecture](https://autowarefoundation.github.io/AWSIM-Labs/main/Introduction/AWSIM/)
- [Autoware module overview](https://autowarefoundation.github.io/AWSIM-Labs/main/Introduction/Autoware/)
