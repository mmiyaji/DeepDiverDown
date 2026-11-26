# Snowflake のクエリ性能とウェアハウス

## 1. 計測の入口

同じ注文集計でも、待ち時間、実行中のスキャン量、結果の再利用の有無を分けて調べる。実行の実績は Query History（待ち時間）と Query Profile（読んだ区画数、演算子ごとの行数、spill）で確認する。図の区画と数値は説明用。2026 年 11 月時点の公式資料に基づく。

## 2. 同時実行とコンピュート

マルチクラスターウェアハウスは同時実行需要に応じてクラスターを増減させる選択肢で、最小と最大の間の動きは設定と利用状況に依存する。単一の重いクエリの改善には、スキャン量・演算内容・ウェアハウスサイズなどを別途調べる。

## 3. 区画の絞り込みと任意の最適化

Snowflake はマイクロパーティションごとに値の範囲などを記録する。日付条件から該当し得ない区画を除外する。値の範囲が区画間で大きく重なると、同じ条件で読まれる区画が増える。結合から得たフィルターで実行時に区画を減らす動的 pruning と、`ORDER BY` と `LIMIT` で残りが上位 K 件に入らないと判断できたときに読み取りを止める Top-K pruning は、実行資源の中で働く。

追加の絞り込みは任意で、別々の機能である。

- **Search Optimization**：有効化した対象に検索用の access path を作り、値が含まれ得る区画の候補を絞る。構築・維持に計算とストレージの費用がかかる。
- **Optima Metadata**：頻出する式（`UPPER` を含む条件など）の統計を自動生成する。Optima は全エディションに含まれるが、Metadata・Indexing・Planning は Gen2 standard warehouse と Adaptive Warehouse が対象である。Optima Indexing は best-effort で、鮮度を保証したい場合は Search Optimization を直接設定する。Query Profile の「Partitions pruned by Snowflake Optima」で効果を確認できる。
- **Query Acceleration Service**：Enterprise Edition 以上で、ウェアハウスに有効化する。対象となったクエリの一部を共有計算資源へオフロードする。すべてのクエリが対象になるわけではない。

## 4. 二種類のキャッシュ

永続化クエリ結果は、同じクエリ、データ、権限などの条件を満たす場合に結果全体を再利用する。通常 24 時間保持され、再利用のたびに延びるが最初の実行から最大 31 日である。条件を満たしても再利用は保証されない。ウェアハウスのデータキャッシュは、稼働中の同じウェアハウスの後続クエリで使える表データで、ウェアハウス停止時に消える。有効期間と測定時の前提を混同しない。

## 図で確認するシナリオ

- **条件で絞り、実行し、結果を再利用する** — 日付の範囲が重ならない区画を除外する。 → 検索用の補助構造と追加統計で候補をさらに絞る。 → 空いたクラスターで実行し、キャッシュと QAS を使える場合は使う。 → Query Profile で読んだ区画数を確認し、再利用条件を満たす同じ要求には保存済みの結果を返す。

## 公式資料

- [マイクロパーティション](https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions)
- [マルチクラスターウェアハウス](https://docs.snowflake.com/en/user-guide/warehouses-multicluster)
- [永続化されたクエリ結果](https://docs.snowflake.com/en/user-guide/querying-persisted-results)
- [Search optimization](https://docs.snowflake.com/en/user-guide/search-optimization-service)
- [Optima](https://docs.snowflake.com/en/user-guide/snowflake-optima)
- [Query Acceleration Service](https://docs.snowflake.com/en/user-guide/query-acceleration-service)
- [ウェアハウスのキャッシュ](https://docs.snowflake.com/en/user-guide/performance-query-warehouse-cache)
- [Query Profile](https://docs.snowflake.com/en/user-guide/ui-snowsight-activity)

## 5. 実装例 Snowflake Enterprise の BI 負荷調査

BI 専用のマルチクラスターウェアハウスで、待ち時間、区画の読み取り、結果再利用を調べる例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| BI クエリ | 注文集計 SQL クライアント | 注文日を条件に、同一の SQL を実行する。 |
| クエリ受付と計画 | Snowflake Cloud Services | クエリを受付け、計画や結果再利用の判断を調整する。 |
| 実行待ち行列 | BI_WH マルチクラスターウェアハウス | 最小・最大クラスター数とスケーリングポリシーを設定する。 |
| ウェアハウスの実行資源 | BI_WH のクラスター | 区画の読み取りと集計を実行する。 |
| ウェアハウスのデータキャッシュ | BI_WH のデータキャッシュ | 稼働中の後続クエリで使え、停止時に破棄される。 |
| 検索用の補助構造 | Search Optimization の access path（任意） | 有効化した場合だけ使う。維持費がかかる。 |
| 式ごとの追加統計 | Optima Metadata（対象環境） | Gen2 standard warehouse などで自動生成される。 |
| Query Acceleration Service | QAS（任意） | 有効化した場合、対象クエリの一部をオフロードする。 |
| Query Profile | Snowsight Query Profile | 区画数、行数、spill を確認する。 |
| 区画メタデータ・列指向のストレージ区画 | Snowflake ORDERS のマイクロパーティション | サービスが管理する区画メタデータで不要な区画を除外する。 |
| 永続化済み結果 | Snowflake の永続化クエリ結果 | 同一クエリなど、再利用の条件を満たすときに使う。 |

調査では `QUEUED_OVERLOAD_TIME` と `PARTITIONS_SCANNED` を別々に比較する。マルチクラスターは主に並行クエリの需要に対応する構成である。永続化結果を使える条件も確認する。

BI の Snowflake ロールに `BI_WH` の使用と注文データの参照を許可する。永続化済みの SELECT 結果を再利用する際も、ロールにはクエリが参照したすべてのテーブルへのアクセス権が必要になる。データ更新やマイクロパーティションの変更も再利用条件に影響する。

出典 [マイクロパーティション](https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions)、[マルチクラスターウェアハウス](https://docs.snowflake.com/en/user-guide/warehouses-multicluster)、[永続化されたクエリ結果](https://docs.snowflake.com/en/user-guide/querying-persisted-results)、[QUERY_HISTORY ビュー](https://docs.snowflake.com/en/sql-reference/account-usage/query_history)

Snowflake が計算・ストレージ・Cloud Services の基盤を運用する。利用者は BI_WH のサイズ、最小・最大クラスター数やスケーリング方針を設定し、権限に応じて Query History を参照できる。パーティションや保存済み結果はサービスが管理し、内部ノードを利用者が直接操作するものではない。結果再利用は公式資料の条件に依存し、同一 SQL だけで保証されない。この調査手順・数値は例示であり実環境での性能検証は行っていない。[Snowflake architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts)

## パフォーマンス最適化の調査メモ

### まず遅い箇所を分ける

Query History で実行待ちと実行時間を区別し、Query Profile の TableScan、Join、Aggregate、Sort などの演算子を確認する。TableScan の `Partitions scanned` / `Partitions total`、読み取った量、Join の入出力行数、ローカル・リモートへの spill に着目する。全件集計のように多くの行が必要な処理では、区画を除外できなくても直ちに異常とは限らない。[Query Profile](https://docs.snowflake.com/en/user-guide/ui-snowsight-activity)

| 症状 | 主な確認点 | 検討する方向 |
|---|---|---|
| 同時実行時だけ遅い | 待ち行列、同時実行数、ウェアハウス負荷 | 負荷の分離、マルチクラスターによる並行処理。単一クエリの高速化とは分ける |
| 対象を絞っても多くを読む | TableScan の区画数、条件とデータ分布、列の読み取り | 条件・データ配置の見直し、必要な場合にクラスタリングや Search Optimization を評価 |
| Join や集計で処理量が増える | Join 前後の行数、キーの型、重複、spill | 意図しない多対多結合、不要な列や行、キーの型変換を確認 |
| ローカル・リモートへ spill | どの演算子で中間結果が増えたか | SQL やバッチの見直し、必要に応じてより大きなウェアハウスを評価 |
| 同じ SQL の速度が安定しない | 結果キャッシュ、ウェアハウスの状態、負荷 | 再利用条件と測定条件を揃え、複数回比較 |

spill の計測では、Query Acceleration Service が有効な場合、対象となるクエリで少量のリモートストレージ書き込みが発生し得る点に注意する。[メモリ不足と spill](https://docs.snowflake.com/en/user-guide/performance-query-warehouse-memory)

### 読み取りを減らす仕組み

- **静的・動的 pruning**：コンパイル時には条件と区画メタデータを使い、実行時には結合から得たフィルターを利用できる。区画ごとの値域が検索条件と重ならなければ読み取りを省ける。[性能ガイド](https://www.snowflake.com/en/developers/guides/performance/)
- **列の読み取り**：マイクロパーティション内で列は独立して保存されるため、必要な列だけを選ぶことで読み取り量を抑えられる。[マイクロパーティション](https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions)
- **クラスタリング**：よく使うフィルターとデータの配置を対応させ、区画ごとの値域を絞る。自動再クラスタリングは計算費用が発生し、書き換えに伴う保存費用にも注意する。[ストレージの性能最適化](https://docs.snowflake.com/en/user-guide/performance-query-storage)
- **Search Optimization Service**：選択性の高い等値検索、文字列、VARIANT、地理空間など、対応する検索に有効。補助構造の作成・維持に計算とストレージの費用がかかる。頻繁な更新や再クラスタリングは維持費を増やし得る。[最適化の選択肢](https://docs.snowflake.com/en/user-guide/performance-query-options)、[費用の見積もり](https://docs.snowflake.com/en/user-guide/search-optimization/cost-estimation)
- **Top-K pruning**：対応条件を満たす `ORDER BY` と `LIMIT` の組み合わせでは、残りの区画が上位 K 件に入らないと判断できた時点で読み取りを省ける。対象の型や NULL の順序などの条件を確認する。[Top-K pruning](https://docs.snowflake.com/en/user-guide/querying-top-k-pruning-optimization)
- **Optima Metadata**：クエリで頻出する式に応じたメタデータを生成し、通常の統計だけでは絞り込みにくい条件の pruning を改善する。公開記事が説明する機能であり、提供状況は利用環境の最新資料で確認する。[Optima Metadata](https://www.snowflake.com/en/blog/engineering/snowflake-optima-metadata-query-pruning/)

### 計算・再利用・事前計算

ウェアハウスの**サイズ変更**は、個々のクエリに利用できる計算資源やメモリを増やす選択肢である。**マルチクラスター**は主に同時要求の処理能力を増やし、同じ単一クエリに追加クラスターを自動投入する意味ではない。いずれも利用料金と実測結果を比較する。[ウェアハウスの性能](https://docs.snowflake.com/en/user-guide/performance-query-warehouse)

**永続化クエリ結果**は、同じクエリ、データ、権限などの再利用条件を満たした場合に実行を省略する。通常 24 時間保持され、再利用のたびに期間が更新されるが、最初の実行から最大 31 日。条件を満たしても再利用は保証されない。ウェアハウス側のデータキャッシュとは別に扱う。[永続化されたクエリ結果](https://docs.snowflake.com/en/user-guide/querying-persisted-results)、[ウェアハウスのキャッシュ](https://docs.snowflake.com/en/user-guide/performance-query-warehouse-cache)

**Materialized View** は対象となる計算結果を事前に保持し、対応するワークロードで読み取りを減らせる。**Dynamic Table** は定義したクエリの結果を目標遅延に基づき更新する仕組みであり、更新時間・費用と鮮度の要件を一緒に評価する。**Query Acceleration Service** は対象クエリの一部を共有計算資源へオフロードする別の選択肢である。いずれも適用範囲や追加費用を確認する。[性能最適化の選択肢](https://docs.snowflake.com/en/user-guide/performance-query-options)、[Dynamic Tables の概要](https://docs.snowflake.com/en/user-guide/dynamic-tables-about)

### 比較・検証の手順

1. 対象 SQL、データ量、結果、権限、ウェアハウスサイズ、同時実行数を記録する。
2. `USE_CACHED_RESULT` とウェアハウス再開状況を含むキャッシュ条件を揃え、待ち時間と実行時間を別々に比較する。
3. Query Profile の区画数、Join 前後の行数、spill、処理時間を比較し、どの演算子が改善したか確認する。
4. クラスタリング・Search Optimization・事前計算を導入する場合は、維持費やストレージを含む総費用と、更新頻度・データの鮮度を比較する。

クエリ最適化は随時改善される。固定的なルールとして扱わず、[性能改善のリリースノート](https://docs.snowflake.com/en/release-notes/performance-improvements-2025)と実際の Query Profile を確認する。

### 関連する公式動画

- [Automatic Clustering Updates](https://www.youtube.com/watch?v=wA5kNjV4z34)（Snowflake Developers、2024 年）：動画の説明では、マイクロパーティション、クラスタリング、費用見積もりとデモを扱う。
- [Optimized Network Encryption | Built[By] Bowei Chen](https://www.youtube.com/watch?v=XizKA_k1rMA)（Snowflake Inc.、2024 年）：動画の説明では、計算ノード間の暗号化処理を最適化した事例を扱う。

上記は公開された動画説明に基づく候補で、字幕・内容全体は未確認。改善の数値を一般的な性能保証として扱わない。
