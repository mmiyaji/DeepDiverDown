# CARLA の自動運転シミュレーション

## 1. 対象

CARLA のクライアント・サーバー構成で、運転ソフトを仮想環境と接続して検証する。

## 2. 機能配置と処理

シミュレーターが地図・車両・交通と物理を進め、仮想センサーを生成する。外部クライアントは API を通じて状態・センサーを受け取り、制御を送り、結果を評価する。

## 3. 設計と利用上の注意

シミュレーターの再現性と現実のセンサー・車両は同一ではない。シナリオ、時刻同期、バージョンとシミュレーション外の安全検証を確認する。

## 4. 実装例：CARLA Server と運転クライアント

CARLA Server と API クライアントを分離した例。自動運転スタックと評価処理は利用者が選ぶ。

| 機能 | 担い手 |
|---|---|
| 仮想世界と車両 | CARLA Server |
| 仮想センサー | CARLA センサー |
| シミュレーター接続 | CARLA Python / C++ API |
| 運転処理 | 自動運転クライアント |
| 地図・テスト条件 | CARLA マップとシナリオ |
| 観測・評価 | 評価担当・評価処理 |

[CARLA introduction](https://carla.readthedocs.io/en/latest/start_introduction/)、[CARLA sensors](https://carla.readthedocs.io/en/latest/ref_sensors/)。
