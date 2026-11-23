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

[Autoware module overview](https://autowarefoundation.github.io/AWSIM-Labs/main/Introduction/Autoware/)、[Autoware Core](https://autowarefoundation.github.io/autoware_core/main/)。
