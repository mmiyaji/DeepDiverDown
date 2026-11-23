# TimescaleDB：chunk・列バッチと絞り込み

## 1. 対象

PostgreSQL の hypertable は時間次元を基準に chunk を管理する。SQL の時間条件により対象外 chunk の読み取りを避けられる場合がある。chunk 間隔はワークロードに応じて調整する。

## 2. データの流れ

rowstore chunk の行は設定した列化ポリシーにより columnstore に変換できる。列バッチは segmentby の同じキーでまとめ、orderby の列に従って並べる。これらはデータ配置の設計であり、具体的な圧縮比・物理サイズはデータとバージョンに依存する。

PostgreSQL WAL は変更の耐久性とクラッシュ後の復旧を支える。継続集計の materialization と最新データの扱いは更新範囲・real-time aggregate 設定に依存し、2.13 以降は real-time aggregate が既定で無効。遅延到着・保持削除・再集計期間を整合させる。

## 3. 運用上の注意

単一 Linux ホストの PostgreSQL / TimescaleDB で WAL、hypertable、columnstore と集計を管理する。 構成と対応バージョンにより動作が異なるため、採用環境で検証する。

## 4. 実装例

Linux ホストで PostgreSQL と TimescaleDB を動かし、ローカルディスクのデータと WAL、バックアップ、列化・更新ポリシーを利用者が管理する。列化をストレージ層への移動と同一視しない。

| 役割 | 担い手 |
|---|---|
| クライアント | 利用者の SQL クライアント |
| 処理・保存 | Linux 上の PostgreSQL と TimescaleDB |
| 保持・バックアップ | 利用者が管理するディスクと設定 |

これは公開資料に基づく代表構成であり、本リポジトリでの実環境の動作検証は行っていない。

## 5. 参考資料

- [Hypertables](https://www.tigerdata.com/docs/learn/hypertables/understand-hypertables)
- [Hypercore](https://www.tigerdata.com/docs/learn/columnar-storage/understand-hypercore)
- [Columnstore policy](https://www.tigerdata.com/docs/reference/timescaledb/hypercore/add_columnstore_policy)
- [Continuous aggregates](https://www.tigerdata.com/docs/learn/continuous-aggregates)
- [PostgreSQL WAL](https://www.postgresql.org/docs/current/wal-intro.html)
