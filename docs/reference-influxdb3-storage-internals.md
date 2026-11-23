# InfluxDB 3 Core：WAL と Parquet

## 1. 対象と入力

対象は InfluxDB 3 Core の Parquet エンジン。入力を検証してメモリバッファに置き、既定では WAL をオブジェクトストアに flush 後に応答する。no_sync=true は永続化前に応答し得る。

## 2. 保存と読み出し

WAL 永続化後のデータはクエリ可能なバッファに移り、古い部分は Parquet としてオブジェクトストアに永続化される。公式資料の既定例では WAL flush は 1 秒、Parquet 永続化は 10 分だが、設定・版によって異なる。最近の Parquet はメモリにキャッシュされる。

## 3. 制約と運用

検索は直近バッファと Parquet／キャッシュの両方を対象にする。オブジェクトストアは file、S3 などから設定する。Core と Clustered / Enterprise は同じ配置や機能を仮定しない。ストア側の整合性要件、権限、バックアップを確認する。

## 4. 実装例

Linux 上の Core プロセスと file オブジェクトストアを利用者が設定し、WAL と Parquet をローカルファイルとして保持する。 この図は公開資料に基づく代表的な構成であり、特定環境での実行や耐障害性を検証した導入事例ではない。設定とバージョンにより挙動は変わる。

| 役割 | 担い手 |
|---|---|
| 実行・処理 | Linux 上の InfluxDB 3 Core とファイルストア |
| データと設定 | 利用者が管理する保存先と設定 |

## 5. 参考資料

- [InfluxDB 3 Core durability](https://docs.influxdata.com/influxdb3/core/reference/internals/durability/)
- [Core object storage](https://docs.influxdata.com/influxdb3/core/object-storage/)
- [Core storage engine](https://docs.influxdata.com/influxdb3/core/reference/internals/storage-engine/)
