# Snowflake：Classic と Optima Clustering の内部

## 1. 対象と確度

Automatic Clustering はサービス名で、Classic と Optima はその二方式。Classic の内部説明は 2024 年の Snowflake 技術記事に基づく。Optima の資料は優先付けなどの公開説明に留まり、同じジョブ・レベル・ロック構造を使うと断定できない。図の値域、部品の配置と実行例は概念例で、実環境を検証したものではない。

## 2. 構成と処理

- **設定と確認**：キーを設定し、テーブルの方式と費用・クエリ性能を確認する。
- **クラスタリングキー**：列や式で整理の基準を指定する。キーの自動選択は公開状況を確認する。
- **新方式の再配置**：Optima の内部手順は未公開。性能に重要なデータを優先すると説明される。
- **方式と費用の観測**：方式は SYSTEM$CLUSTERING_INFORMATION、利用費用は AUTOMATIC_CLUSTERING_HISTORY で確認する。
- **区画の重なりの評価**：Classic の説明では width・depth と各 level の集計値を使い、区画の重なりを評価する。
- **対象区画の選択**：Classic の説明では重なりの大きい区画を同じバッチにまとめる。
- **対象区画の再配置**：選んだバッチを読み、ソートし、新しい区画を上位レベルに作る。
- **コミット前の競合確認**：Classic の説明では対象区画への並行 DML を確認し、競合時は実行をロールバックする。
- **再配置前の区画**：書き込み後の区画はキーの値域が互いに重なる場合がある。
- **再配置後の区画**：区画を読み直して新しい区画を作り、成功時に表の状態へ反映する。
- **区画の値域と表の状態**：各区画の統計とテーブルの状態。読み取りでは候補の絞り込みにも使う。
- **並行する更新**：ユーザーの DML が対象区画を変更すると Classic の競合確認に影響し得る。

## 3. Classic の区画選択とレベル

2024 年の記事は、値域が重なる区画数である width と、ある値に重なる区画数である depth を使い、選択と実行を別ジョブとして説明する。LSM-tree を参考にしたレベルは再配置の回数をおおむね表す。低いレベルを優先し、十分に重なる区画を固定サイズのバッチにまとめる。実行ジョブが対象を読み、ソートし、新しい区画を上位レベルへ入れる。既に整理した区画の再書き込みを抑え、段階的に配置を改善する。これは現行 Optima の実装を証明しない。

## 4. Classic の並行更新

記事によれば、クラスタリング処理は事前に対象テーブルを長時間ロックせず、作業後のコミット直前に必要なロックを取り、対象区画が並行 DML で更新されていないか検証する。競合した実行はロールバックする。再試行の詳細や Optima の実装は公開資料だけでは特定しない。

## 5. Optima と Classic の公開された違い

Optima は重要なデータを優先する新しいクラスタリング方式と説明されているが、具体的な対象選択・レベル管理・競合制御は今回確認した資料では不明。Classic は各キー列の先頭 5 バイト、Optima はキー列全体で最大 1 KB を使う。2026 年 9 月以降の新規 clustered tables は Optima、既存の Classic は継続する。ALTER TABLE によるキー変更で Optima に移行するわけではなく、移行コマンドもない。キーの AUTO 選択は 2026 年 10 月の公式発表時点で private preview。Optima は非圧縮取り込み量と overlap factor に基づき課金し、Classic の主な課金基準はコンピュート消費。キー変更の一時費用やストレージへの影響にも注意する。

## 6. 実装例と運用確認

利用者が Snowflake 管理の ORDERS テーブルにキーを設定し、Snowflake が必要に応じてバックグラウンドで管理する。Classic の区画選択と実行ジョブは資料上の論理役割で、直接操作できるサーバーや独立サービスの配置を示さない。Optima 側は非公開内部を箱として示す。

| 機能 | この例の担い手 | 内容 |
| --- | --- | --- |
| 設定と確認 | 利用者の SQL と Snowsight | キーを設定し、テーブルの方式と費用・クエリ性能を確認する。 |
| クラスタリングキー | ORDERS の clustering key | 列や式で整理の基準を指定する。キーの自動選択は公開状況を確認する。 |
| 新方式の再配置 | Optima Clustering（内部は非公開） | Optima の内部手順は未公開。性能に重要なデータを優先すると説明される。 |
| 方式と費用の観測 | Snowflake の利用履歴と関数 | 方式は SYSTEM$CLUSTERING_INFORMATION、利用費用は AUTOMATIC_CLUSTERING_HISTORY で確認する。 |
| 区画の重なりの評価 | Classic の区画統計・レベル | Classic の説明では width・depth と各 level の集計値を使い、区画の重なりを評価する。 |
| 対象区画の選択 | Classic の partition-selection job | Classic の説明では重なりの大きい区画を同じバッチにまとめる。 |
| 対象区画の再配置 | Classic の clustering-execution job | 選んだバッチを読み、ソートし、新しい区画を上位レベルに作る。 |
| コミット前の競合確認 | Classic の楽観的競合確認 | Classic の説明では対象区画への並行 DML を確認し、競合時は実行をロールバックする。 |
| 再配置前の区画 | ORDERS の既存 micro-partitions | 書き込み後の区画はキーの値域が互いに重なる場合がある。 |
| 再配置後の区画 | ORDERS の新しい micro-partitions | 区画を読み直して新しい区画を作り、成功時に表の状態へ反映する。 |
| 区画の値域と表の状態 | Snowflake 管理の区画メタデータ | 各区画の統計とテーブルの状態。読み取りでは候補の絞り込みにも使う。 |
| 並行する更新 | 利用者による並行 DML | ユーザーの DML が対象区画を変更すると Classic の競合確認に影響し得る。 |

SYSTEM$CLUSTERING_INFORMATION の version は CLASSIC / OPTIMA を示す。Optima では total_constant_partition_count と partition_depth_histogram は利用できない。AUTOMATIC_CLUSTERING_HISTORY の VERSION と CREDITS_USED、Query Profile の scanned / total を実行条件と併せて確認する。

## 7. 関連研究と未公開部分

WAIR 論文は検索範囲の境界の区画を対象とし、読み取りの削減と再配置費用を比較する研究試作。Snowflake 研究者が共著者にいるが、論文には製品版 Optima と同一だという確認はない。Optima の具体的な区画選択、データ構造、競合検証、データの粒度ごとの優先度は本モデルでは未特定とする。

## 公式資料・研究論文

- [Automatic Clustering at Snowflake（2024年の内部構造）](https://www.snowflake.com/en/blog/engineering/automatic-clustering-at-snowflake/)
- [Automatic Clustering の仕様と費用](https://docs.snowflake.com/en/user-guide/tables-auto-reclustering)
- [Optima Clustering の発表](https://www.snowflake.com/en/blog/engineering/introducing-snowflake-optima-clustering/)
- [Clustering Keys](https://docs.snowflake.com/en/user-guide/tables-clustering-keys)
- [SYSTEM$CLUSTERING_INFORMATION](https://docs.snowflake.com/en/sql-reference/functions/system_clustering_information)
- [Workload-Aware Incremental Reclustering（研究試作）](https://arxiv.org/html/2602.23289)
