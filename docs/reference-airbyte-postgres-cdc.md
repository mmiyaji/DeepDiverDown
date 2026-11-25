# Airbyte：PostgreSQL の初回スナップショットと CDC

## 1. 初回の表読み取り

[Airbyte の基本アーキテクチャ](reference-airbyte.md) の同期を、標準 Postgres Source の CDC で追う。CDC で増分同期する対象は主キーを持つ表とする。最初の同期は `SELECT` で既存行のスナップショットを取得する。その後の同期は前回からの論理変更を読み取る。

## 2. publication、スロット、WAL

複製元で `wal_level=logical` を設定する。publication で取得する表を指定し、Source 専用の論理レプリケーションスロットを `pgoutput` で作る。スロットは読み取り側が必要とする WAL を保持するため、同期停止中に WAL が増える。保持上限や容量によって古い変更を読めなくなる場合がある。

Airbyte は接続のスケジュールに従ってジョブ単位で CDC を読む。書き込みが続いていても、1 回の同期は有限の範囲を処理する。`INSERT`、`UPDATE`、`DELETE` の扱いは Source の対応範囲と複製先の同期方式に従う。

## 3. 同期 State と再開

Source は出力レコードと State を送る。Destination が対応範囲のコミットを確認すると、Airbyte が確定した State を保持する。次のジョブでは前回の確定済み State を Source に渡す。PostgreSQL のスロット状態と Airbyte の接続 State は担当と保存場所が異なる。

## 4. 実装例：自前 Kubernetes の Airbyte と PostgreSQL

自前 Linux Kubernetes に Airbyte を Helm で導入する。管理 Pod が接続を設定し、同期ワークロードが取引 PostgreSQL の変更を読み、分析 PostgreSQL に複製する。取引 DB、分析 DB、Airbyte 設定 DB はクラスターの外側に置く想定である。

| 機能 | 実装での担い手 |
| --- | --- |
| 複製元の表と論理変更ログ | 取引 PostgreSQL サーバーの表と WAL |
| 対象表とログ保持位置 | publication と `pgoutput` の論理レプリケーションスロット |
| 初回と変更ログの読取 | Airbyte の標準 Postgres Source |
| 同期の起動と転送 | Airbyte Connection と同期ワークロード |
| 確定済みの同期位置 | Airbyte 設定 DB の State |
| 複製先への書き込み | Postgres Destination の Incremental Append + Deduped |
| 複製先の表 | 分析用 PostgreSQL サーバーの対象スキーマ |

Source 用の専用ユーザーにレプリケーション権限と対象スキーマ・テーブルの読み取り権限を付ける。Destination 用のユーザーは対象 DB でテーブルと必要なスキーマを作成し、行を書き込めるようにする。管理者は Kubernetes から各 DB への到達性、TLS、資格情報の保管、WAL の使用量と同期遅延を管理する。対象バージョンの組み合わせ、WAL の必要容量、障害復旧時の動作は未検証である。

- [Postgres Source](https://docs.airbyte.com/integrations/sources/postgres)
- [Airbyte CDC](https://docs.airbyte.com/platform/understanding-airbyte/cdc)
- [Airbyte Protocol](https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol)
- [PostgreSQL の論理レプリケーション](https://www.postgresql.org/docs/current/logical-replication.html)
- [Postgres Destination](https://docs.airbyte.com/integrations/destinations/postgres)
- [Airbyte プラットフォーム構成](https://docs.airbyte.com/platform/understanding-airbyte/high-level-view)
- [Airbyte 設定 DB](https://docs.airbyte.com/platform/understanding-airbyte/database-data-catalog/config-database-connections)
- [Deploy Airbyte](https://docs.airbyte.com/platform/deploying-airbyte)
