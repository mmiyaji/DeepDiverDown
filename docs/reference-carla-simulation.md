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

この例では CARLA Server と運転クライアントを別の利用者管理ホストで実行する。利用者はホスト、ネットワーク、CARLA、試験クライアントと記録を管理する。センサーはシミュレーター内の仮想センサーである。公式資料を組み合わせた未検証の例であり、ホスト性能、クライアント実装とネットワークは未選定。

[CARLA introduction](https://carla.readthedocs.io/en/latest/start_introduction/)、[CARLA sensors](https://carla.readthedocs.io/en/latest/ref_sensors/)。

## 5. 実装例：Linux GPU ホストの CARLA・同期 Python クライアント

CARLA 0.9.15 のサーバーを NVIDIA GPU 付き Linux ホストの Docker で実行する。NVIDIA Container Toolkit で GPU を渡し、オフスクリーン描画を使う。別の Linux ホストで同じ 0.9.15 の Python API を使う試験プログラムを動かし、隔離した LAN 内でサーバーの既定 TCP 2000・2001 に接続する。

| 機能配置 | 実装での担い手 |
|---|---|
| 仮想世界と車両・センサー | CARLA Server の仮想マップ、車両、カメラや LiDAR |
| シミュレーター接続と運転処理 | 別ホスト上の Python クライアントと CARLA Python API |
| テスト条件と時刻 | マップ・アクター設定、同期モード、固定タイムステップ。指定した一つのクライアントが tick を送る |
| 評価資料 | Recorder がサーバー側に書くアクター状態のバイナリ記録。コンテナ外の領域に保存する |

利用者が両 Linux ホスト、GPU ランタイム、CARLA、クライアント、隔離 LAN と記録先を管理する。公式資料を組み合わせた代表構成であり、本リポジトリで動作検証していない。GPU・ドライバー、コンテナ、CARLA と Python API の互換性は実行時に確認する。

Recorder の記録はシミュレーションの状態を再現するために使う。カメラ画像などのセンサー出力が必要なら、クライアントが別途保存する。実車・車載バスへの接続を含まず、結果は実車の性能や機能安全を保証しない。

- [CARLA 0.9.15 Docker guide](https://carla.readthedocs.io/en/0.9.15/build_docker/)
- [CARLA 0.9.15 quick start](https://carla.readthedocs.io/en/0.9.15/start_quickstart/)
- [CARLA synchrony and time-step](https://carla.readthedocs.io/en/0.9.15/adv_synchrony_timestep/)
- [CARLA sensors](https://carla.readthedocs.io/en/0.9.15/ref_sensors/)
- [CARLA recorder](https://carla.readthedocs.io/en/0.9.15/adv_recorder/)
