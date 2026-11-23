# Snowflake：JOIN 前後の集約と適応的実行

## 1. 対象と前提

JOIN で膨らむ中間行に対し、事前集約を加えて処理量を抑える適応的な実行を追う。 公式資料を組み合わせた説明用のモデルで、実機の配置や導入事例ではない。

## 2. 構成と役割

- **集計 SQL**：JOIN と GROUP BY を含む分析 SQL を実行する。
- **計画と変換**：クエリを演算子の計画に変換し、集約を別の位置に置く候補を生成する。
- **左側の入力**：結合する一方のテーブルを読む。
- **右側の入力**：結合するもう一方のテーブルを読む。
- **事前集約**：適用可能な場合、JOIN の入力を事前集約して行数を減らす。
- **結合**：入力を JOIN する。キーの重複などにより中間行数が膨らむことがある。
- **最終集約**：必要な最終結果を集約する。
- **実行時の判定**：事前集約が十分有効でない場合は、実行時にその効果を見て無効化する設計。
- **演算の観測**：Query Profile で演算子と入出力行数を確認する。

## 3. 処理の流れ

1. SQL を演算子の計画に変換し、可能な集約配置を検討する。
2. 一部の入力を先に集約し、JOIN と最終集約の中間行数を抑える。
3. 効果が小さい事前集約は実行時に無効化し、Profile で演算を確認する。

JOIN が大量の中間行を生成し、集約後のグループ数が小さい場合、JOIN の片側をあらかじめ集約すると後続演算が扱う行数を減らせる。記事中の例は入力 1 万行から JOIN 後 10 万行に増える計画に対し、事前集約で JOIN 後を 1 万行に抑える。これは説明用の例であり、全クエリで同じ改善率になる意味ではない。

## 4. 留意点

JOIN の種類や集約関数に対して正しさを保てる場合に適用される。事前集約は常に効果があるわけではない。図は片側の例で、すべての計画がこの順序になるわけではない。

## 5. 実装例

Snowflake Virtual Warehouse で JOIN と GROUP BY を含む SQL を実行し、Snowflake の適応的集約配置が適用される場合の論理例。Query Profile で処理行数と演算を比較する。

| 機能 | 担い手 |
| --- | --- |
| 集計 SQL | 集計 SQL |
| 計画と変換 | Snowflake のクエリ最適化 |
| 左側の入力 | 左側テーブル |
| 右側の入力 | 右側テーブル |
| 事前集約 | 追加された Aggregate |
| 結合 | Join オペレーター |
| 最終集約 | 最終 Aggregate |
| 実行時の判定 | 適応的な事前集約 |
| 演算の観測 | Query Profile |

## 公式資料

- [Aggregation Placement の概要](https://www.snowflake.com/en/blog/engineering/aggregation-placement-an-adaptive-query-optimization-for-snowflake/)
- [Optima Planning](https://www.snowflake.com/en/blog/engineering/snowflake-optima-planning-query-performance/)
