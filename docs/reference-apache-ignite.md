# Apache Ignite の基本アーキテクチャ（Ignite 2.18 系）

## 1. 概要

Apache Ignite 2.x は、サーバーノードのクラスタにキャッシュ（データグリッド）を分散して持つインメモリデータグリッドである。公式資料は SQL を備えた分散データベースとも説明している。この図の対象は Ignite 2.18.0 のドキュメントで、Ignite 3 は §7 で区別する。2026 年 11 月時点の公式資料に基づく。

[Ignite 2 の SQL](https://ignite.apache.org/docs/ignite2/latest/SQL/sql-introduction)

## 2. パーティションとキャッシュモード

データはパーティション（既定で 0〜1023）に分かれてサーバーノードへ配置される。アフィニティ関数がキーをパーティションへ、パーティションをノードへ対応付ける。既定は rendezvous hashing で、トポロジ変更時に動くパーティションは参加・離脱したノードに関わるものだけである。

- PARTITIONED：全サーバーに分割して置く。大きなデータと頻繁な更新向けで、容量はノード数で増える。
- REPLICATED：全ノードが全データを持つ。小さく更新の少ないデータ向けで、読み取りはローカルで済む。容量は 1 ノードの範囲に限られる。

[Data Partitioning](https://ignite.apache.org/docs/ignite2/latest/data-modeling/data-partitioning)

## 3. バックアップとリバランス

バックアップは既定で無効で、キャッシュごとに設定し、PARTITIONED でのみ使う。バックアップ 2 なら各パーティションは主 1 と副 2 の計 3 コピーになる。主ノードが抜けると、パーティションマップ交換（PME）でバックアップが主に昇格する。PME 中は新しいトランザクションが待たされる。主と全バックアップが同時に失われたパーティションはデータを失い、扱いは Partition Loss Policy で決める。リバランスの詳細は未確認。

[Data Partitioning](https://ignite.apache.org/docs/ignite2/latest/data-modeling/data-partitioning)

## 4. ネイティブ永続化

有効にすると全データをディスクに置き、可能な範囲をメモリに載せる。無効なら純粋なインメモリになる。データリージョン単位で設定でき、永続・非永続のリージョンを併用できる。パーティションごとに 1 ファイルで、バックアップ、インデックス、メタデータも保存する。更新はまず WAL に追記し、チェックポイントがダーティページをパーティションファイルへ書く。WAL モードは FSYNC、LOG_ONLY（既定）、BACKGROUND、NONE。既定の保存先は `{IGNITE_WORK_DIR}/db` である。

[Native Persistence](https://ignite.apache.org/docs/ignite2/latest/persistence/native-persistence)

## 5. SQL

既定の SQL エンジンは H2 で、Apache Calcite ベースのエンジンも有効にできる。JDBC・ODBC と各言語のネイティブ API から使う。DDL は分散向けの一部のみ実装している。パーティション化テーブルへのクエリは、データを持つノードで実行する map クエリと、結果を結合する reduce に分かれる。REPLICATED テーブルへのクエリはローカルデータで実行する。分散 JOIN の挙動は今回の取得範囲になく未確認。

[Ignite 2 の SQL](https://ignite.apache.org/docs/ignite2/latest/SQL/sql-introduction)

## 6. コロケーション（データと計算）

同じアフィニティキーを持つエントリは同じパーティション、つまり同じノードに置かれ、複数エントリのクエリを 1 ノードで完結できる。既定ではキャッシュキー（SQL テーブルは PRIMARY KEY）がアフィニティキーで、別の項目は `@AffinityKeyMapped` や SQL の `affinity_key=` で指定する。計算は `affinityRun` / `affinityCall` にキャッシュ名とキー（またはパーティション番号）を渡すと、そのデータを持つノードで実行でき、結果だけがネットワークを通る。タスクのクラスは各ノードのクラスパス上に置くか、ピアクラスローディングを有効にする。小さなデータでは scan クエリのほうが速い場合がある。

[Affinity Colocation](https://ignite.apache.org/docs/ignite2/latest/data-modeling/affinity-collocation) / [Colocating Computations With Data](https://ignite.apache.org/docs/ignite2/latest/distributed-computing/collocated-computations)

## 7. Ignite 3 との違い

Ignite 3 の最新リリースは 3.1.0 で、ドキュメントは別系統（`/docs/ignite3/`）にある。ストレージエンジンとして AIMemory、AIPersist、RocksDB が挙がり、Table API と SQL で扱う。確認できたのはここまでで、Raft の利用、スキーマ駆動のテーブル、compute の仕様、Ignite 2 からの移行方法と互換性は今回取得した資料にないため未確認。この図は Ignite 3 には当てはまらない。

[Ignite 3 ドキュメント](https://ignite.apache.org/docs/ignite3/latest/)

## 8. 実装例：自前のサーバー群

| 機能 | 具体的な担い手 |
| --- | --- |
| クライアント | アプリケーション（JDBC・ネイティブ API） |
| サーバーノード | Ignite サーバーノード（ノード数は未確認） |
| インメモリのキャッシュ | PARTITIONED / REPLICATED キャッシュ |
| 永続化 | 各ノードのローカルディスクの WAL とパーティションファイル |

代表的な構成であり、導入事例や動作検証済みの構成ではない。ノード台数、ネットワーク構成、ディスク種別は未確認。
