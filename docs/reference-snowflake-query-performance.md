# Snowflake のクエリ性能とウェアハウス

## 1. 計測の入口

同じ注文集計でも、待ち時間、実行中のスキャン量、結果の再利用の有無を分けて調べる。図の区画と数値は説明用。

## 2. 同時実行とコンピュート

マルチクラスターウェアハウスは同時実行需要に応じてクラスターを増減させる選択肢で、最小と最大の間の動きは設定と利用状況に依存する。単一の重いクエリの改善には、スキャン量・演算内容・ウェアハウスサイズなどを別途調べる。

## 3. マイクロパーティション

Snowflake はマイクロパーティションごとに値の範囲などを記録する。日付条件から該当し得ない区画を除外する。値の範囲が区画間で大きく重なると、同じ条件で読まれる区画が増える。

## 4. 結果の再利用

条件を満たす反復クエリでは永続化された過去の結果を使える。元データや設定の変化、権限、クエリの一致条件を確認する。プロファイルを比較する場合はキャッシュの影響を制御する。

## 図で確認するシナリオ

- **日付フィルターで読む区画を減らす** — 1月25日以降の注文を指定し、日付の範囲が重ならない区画を除外する。 → クエリを実行できるクラスターに割り当てる。 → 残った区画から必要列を読み、集計結果を返す。
- **結果再利用と実行時の待ちを比較** — 再利用条件を満たした同じ要求では、既存の結果を返す。 → 再利用できない要求が集中した場合は、実行枠の空きを待つ。 → マルチクラスター構成では同時要求を別のクラスターに割り当てられる。

## 公式資料

- [マイクロパーティション](https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions)
- [マルチクラスターウェアハウス](https://docs.snowflake.com/en/user-guide/warehouses-multicluster)
- [永続化されたクエリ結果](https://docs.snowflake.com/en/user-guide/querying-persisted-results)

## 5. 実装例 Snowflake Enterprise の BI 負荷調査

BI 専用のマルチクラスターウェアハウスで、待ち時間、区画の読み取り、結果再利用を調べる例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| BI クエリ | 注文集計 SQL クライアント | 注文日を条件に、同一の SQL を実行する。 |
| クエリ受付と計画 | Snowflake Cloud Services | クエリを受付け、計画や結果再利用の判断を調整する。 |
| 実行待ち行列・並列クエリ実行資源 | BI_WH マルチクラスターウェアハウス | 最小・最大クラスター数とスケーリングポリシーを設定する。 |
| 区画メタデータ・列指向のストレージ区画 | Snowflake ORDERS のマイクロパーティション | サービスが管理する区画メタデータで不要な区画を除外する。 |
| 永続化済み結果 | Snowflake の永続化クエリ結果 | 同一クエリなど、再利用の条件を満たすときに使う。 |

調査では `QUEUED_OVERLOAD_TIME` と `PARTITIONS_SCANNED` を別々に比較する。マルチクラスターは主に並行クエリの需要に対応する構成である。永続化結果を使える条件も確認する。

出典 [マイクロパーティション](https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions)、[マルチクラスターウェアハウス](https://docs.snowflake.com/en/user-guide/warehouses-multicluster)、[永続化されたクエリ結果](https://docs.snowflake.com/en/user-guide/querying-persisted-results)、[QUERY_HISTORY ビュー](https://docs.snowflake.com/en/sql-reference/account-usage/query_history)
