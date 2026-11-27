# Valkey の概要（Redis からの分岐・I/O スレッド・複製・クラスタ・永続化）

## 1. 概要と分岐の経緯

Valkey はメモリ上でキーと値を扱うデータストアである。Linux Foundation が 2024 年 3 月 28 日に設立の意向を発表し、Redis 7.2.4 を土台に BSD 3-clause ライセンスで開発を続けるとした。背景は Redis が 2024 年に（7.4 以降を） RSALv2 と SSPLv1 のデュアルライセンスに変えたこと。AWS、Google Cloud、Oracle、Ericsson、Snap が支援を表明した。ガバナンスは Linux Foundation 配下のオープンな運営で、技術委員会には Redis の元コントリビューターが含まれる。Redis との共通点（データ型、TTL、eviction など）は [reference-redis.md](reference-redis.md) に譲り、この資料は Valkey 固有の点を扱う。

- [Linux Foundation Launches Open Source Valkey Community](https://linuxfoundation.org/press/linux-foundation-launches-open-source-valkey-community)
- [Valkey FAQ](https://valkey.io/topics/faq/)（商標が LF Projects, LLC に属すると記載。分岐の理由は別ページへの参照のみ）
- [Valkey history](https://valkey.io/topics/history/)（分岐の経緯。Redis Ltd. が 2024 年に BSD から RSALv2・SSPLv1 のデュアルライセンスへ変えたこと、BSD で続けたい貢献者が多かったこと、商標が Redis Ltd. にあるため別名で続ける必要があったこと、Alibaba・Amazon・Ericsson・Google・Huawei・Tencent の貢献者を中心に Linux Foundation で始めたこと）

## 2. I/O スレッド

Valkey 8.0 で I/O スレッドの扱いが変わった。コマンドの実行はメインスレッドだけが行い、クライアントからの読み取りとパース、応答の書き込み、`epoll_wait`、メモリ解放を I/O スレッドへ渡す。メインスレッドは負荷に応じて動かす I/O スレッドの数を調整し、同じクライアントを同じスレッドに割り当てて局所性を保つ。AWS の測定（EC2 C7g.16xlarge、I/O スレッド 8、3M キー、512 バイトの値、650 クライアント、SET）では、Valkey 7.2 の 360K req/s が 1.19M req/s になり、平均レイテンシは 1.792 ms から 0.542 ms になった。この数値はプリフェッチの改善を含む。設定ディレクティブ名は取得した記事に記載がなく未確認。

- [Valkey 8.0 GA](https://valkey.io/blog/valkey-8-ga/)
- [Unlock one million RPS](https://valkey.io/blog/unlock-one-million-rps/)

## 3. レプリケーション

複製は既定で非同期である。`WAIT` と `WAITAOF` で確認を求められるが、フェイルオーバーで確認済みの書き込みが失われる可能性は残る。切断後の再接続では、レプリカが複製 ID とオフセットを `PSYNC` で送り、プライマリのバックログに差分が残っていれば部分再同期、なければ全量同期になる。昇格したレプリカは旧 ID を副 ID として保持するため、旧プライマリのレプリカも部分再同期できる。

全量同期では `repl-diskless-sync` が既定で有効で、スナップショットをディスクに書かずレプリカへ流す。`repl-diskless-sync-delay`（既定 5 秒）で複数のレプリカを同じ転送にまとめる。レプリカ側の `repl-diskless-load` は `disabled`（既定）、`on-empty-db`、`swapdb`、`flush-before-load` の 4 種がある。Valkey 8.0 以降の `dual-channel-replication-enabled yes` は、スナップショットと更新の差分を別々の接続で受け、差分のバッファをプライマリ側からレプリカ側に移す。`repl-throttling-enabled` は 9.2 の項目として記載されている。Redis との差分比較は、このページには記載がなく未確認。

- [Valkey replication](https://valkey.io/topics/replication/)

## 4. クラスタ

キー空間は 16,384 のハッシュスロットに分かれ、スロットはキーの CRC16 を 16,384 で割った余りで決まる。`{...}` のハッシュタグで関連するキーを同じスロットに置ける。各ノードはクライアント用ポートに 10000 を足したポート（既定。`cluster-port` で変更可）でノード間通信を行い、ping と pong にゴシップを載せて障害を検知する。`NODE_TIMEOUT` を超えて応答がないと PFAIL、プライマリの過半数が報告すると FAIL になり、レプリカが選挙で昇格する。`cluster-migration-barrier` を満たす範囲で、レプリカはレプリカを失ったプライマリへ移動できる。

Valkey 9.0 の固有点は 2 つある。1 つはサーバー側のアトミックなスロット移行（`CLUSTER MIGRATESLOTS`）で、仕様書はライブでの再シャーディングに推奨する方法としている。もう 1 つは、クラスタモードで複数データベースを使える `cluster-databases`（既定 1）で、追加の制限があるが一覧は未確認。Redis Cluster との比較は、このページには記載がなく未確認。

- [Cluster specification](https://valkey.io/topics/cluster-spec/)（全体の約 8 割を取得。末尾約 2 万文字は未読）

## 5. 永続化（RDB と AOF）

RDB は `save 60 1000` のような規則で時点スナップショットを 1 ファイルに書く。`save ""` で無効にできる。AOF は書き込みを記録して起動時に再生する。Valkey の AOF は、基本ファイル（最大 1 つ、RDB または AOF 形式）と増分ファイルに分かれ、マニフェストで管理され、`appenddirname` のディレクトリに置かれる。`appendfsync` は `always`、`everysec`（既定）、`no`。末尾が欠けた AOF は既定で最後のコマンドを捨てて読み込む。途中が壊れている場合は起動せず、`valkey-check-aof` で修復する。両方を有効にすると、再起動時は AOF を使う。ツール名とファイル名は `valkey-` 接頭辞である。マルチパート AOF を Redis と比較した記載はなく、Redis 7.0 の同名機能との差は未確認。

- [Valkey persistence](https://valkey.io/topics/persistence/)

## 6. Redis との互換性と差

Redis OSS 7.2 とそれ以前の OSS 版との互換性を保つ。RESP2 と RESP3 に対応し、既存のクライアントライブラリは変更なしで接続できる。RDB と AOF は Redis OSS 7.2 と互換である。Redis CE 7.4 以降のデータファイルは Valkey で使えない。`INFO` は互換のため `redis_version:7.2.4` を返し、実体は `server_name` と `valkey_version` で見分ける。Lua は `redis` 名前空間が動作し、`server` 名前空間が追加された。`RedisModule_` API のモジュールは動作し、新規は `ValkeyModule_` API を使える。移行方法は RDB のコピー、Redis から Valkey へのレプリケーション、`MIGRATE`、クラスタへ Valkey ノードをレプリカとして追加して昇格、の 4 種が示されている。Redis 8 以降との機能差は未確認。

- [Migration from Redis to Valkey](https://valkey.io/topics/migration/)

## 7. 実装例：Linux 上のクラスタ（プライマリとレプリカ）

| 機能 | 具体的な担い手 |
| --- | --- |
| クライアント | RESP 対応のクライアント（`valkey-cli` など） |
| I/O 処理・コマンド実行 | valkey-server の I/O スレッドとメインスレッド |
| データセット | プライマリのメモリ（スロットを分担） |
| 複製 | 別ホストの Valkey レプリカ |
| 永続化 | プライマリのローカルディスクの RDB と AOF |
| クラスタ | ハッシュスロットの分担は各プライマリ、ノード間のゴシップはクラスタバス（プライマリ B を含む） |

利用者が自前のサーバーで Valkey、OS、ディスクを運用する構成。公式資料に基づく代表例であり、導入事例や動作検証済みの構成ではない。図はプライマリ 2 台に省略しており、実運用の台数・スロットの割り当て・認証、TLS は未確認。
