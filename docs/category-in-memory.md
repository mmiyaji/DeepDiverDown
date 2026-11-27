# インメモリデータベースの違い

自前運用型（OSS・ソース公開）

| 観点 | Redis | Valkey | Memcached | Dragonfly | Apache Ignite |
| --- | --- | --- | --- | --- | --- |
| 特徴 | **データ型の豊富さ** が持ち味のインメモリストア | **Redis 7.2.4 からの分岐**。Linux Foundation 配下で BSD 3-clause | **キャッシュ専用**。サーバー同士は通信しない | **1 プロセス・マルチスレッド** の Redis 互換 | **SQL とコロケーション計算** を持つインメモリデータグリッド（2.18 系） |
| データの置き場所と永続化 | メモリ。**RDB と AOF** は任意で、両方・無効も選べる | メモリ。RDB と AOF（base + incremental + manifest） | メモリのみ。再起動で消える。**extstore** で値をフラッシュへ逃がせる | メモリ。**fork なし** のスナップショット（RDB 互換形式） | メモリ。**ネイティブ永続化**（WAL + パーティションファイル）は任意 |
| スレッドとスケールの方法 | スレッドの扱いは未確認。**Cluster** で 16384 スロットに分割 | コマンド実行は **メインスレッドのみ**、I/O を I/O スレッドへ分離（8.0 以降）。16384 スロット | ワーカースレッド + 集中ロック。分散は **クライアントのハッシュ** | **シャードごとに 1 スレッド**（shared-nothing）。既定はコア数ぶん | キーを 1024 パーティション（既定）へ。ノード追加で **容量が増える** |
| クラスタと冗長化 | primary と replica は **非同期**。フェイルオーバーは Sentinel か Cluster | 非同期複製。**スロットのアトミック移行**（9.0 の `CLUSTER MIGRATESLOTS`） | 冗長化の仕組みなし。落ちた分は **ミス** になる | `REPLICAOF` で複製。フェイルオーバーは **手動の手順** | キャッシュごとのバックアップ（既定は無効）。主が落ちると **PME で昇格** |
| 互換性 | Redis プロトコル。RESP の版は未確認 | Redis OSS 7.2 までと互換。**7.4 以降のデータファイルは使えない** | 独自のテキストプロトコル。接続方式の詳細は未確認 | Redis 約 185 コマンド（5.0 相当）と **Memcached 13 コマンド** | JDBC・ODBC と各言語のネイティブ API。Redis 互換の記載は、Ignite 2 の拡張・統合一覧と Ignite 3 のトップに見当たらない（提供の有無までは未確認） |
| 得意な用途 | データ型を使うキャッシュ・カウンター・ランキング | Redis 7.2 系の資産を引き継ぐ構成 | **単純なキャッシュ** で DB の前に置く | 少ないインスタンスでコア数を使い切る | データを持つノードで **SQL や計算を実行** する |
| 注意点 | メモリ使用量は **RSS と一致しない**。fork 中は copy-on-write の余裕が要る | I/O スレッドの設定名は **未確認**。Redis 8 以降との差も未確認 | ウォームリスタートは **extstore と併用不可**。crash safe ではない | v2.1 以降は **DSAL**。本番は全インスタンス合計 **100 vCPU まで** | **Ignite 3 は別系統** で、この表は当てはまらない。リバランスは未確認 |

マネージド型

| 観点 | Amazon MemoryDB |
| --- | --- |
| 特徴 | **マルチ AZ のトランザクションログ** で耐久性を持つ、Valkey・Redis OSS 互換のデータベース |
| データの置き場所と永続化 | 全データをメモリに置き、書き込みは **ログへ永続化してから** 成功を返す。スナップショットは S3 に最長 35 日 |
| スレッドとスケールの方法 | データを **シャードに分割**（最大 500 シャード）。スレッドの扱いは未確認 |
| クラスタと冗長化 | シャードごとにプライマリ 1 台 + レプリカ最大 5 台。落ちるとレプリカが **昇格** |
| 互換性 | Valkey 7.2.6・7.3 と Redis OSS 6.2〜7.1。Redis OSS から Valkey へは上げられるが **戻せない** |
| 得意な用途 | キャッシュを別に置かず、**主データベースとして** 使う |
| 注意点 | ログの内部構成は **未確認**。ノードタイプ・シャード数・ACL は利用者が決める。GovCloud などの提供は未確認 |

内容は 2026 年 11 月時点の公式資料に基づきます。確認できなかった点は「未確認」と書いています。

## 選び方

- Redis のデータ型を使い、既存の Redis 運用に載せる → **Redis**
- Redis 7.2 系を BSD ライセンスのまま使い続ける → **Valkey**
- 文字列だけを DB の前でキャッシュする → **Memcached**
- 1 台のコアを使い切り、Redis クライアントをそのまま使う（ライセンス条件を確認のうえ） → **Dragonfly**
- データを持つノードで SQL や計算を実行する → **Apache Ignite**
- 永続化を任せ、主データベースとして Valkey・Redis 互換を AWS で動かす → **Amazon MemoryDB**

## 公式資料

- [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
- [Redis Cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
- [Valkey replication](https://valkey.io/topics/replication/)
- [Migration from Redis to Valkey](https://valkey.io/topics/migration/)
- [Memcached Performance and Efficiency](https://docs.memcached.org/serverguide/performance/)
- [Memcached Extstore](https://docs.memcached.org/features/flashstorage/)
- [Dragonfly GitHub](https://github.com/dragonflydb/dragonfly)
- [Dragonfly License](https://www.dragonflydb.io/docs/about/license)
- [Apache Ignite 2.18 Data Partitioning](https://ignite.apache.org/docs/ignite2/latest/data-modeling/data-partitioning)
- [Apache Ignite 2.18 Native Persistence](https://ignite.apache.org/docs/ignite2/latest/persistence/native-persistence)
- [Amazon MemoryDB core components](https://docs.aws.amazon.com/memorydb/latest/devguide/components.html)
- [Amazon MemoryDB Consistency](https://docs.aws.amazon.com/memorydb/latest/devguide/consistency.html)
