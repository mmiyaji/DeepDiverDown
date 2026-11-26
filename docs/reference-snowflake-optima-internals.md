# Snowflake Optima：区画の読み取りと再配置

## 1. 対象と前提

Optima は、問い合わせ履歴を使う自動最適化の総称である。この図は 2 つを扱う。1 つは、読む区画を減らす Optima Metadata、Optima Indexing、Optima Planning。もう 1 つは、クラスタリングキーに沿って区画を再配置する Automatic Clustering の Classic と Optima Clustering の違いである。2026 年 11 月時点の公式資料に基づく。公式資料を組み合わせた説明用のモデルで、実機の配置や導入事例ではない。

## 2. 構成と役割

- **問い合わせ**：SQL を実行し結果と実行プロファイルを確認する。
- **利用傾向**：過去のクエリや実行の傾向を分析する。
- **式向けメタデータ**：頻出する式に合わせて追加の区画メタデータを生成し、不要な区画の判定に使う。
- **検索用の索引**：選択性の高い反復検索を検出し、Search Optimization Service を基盤とした索引を自動管理する。
- **実行計画の改善**：過去の実行シグナルを使い、繰り返されるワークロードの計画選択を改善する。
- **候補の選択**：区画の列統計と、利用可能な追加メタデータや索引を使い、不要な区画を読み飛ばす。
- **実行計画と演算**：選ばれた計画に従って対象区画を読み、演算結果を返す。
- **区画データ**：テーブルのデータは micro-partition として管理され、区画ごとの列統計を持つ。
- **クラスタリングキー**：列や式で区画の並べ方を指定する。キーの自動選択（AUTO）は 2026 年 10 月の発表時点で private preview である。

## 3. 処理の流れ

1. SQL を実行し、ワークロードと実行シグナルを観測する。
2. 式のメタデータ、検索用の索引、計画改善をそれぞれ判断する。
3. 通常の統計と利用可能な追加情報で区画を絞り、改善された計画で読み取る。
4. 別の流れとして、クラスタリングキーを持つ表の区画が再配置される。

通常の min/max では `UPPER(column)` や先頭ワイルドカードを含む `ILIKE` などの条件を十分に除外できない場合がある。Optima Metadata は頻出する式を分析し、その式に必要な統計を追加する。Optima Indexing は反復される point lookup に対応する隠れた索引を best-effort で管理する。Optima Planning は過去の実行シグナルを計画選択に戻す。Metadata・Indexing・Planning は Gen2 standard warehouse と Adaptive Warehouse が対象である。Query Profile の「Partitions pruned by Snowflake Optima」は Metadata と Indexing の効果を観測する手掛かりである。

### Classic と Optima Clustering の違い

| 観点 | Classic | Optima Clustering |
| --- | --- | --- |
| 対象の表 | 既存のクラスタリング済み表（継続） | 2026 年 9 月以降の新規のクラスタリング表 |
| 区画の選ぶ方法 | 2024 年の公開記事：width・depth とレベルで重なりの大きい区画をバッチにまとめる | 重要なデータを優先する。具体的な手順は未確認 |
| 競合の扱い | 作業後のコミット直前に対象区画への並行 DML を確認し、競合した実行はロールバックする | 未確認 |
| キー長 | 各キー列の先頭 5 バイト | キー列全体で最大 1 KB |
| 課金 | 主にコンピュート消費 | 取り込んだ非圧縮データ量と overlap factor |

Classic は区画の値域が重なる数（width）と、ある値に重なる区画数（depth）を使い、LSM-tree を参考にしたレベルで再配置の回数をおおむね表す。選択ジョブと実行ジョブを分け、低いレベルを優先して固定サイズのバッチにまとめる。ALTER TABLE でキーを変えても Optima には移行せず、移行コマンドもない。方式は `SYSTEM$CLUSTERING_INFORMATION` の version（CLASSIC か OPTIMA）で確認する。Optima では `total_constant_partition_count` と `partition_depth_histogram` は使えない。費用は `AUTOMATIC_CLUSTERING_HISTORY` の VERSION と CREDITS_USED で確認する。

## 4. 留意点

これらは別々の最適化で、すべての問い合わせで同時に有効になるとは限らない。Optima Indexing は best-effort で、手動の Search Optimization と鮮度の保証が異なる。Optima Clustering の区画選択、データ構造、競合検証の内部は公開されていない。WAIR 論文（Workload-Aware Incremental Reclustering）は検索範囲の境界の区画を対象とする研究試作で、製品版 Optima と同一とは確認されていない。各内部データ構造や選択閾値は未確認である。課金と提供状況は公式の仕様と Service Consumption Table を確認する。

## 5. 実装例

Snowflake の Gen2 standard warehouse 等で実行する管理テーブル（ORDERS）上の反復クエリを想定する。Optima が適用対象と判断した場合、式向けメタデータや索引を参照し、過去の実行から計画を改善する。ORDERS にクラスタリングキーを設定すると、Snowflake がバックグラウンドで再配置する。Classic の選択・実行ジョブは資料上の論理役割で、利用者が直接操作するサーバーではない。Query Profile で適用を確認する概念例である。

| 機能 | 担い手 |
| --- | --- |
| 問い合わせ | SQL と Query Profile |
| 利用傾向 | クエリ履歴・実行情報 |
| 式向けメタデータ | Optima Metadata |
| 検索用の索引 | Optima Indexing |
| 実行計画の改善 | Optima Planning |
| 候補の選択 | 区画 pruning |
| 実行計画と演算 | Virtual Warehouse の実行 |
| 区画データ | Snowflake 管理テーブルと区画統計 |
| クラスタリングキー | ORDERS のクラスタリングキー（利用者が指定） |
| Classic の再配置 | Classic Automatic Clustering |
| Optima Clustering | Optima Clustering |

## 公式資料・研究論文

- [Optima の現行仕様](https://docs.snowflake.com/en/user-guide/snowflake-optima)
- [Optima Metadata](https://www.snowflake.com/en/blog/engineering/snowflake-optima-metadata-query-pruning/)
- [Optima Planning](https://www.snowflake.com/en/blog/engineering/snowflake-optima-planning-query-performance/)
- [Optima Indexing の事例](https://www.snowflake.com/en/blog/engineering/snowflake-optima-query-spike-optimization/)
- [Automatic Clustering at Snowflake（2024 年の内部構造）](https://www.snowflake.com/en/blog/engineering/automatic-clustering-at-snowflake/)
- [Automatic Clustering の仕様と費用](https://docs.snowflake.com/en/user-guide/tables-auto-reclustering)
- [Optima Clustering の発表](https://www.snowflake.com/en/blog/engineering/introducing-snowflake-optima-clustering/)
- [SYSTEM$CLUSTERING_INFORMATION](https://docs.snowflake.com/en/sql-reference/functions/system_clustering_information)
- [Workload-Aware Incremental Reclustering（研究試作）](https://arxiv.org/html/2602.23289)
