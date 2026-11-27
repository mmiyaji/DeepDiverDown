# Dragonfly の基本アーキテクチャ

## 1. 概要

Dragonfly は Redis と Memcached の API に互換のインメモリデータストアである。1 プロセス・マルチスレッドで動き、キー空間をスレッドごとのシャードに分ける。README は約 185 の Redis コマンド（Redis 5.0 API 相当）と 13 の Memcached コマンドへの対応を挙げている。2026 年 11 月時点の公式資料に基づく。

[GitHub: dragonflydb/dragonfly](https://github.com/dragonflydb/dragonfly)

## 2. Shared-nothing のスレッドとシャード

データは N 個のシャードに分かれ、N はスレッド数以下。各シャードは 1 つのスレッドだけが読み書きし、キーのハッシュでシャードが決まる。スレッド間のやり取りはメッセージの受け渡しだけで、データ構造にミューテックスを使わない。接続は生存中ずっと 1 つのスレッドに結び付く。処理の単位は Boost.Fibers のファイバーで、スケジューラーは helio ライブラリのものを使う。`--proactor_threads` の既定値 0 は CPU コア 1 つにつき 1 スレッドを意味する。

[df-share-nothing.md](https://github.com/dragonflydb/dragonfly/blob/main/docs/df-share-nothing.md)、[Server Configuration Flags](https://www.dragonflydb.io/docs/managing-dragonfly/flags)

## 3. マルチキー操作とトランザクション

接続のファイバーがコーディネーターになり、関係するシャードのスレッドへコマンドを送る。コーディネーターはシャードのデータを直接触らない。mset、mget、blpop などのマルチキーコマンド、Lua スクリプト、複数コマンドのトランザクションで、アトミック性と strict serializability を得る。README はこの仕組みを VLL ベースのトランザクションフレームワークと説明し、CPU とレイテンシのコストが増えると資料自身が述べている。

[GitHub README](https://github.com/dragonflydb/dragonfly)、[df-share-nothing.md](https://github.com/dragonflydb/dragonfly/blob/main/docs/df-share-nothing.md)

## 4. DashTable

ハッシュテーブルは Dash 論文（Scalable Hashing on Persistent Memory）に基づく DashTable で、拡張可能ハッシュ法を使う。ディレクトリがセグメントを指し、1 セグメントは通常バケット 56 個とスタッシュバケット 4 個、1 バケット 14 スロットで、計 840 レコードを持つ。満杯のセグメントだけが分割されるため、Redis の辞書のような大きな再確保とメモリのピークが起きない。メタデータは 1 エントリあたり約 20 ビット（Redis の辞書は 64 ビット）と記載されている。README は Redis に比べてアイドル時のメモリ効率が約 30% 良いとするが、再現条件は未確認。

[dashtable.md](https://github.com/dragonflydb/dragonfly/blob/main/docs/dashtable.md)

## 5. フォークなしのスナップショット

スナップショットは fork を使わず、エントリごとのバージョンカウンターとシャードごとのエポックで時点の一貫性を保つ。開始時に各シャードがエポックを記録し、それ以前のエントリを走査して直列化する。更新時の書き込みフックが、変更前の値（conservative）または変更後の値（relaxed）をシンクへ送る。conservative はバックアップ向け、relaxed はレプリケーションの全量同期向け。出力は RDB 互換形式で、各シャードが自分のデータを直列化する。README は bgsave 中にメモリ増加が見えなかったと報告している。シャードごとのファイルを使う独自形式は、スナップショットの資料では TBD とされている。`--snapshot_cron` で定期実行し、`--dbfilename` と `--dir` で保存先を決める。

[Snapshotting](https://www.dragonflydb.io/docs/managing-dragonfly/snapshotting)、[Server Configuration Flags](https://www.dragonflydb.io/docs/managing-dragonfly/flags)

## 6. io_uring

既定では Linux の io_uring を使い、`--force_epoll=true` で epoll に切り替えられる。フラグの説明は epoll を「5.10 より古いカーネル向け」としている。GitHub の issue では、メンテナーが epoll を SSD ティアリング非対応などの制約がある旧エンジンと述べている。スレッドごとの I/O ループの詳しい構造は公式のアーキテクチャ資料を取得できず、未確認。

[Server Configuration Flags](https://www.dragonflydb.io/docs/managing-dragonfly/flags)、[Issue #2729](https://github.com/dragonflydb/dragonfly/issues/2729)

## 7. レプリケーションとクラスター

プライマリ・レプリカ構成で、`REPLICAOF host port` でレプリカを付け、`REPLICAOF NO ONE` で昇格する。フェイルオーバーは資料上は手動の手順である。再接続後はシャードごとのバックログから部分同期し、足りなければ全量同期する。`--cluster_mode` は `yes` と `emulated` を受け付ける。Sentinel とクラスターモードの詳細は今回取得した範囲になく未確認。

[Replication](https://www.dragonflydb.io/docs/managing-dragonfly/replication)

## 8. ライセンス

公式のライセンスページによると、v2.1 以降は Dragonfly Source-Available License（DSAL）、v2.1 より前は BSL 1.1 である。リポジトリの LICENSE.md では、本番利用は全インスタンス合計 100 vCPU までで、超える場合は商用ライセンスが必要、非本番の利用に上限はない。DSAL に変更日や OSS への転換条項は見当たらなかった。条文の解釈は未確認。

[License](https://www.dragonflydb.io/docs/about/license)、[LICENSE.md](https://github.com/dragonflydb/dragonfly/blob/main/LICENSE.md)

## 9. 実装例：自前の Linux サーバー（単一プライマリとレプリカ）

| 機能 | 具体的な担い手 |
| --- | --- |
| クライアント | Redis・Memcached クライアント |
| 接続・I/O | dragonfly プロセスの I/O スレッド（io_uring） |
| データ保持 | シャードごとの DashTable |
| 永続化 | ローカルディスクの RDB 形式スナップショット |
| 複製 | レプリカの Dragonfly サーバー |

代表的な構成であり、導入事例や動作検証済みの構成ではない。推奨のスペックや台数は未確認。
