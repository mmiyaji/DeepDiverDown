# Snowflake：読み取り・検索と性能最適化

## 1. 範囲

注文データを例に、区画の絞り込み、検索用構造、キャッシュ、追加並列化と観測を追う。図は公開情報から組み立てた論理モデル。 公開されていない物理ノード数、内部通信やアルゴリズムは推定しない。例は公式資料の機能を組み合わせた説明で、実在の導入事例や実測値ではない。

## 2. 読み取りと観測

- **SQL の発行**：日付条件や検索条件を付けて SQL を発行する。
- **計画と候補の選択**：条件とメタデータを使って計画し、結果再利用を判断する。
- **保存済み結果**：再利用可能な結果。権限、データ、SQL などの条件が必要で、再利用は保証されない。
- **実行の観測**：待ち、読み取り区画、演算子ごとの行数や spill を調べる。
- **候補区画の読み取り**：候補となった区画の必要列を読み、フィルターを適用する。
- **結合・集計・並べ替え**：結合・集計・ソートを実行する。条件に応じて動的 pruning や Top-K pruning が使われる。
- **実行資源内のデータキャッシュ**：同じウェアハウスの後続クエリで利用できる。ウェアハウス停止時に破棄される。
- **対象処理の追加並列化**：有効化され対象条件を満たす場合、処理の一部を共有計算資源にオフロードする。
- **区画ごとの統計**：区画内の列の値域などを使い、条件に合わない区画を除外する。
- **検索用の補助構造**：検索用の永続化された access path。値が存在し得る区画の候補を絞る。
- **式に応じた追加統計**：対象ワークロードを分析し式ごとのメタデータを生成する。対象ウェアハウスに制約がある。
- **列指向の保存区画**：マイクロパーティションは列ごとに保存・圧縮される。範囲が一部重なる区画は候補として残る。
- **データ配置の保守**：設定したクラスタリングキーに基づく再編成により区画の配置を維持する。費用が発生する。

マイクロパーティションは列ごとに独立して保存・圧縮される。列ごとの値域などを使って候補を減らし、Query Profile で実際に走査した区画数や spill を調べる。図の矢印は論理上の情報・処理の関係であり、内部 RPC や実装の配置を断定しない。

## 3. Search Optimization、Optima と QAS

Search Optimization は有効化された対象の検索向けに search access path を構築・保守し、値が含まれ得る区画の絞り込みに利用する。追加の計算・ストレージ費用がある。Optima Metadata はワークロードに応じた式の統計を自動生成し、Gen2 standard warehouse と Adaptive Warehouse で利用できる。両者は別の機能である。QAS は Enterprise Edition 以上で、ウェアハウスで有効化し、対象となった処理の一部を共有計算資源にオフロードする。常にすべてのクエリが対象になるわけではない。Search Optimization と QAS を組み合わせる場合、不要な区画を減らした後、対象となる処理が QAS に渡る。Top-K pruning は対応する ORDER BY と LIMIT 等の条件下で残りが上位 K に入らないと判断できたとき読み取りを止める。

## 4. 二種類のキャッシュ

永続化クエリ結果は条件を満たす場合に結果全体を再利用するが、条件を満たしても再利用は保証されない。ウェアハウスのデータキャッシュは稼働中の同一ウェアハウスのクエリで使われ得る表データで、ウェアハウス停止時に消える。両者の有効期間や測定時の前提を混同しない。

## 5. 保守と計測

自動クラスタリングは指定したキーに沿ってデータを再編成する。クラスターキー、DML の頻度、Search Optimization の維持、追加ストレージを含めて費用対効果を評価する。Query Profile の読み取り区画数、演算子の入出力行数、spill と Query History の待ち時間を切り分け、キャッシュと同時実行数などを揃えて比較する。QAS 有効時は対象クエリで少量のリモート書き込みが発生し得る。

## 6. 実装例：Snowflake の注文分析

利用者の BI クライアントから Snowflake に SQL を送り、Virtual Warehouse が注文テーブルを読む例。内部機能は公開資料上の論理区分であり、利用者が内部ノードを直接管理する構成ではない。追加の最適化は任意であり、適用条件と費用を確認する。

| 機能配置 | 具体的な担い手 | 内容 |
| --- | --- | --- |
| SQL の発行 | BI クライアントの SQL | 日付条件や検索条件を付けて SQL を発行する。 |
| 計画と候補の選択 | Snowflake Cloud Services の計画 | 条件とメタデータを使って計画し、結果再利用を判断する。 |
| 保存済み結果 | 永続化クエリ結果 | 再利用可能な結果。権限、データ、SQL などの条件が必要で、再利用は保証されない。 |
| 実行の観測 | Snowsight Query Profile | 待ち、読み取り区画、演算子ごとの行数や spill を調べる。 |
| 候補区画の読み取り | Virtual Warehouse のスキャン処理 | 候補となった区画の必要列を読み、フィルターを適用する。 |
| 結合・集計・並べ替え | Virtual Warehouse の演算処理 | 結合・集計・ソートを実行する。条件に応じて動的 pruning や Top-K pruning が使われる。 |
| 実行資源内のデータキャッシュ | Virtual Warehouse のデータキャッシュ | 同じウェアハウスの後続クエリで利用できる。ウェアハウス停止時に破棄される。 |
| 対象処理の追加並列化 | Query Acceleration Service（任意） | 有効化され対象条件を満たす場合、処理の一部を共有計算資源にオフロードする。 |
| 区画ごとの統計 | Snowflake の区画メタデータ | 区画内の列の値域などを使い、条件に合わない区画を除外する。 |
| 検索用の補助構造 | Search Optimization の access path（任意） | 検索用の永続化された access path。値が存在し得る区画の候補を絞る。 |
| 式に応じた追加統計 | Optima Metadata（対象環境） | 対象ワークロードを分析し式ごとのメタデータを生成する。対象ウェアハウスに制約がある。 |
| 列指向の保存区画 | ORDERS の micro-partitions | マイクロパーティションは列ごとに保存・圧縮される。範囲が一部重なる区画は候補として残る。 |
| データ配置の保守 | Automatic Clustering（任意） | 設定したクラスタリングキーに基づく再編成により区画の配置を維持する。費用が発生する。 |

## 公式資料

- [Query Profile](https://docs.snowflake.com/en/user-guide/ui-snowsight-activity)
- [Micro-partitions](https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions)
- [Search optimization](https://docs.snowflake.com/en/user-guide/search-optimization-service)
- [Optima Metadata](https://docs.snowflake.com/en/user-guide/snowflake-optima)
- [Query Acceleration Service](https://docs.snowflake.com/en/user-guide/query-acceleration-service)
- [Top-K pruning](https://docs.snowflake.com/en/user-guide/querying-top-k-pruning-optimization)
- [Result cache](https://docs.snowflake.com/en/user-guide/querying-persisted-results)
- [Warehouse cache](https://docs.snowflake.com/en/user-guide/performance-query-warehouse-cache)
- [Automatic Clustering](https://docs.snowflake.com/en/user-guide/tables-auto-reclustering)
