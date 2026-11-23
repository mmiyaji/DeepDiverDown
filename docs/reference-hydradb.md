# HydraDB のオブジェクトストレージ型グラフ

## 1. 対象

グラフの問い合わせと非同期インデックスを分け、状態をオブジェクトストレージに保持する。

## 2. 機能配置と処理

問い合わせノードはグラフの読み書きと問い合わせを受ける。インデクサーは保存されたデータからインデックスを生成し、オブジェクトストレージに公開する。

## 3. 設計上の注意

S3 互換ストレージを AWS の S3 と同一視しない。レイテンシ、整合性モード、障害復旧、運用成熟度とライセンスを確認する。

## 4. 実装例

HydraDB の graph-node と graph-indexer が S3 互換オブジェクトストレージを共有する自己運用の例。具体的なストレージ製品と配置先は固定しない。

| 機能 | 担い手 |
|---|---|
| グラフ利用者 | Bolt / HTTPS クライアント |
| 問い合わせと更新 | HydraDB graph-node |
| 永続データとログ | S3 互換オブジェクトストレージ |
| インデックス構築 | HydraDB graph-indexer |
| 探索用インデックス | 保存されたグラフ索引 |

[HydraDB architecture](https://github.com/hydra-db/hydradb/blob/main/architecture.md)、[HydraDB](https://github.com/hydra-db/hydradb)。
