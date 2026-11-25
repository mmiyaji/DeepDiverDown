# PostgreSQL の基本アーキテクチャ

## 1. 対象

PostgreSQL 18 を自前の Linux ホストで運用する例を扱う。SQL を処理する接続ごとのプロセス、変更を永続化する WAL、コミット済みの変更を外部へ配信する論理レプリケーションを追う。

## 2. 接続と SQL の実行

クライアントは PostgreSQL サーバーに接続する。待ち受けを行う `postgres` の親プロセスは接続ごとに子プロセスを起動する。SQL 用のバックエンドが接続を認証し、認証後はクライアントと直接やり取りする。バックエンドは SQL を解析・計画し、接続ロールに許可された操作を実行する。実行計画に応じて表や索引のページを読む。

## 3. 共有バッファー・データファイル・WAL

バックエンドは共有バッファーのデータページを読み書きする。必要なページがバッファーになければ、テーブルや索引のファイルから読み込む。変更の内容は WAL に記録する。更新されたページを書き出す前に、その変更に必要な WAL を永続化する。同期コミットでは、各データページの書き出しを待たず、コミットに必要な WAL を永続化してから成功を返せる。チェックポイントは変更済みページをディスクに反映する。クラッシュ復旧では必要な WAL を再適用する。

## 4. 論理レプリケーション

`wal_level=logical` のサーバーでは WAL sender が論理デコーディングを開始できる。組み込みの出力プラグイン `pgoutput` は、publication の対象を論理レプリケーションプロトコルに変換する。購読クライアントは論理スロットを使って配信を受ける。進捗や WAL の保持条件は [PostgreSQL の論理デコーディング](reference-postgresql-logical-decoding.md) を参照。

初回コピーと配信開始位置をそろえる手順は [スナップショットと変更配信の引き継ぎ](reference-postgresql-snapshot-handoff.md) を参照。

## 5. 実装例

利用者が管理する Linux ホスト 1 台で PostgreSQL 18 を動かす。利用者はデータディレクトリを初期化し、`pg_ctl` などでインスタンスを起動する。テーブルと索引は既定の `PGDATA/base` に、WAL は `PGDATA/pg_wal` に置く。

`psql` と購読クライアントは、サーバーが待ち受けるアドレスへの TLS 接続を使う。`pg_hba.conf` の `hostssl` で接続元、データベース、ロールを指定し、`scram-sha-256` で認証する。SQL のロールには `LOGIN` と対象データベース・表への必要な権限を付ける。購読側は別の `LOGIN`・`REPLICATION` ロールを使う。論理レプリケーション接続は対象データベース名で規則を照合する。初期コピーを行う場合は対象表の `SELECT` 権限も必要である。

利用者は `wal_level=logical` を設定し、接続数に応じて WAL sender と論理スロットの上限を設定する。対象表を publication に登録し、購読クライアントは `pgoutput` を使う論理スロットで配信を開始する。この例の `streaming=off` は、コミット済みの行変更を配信する設定である。ホスト、証明書、ログインロール、publication の管理は利用者が担う。外部クライアントの設置場所は指定しない。

| 機能 | 担い手 |
| --- | --- |
| SQL クライアント | `psql` |
| 接続の受付 | `postgres` の親プロセス |
| SQL 処理プロセス | 接続ごとの SQL バックエンド |
| 接続規則と認証 | `pg_hba.conf` と DB ロール |
| 共有ページバッファー | PostgreSQL の共有バッファー |
| テーブル・索引ファイル | `PGDATA/base` のファイル |
| 先行書き込みログ | `PGDATA/pg_wal` |
| 論理変更の配信 | WAL sender、`pgoutput`、publication、論理スロット |
| 変更の購読クライアント | 外部の `pgoutput` 対応クライアント |

## 6. 未確認

この例は公式資料を組み合わせた構成である。実機動作、障害復旧時間、WAL の必要容量は未確認である。複数ホストへの冗長化と購読側の保存・変換はこの図の範囲外である。

## 公式資料

- [PostgreSQL 18 の基本アーキテクチャ](https://www.postgresql.org/docs/18/tutorial-arch.html)
- [pg_ctl](https://www.postgresql.org/docs/18/app-pg-ctl.html)
- [pg_hba.conf](https://www.postgresql.org/docs/18/auth-pg-hba-conf.html)
- [パスワード認証](https://www.postgresql.org/docs/18/auth-password.html)
- [TCP/IP 接続の TLS](https://www.postgresql.org/docs/18/ssl-tcp.html)
- [データベースのファイル配置](https://www.postgresql.org/docs/18/storage-file-layout.html)
- [共有バッファー](https://www.postgresql.org/docs/18/runtime-config-resource.html)
- [WAL の仕組み](https://www.postgresql.org/docs/18/wal-intro.html)
- [チェックポイントと WAL](https://www.postgresql.org/docs/18/wal-configuration.html)
- [論理レプリケーションのアーキテクチャ](https://www.postgresql.org/docs/18/logical-replication-architecture.html)
- [論理レプリケーションの認証と権限](https://www.postgresql.org/docs/18/logical-replication-security.html)
- [論理レプリケーションの設定](https://www.postgresql.org/docs/18/logical-replication-config.html)
- [論理レプリケーションのプロトコル](https://www.postgresql.org/docs/18/protocol-logical-replication.html)
