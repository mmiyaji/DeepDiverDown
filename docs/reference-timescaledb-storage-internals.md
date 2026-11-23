# TimescaleDB：chunk と列指向保存

## 1. 対象と入力

hypertable は PostgreSQL から表として扱うが、背後では時間範囲ごとの chunk に分割される。クエリ条件と範囲が合う場合、対象外の chunk を除外できる。chunk 間隔とインデックスは負荷に合わせて設計する。

## 2. 保存と読み出し

Hypercore では新規データを rowstore に置き、設定やポリシーに沿って columnstore に変換する。segmentby はまとめるキー、orderby は列データの順序を定め、読み取りパターンに影響する。列化はオブジェクトストレージへの移動を意味しない。

## 3. 制約と運用

continuous aggregate は hypertable を基に時間幅ごとの集計を増分更新する。更新ポリシーや遅延到着の対象範囲を確認する。real-time aggregate は 2.13 以降は既定で無効で、集計結果が常に最新の生データを含むとは限らない。

## 4. 実装例

利用者が PostgreSQL / TimescaleDB を Linux とローカルディスク上で運用し、hypertable と列化・継続集計の設定を管理する。 この図は公開資料に基づく代表的な構成であり、特定環境での実行や耐障害性を検証した導入事例ではない。設定とバージョンにより挙動は変わる。

| 役割 | 担い手 |
|---|---|
| 実行・処理 | Linux 上の PostgreSQL と TimescaleDB |
| データと設定 | 利用者が管理する保存先と設定 |

## 5. 参考資料

- [Hypertables](https://www.tigerdata.com/docs/learn/hypertables/understand-hypertables)
- [Hypercore](https://www.tigerdata.com/docs/learn/columnar-storage/understand-hypercore)
- [Continuous aggregates](https://www.tigerdata.com/docs/learn/continuous-aggregates)
