# PostgreSQL：スナップショットと変更配信の引き継ぎ

## 1. 対象

初回コピーで見える行と、コピー後に読む変更が対応する境界を扱う。対象は PostgreSQL 18 の論理レプリケーションプロトコルを使って、取り込みクライアントが最初にデータを読み始める場面である。障害後のオフセットや WAL の保持は [論理デコーディング](reference-postgresql-logical-decoding.md) を参照。

## 2. スナップショットと配信開始位置

レプリケーション接続の `CREATE_REPLICATION_SLOT ... LOGICAL pgoutput` で `SNAPSHOT 'export'` を選ぶ。サーバーは `snapshot_name` と `consistent_point` を同じ結果で返す。前者は別のトランザクションへ渡せるスナップショットの識別子で、後者はそのスロットから配信を始められる最も早い WAL 位置である。スナップショットで見える状態に、そのスロットから得られる後続の変更を適用できる。

## 3. 読み取りトランザクションの境界と識別子の失効

スロットを作成した接続で次のコマンドを実行するか、その接続を閉じると、エクスポートした識別子は新たに取り込めなくなる。読み取り側は、その前に別の接続で `REPEATABLE READ` トランザクションを開始し、最初の問い合わせやコピーより前に `SET TRANSACTION SNAPSHOT` で取り込む。読み取り中は同じ可視性を使う。未コミットの変更は読み取りに含まれない。SQL の `pg_export_snapshot()` で共有する場合、識別子はエクスポート元のトランザクションが終了するまで取り込める。

## 4. 変更配信へ移る条件

初回コピーを保存してから、コピーに対応する同じスロットの `consistent_point` を `START_REPLICATION` に渡す。サーバーは要求した位置とスロットの `confirmed_flush_lsn` の大きい方から配信する。開始位置の読み飛ばしを避けるため、取り込み側はスロットを別のコンシューマーが先に進めていないことと、対応する WAL が残っていることを確認する。コピーの前に識別子が失効し、確定済みのコピーがない場合は、スナップショットと開始位置の組を取り直す。

## 5. 実装例

利用者が管理する Linux DB ホストで PostgreSQL 18 を動かす。別の自前 Linux ホストで取り込みプログラムと `pg_dump` を動かし、ダンプと受信した変更は取り込みホストの永続ストレージに保存する。DB は `wal_level=logical` を設定し、対象の注文テーブルを、行フィルターと列リストを指定しない publication に登録する。

取り込みプログラムは libpq のレプリケーション接続で論理スロットを作成する。その接続を維持して、返された識別子を `pg_dump --snapshot` に渡す。`pg_dump` は別の SQL 接続から対象表を読み、ダンプを保存する。取り込みプログラムはダンプの成功と保存を確認し、スロット名と `consistent_point` を対応付けて記録する。その後、元のレプリケーション接続で `START_REPLICATION` を実行する。図のスロット作成と変更配信は、同じ WAL sender が担当する別の段階である。取り込みプログラムは `pgoutput` の配信を受信し、コミット単位で変更データを保存する。ダンプと変更を下流の表に適用する処理はこの例の範囲外とする。

両接続に TLS を使い、クライアントは `sslmode=verify-full` でサーバー証明書を検証する。`pg_hba.conf` の `hostssl` で対象 DB、ロール、接続元を指定し、`scram-sha-256` で認証する。レプリケーション用ロールには `LOGIN` と `REPLICATION`、ダンプ用ロールには対象 DB へ接続して対象の表を読む権限を付ける。運用者はホスト、証明書、publication、接続ロール、取り込みファイルの権限を管理する。

| 機能 | 担い手 |
| --- | --- |
| コピーと配信の境界 | WAL sender が作る論理スロットとエクスポート済みスナップショット |
| 取り込み制御 | 取り込みホストの libpq プログラム |
| コピー対象の表 | PostgreSQL の注文テーブル |
| 初回コピーの読み取りセッション | PostgreSQL の SQL バックエンド |
| 初回コピーのクライアント | `pg_dump --snapshot` |
| 変更ログ | `PGDATA/pg_wal` |
| 変更配信処理 | 同じレプリケーション接続の WAL sender と `pgoutput` |
| 取り込みデータの保存先 | 取り込みホストの永続ストレージ上のファイル |

## 6. 未確認

実機でのダンプと変更の引き継ぎ、コピーの所要時間、必要な WAL 保持容量は未確認である。

## 公式資料

- [エクスポートされたスナップショット](https://www.postgresql.org/docs/18/logicaldecoding-explanation.html#LOGICALDECODING-EXPORTED-SNAPSHOTS)
- [ストリーミングレプリケーションプロトコル](https://www.postgresql.org/docs/18/protocol-replication.html)
- [SET TRANSACTION](https://www.postgresql.org/docs/18/sql-set-transaction.html)
- [スナップショットを共有する関数](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION)
- [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html)
- [libpq の接続制御](https://www.postgresql.org/docs/18/libpq-connect.html)
- [論理レプリケーションのメッセージ](https://www.postgresql.org/docs/18/protocol-logical-replication.html)
- [論理レプリケーションの権限](https://www.postgresql.org/docs/18/logical-replication-security.html)
- [pg_hba.conf](https://www.postgresql.org/docs/18/auth-pg-hba-conf.html)
- [パスワード認証](https://www.postgresql.org/docs/18/auth-password.html)
- [pg_replication_slots](https://www.postgresql.org/docs/18/view-pg-replication-slots.html)
