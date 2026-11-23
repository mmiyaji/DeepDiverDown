# Snowflake Optima：メタデータ・索引と実行計画

## 1. 対象と前提

問い合わせ履歴を用いる索引・式のメタデータ・実行計画の改善を区別して追う。 公式資料を組み合わせた説明用のモデルで、実機の配置や導入事例ではない。

## 2. 構成と役割

- **問い合わせ**：SQL を実行し結果と実行プロファイルを確認する。
- **利用傾向**：過去のクエリや実行の傾向を分析する。
- **式向けメタデータ**：頻出する式に合わせて追加の区画メタデータを生成し、不要な区画の判定に使う。
- **検索用の索引**：選択性の高い反復検索を検出し、Search Optimization Service を基盤とした索引を自動管理する。
- **実行計画の改善**：過去の実行シグナルを使い、繰り返されるワークロードの計画選択を改善する。
- **通常の区画統計**：区画の列統計を使って読み取り対象を絞る。
- **候補の選択**：通常統計と利用可能な追加メタデータや索引を使い、不要な区画を読み飛ばす。
- **実行計画と演算**：選ばれた計画に従って対象区画を読み、演算結果を返す。
- **区画データ**：テーブルのデータは micro-partition として管理される。

## 3. 処理の流れ

1. SQL を実行し、ワークロードと実行シグナルを観測する。
2. 式のメタデータ、検索用の索引、計画改善をそれぞれ判断する。
3. 利用可能な統計と索引で区画を絞り、改善された計画で読み取る。

通常の min/max では UPPER(column) や先頭ワイルドカードを含む ILIKE などの条件を十分に除外できない場合がある。Optima Metadata は頻出する式を分析し、その式に必要な統計を追加する。Optima Indexing は反復される point lookup に対応する隠れた索引を best-effort で管理する。Planning は過去の実行シグナルを計画選択に戻す。Query Profile の Partitions pruned by Snowflake Optima は Metadata と Indexing の効果を観測する手掛かりである。

## 4. 留意点

これらは異なる最適化であり、すべての問い合わせで同時に有効になるとは限らない。Optima Indexing は best-effort で、手動 Search Optimization と鮮度の保証が異なる。対象 warehouse と提供状況は公式仕様を確認する。各内部データ構造や選択閾値は未公開。

## 5. 実装例

Snowflake の Gen2 standard warehouse 等で実行する管理テーブル上の反復クエリを想定する。Optima が適用対象と判断した場合、式向けメタデータや索引を参照し、過去の実行から計画を改善する。Query Profile で適用を確認する概念例。

| 機能 | 担い手 |
| --- | --- |
| 問い合わせ | SQL と Query Profile |
| 利用傾向 | クエリ履歴・実行情報 |
| 式向けメタデータ | Optima Metadata |
| 検索用の索引 | Optima Indexing |
| 実行計画の改善 | Optima Planning |
| 通常の区画統計 | micro-partition の統計 |
| 候補の選択 | 区画 pruning |
| 実行計画と演算 | Virtual Warehouse の実行 |
| 区画データ | Snowflake 管理テーブル |

## 公式資料

- [Optima Metadata](https://www.snowflake.com/en/blog/engineering/snowflake-optima-metadata-query-pruning/)
- [Optima Planning](https://www.snowflake.com/en/blog/engineering/snowflake-optima-planning-query-performance/)
- [Optima の現行仕様](https://docs.snowflake.com/en/user-guide/snowflake-optima)
- [Optima Indexing の事例](https://www.snowflake.com/en/blog/engineering/snowflake-optima-query-spike-optimization/)
