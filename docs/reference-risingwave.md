# RisingWave のストリーミング SQL

## 1. 対象

イベントを継続的に取り込み、SQL の結果と状態を更新して提供する。

## 2. 機能配置と処理

イベントをストリームから取り込み、SQL で継続的に処理する。実体化ビューを更新し、利用者が問い合わせる。処理状態は永続ストレージを利用する。

## 3. 設計上の注意

イベント時刻、遅延、再処理、保存期間、ソース・出力先の対応、運用負荷を確認する。

## 4. 実装例

Kafka のストリームから RisingWave が実体化ビューを更新し、SQL クライアントが問い合わせる自己運用例。オブジェクトストレージは S3 互換であり提供元は指定しない。

| 機能 | 担い手 |
|---|---|
| イベントの入力 | Kafka トピック |
| 継続的な SQL 処理 | RisingWave ストリーム処理 |
| 更新されるビュー | RisingWave 実体化ビュー |
| 分析クライアント | SQL クライアント |
| 処理状態の保存 | S3 互換オブジェクトストレージ |

[RisingWave](https://github.com/risingwavelabs/risingwave)、[RisingWave documentation](https://docs.risingwave.com/)。
