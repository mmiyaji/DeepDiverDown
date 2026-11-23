# 時系列データの保持と階層化

## 1. 対象
保持する時系列の量と利用頻度に応じて保存場所や粒度を分ける。Hot / Warm / Cold は設計上の呼び名であり、固定の製品機能や普遍的な保存時間ではない。

## 2. 流れ
最近の生データを保存し、時間幅ごとに集計する。生データと集計値をそれぞれの利用期間に合わせて保持する。長期保存では保存対象と形式、暗号化、移動処理、復元の手順・時間を設計する。期限切れの削除はバックアップや法的な保持要件と整合させる。

## 3. 注意点
遅延到着や訂正による再集計が必要な期間に元データを削除しない。圧縮や集計は必ずしも外部ストレージへの移動ではない。冷たい層をクエリ可能にするには製品機能または復元経路が必要であり、費用と性能は保存先・構成による。

## 4. 実装例：TimescaleDB と COPY
単一 Linux ホストの PostgreSQL / TimescaleDB で、生データを hypertable、時間別集計を continuous aggregate に置く。利用者が更新ポリシーを設定し、選んだデータを COPY でホスト上のファイルへ出力し、別途保管・復元を運用する。Cold への自動移行を仮定しない。継続集計の更新範囲、期限と復元を設計し、実行環境・権限・バックアップを検証する。

| 役割 | 実装 |
|---|---|
| 生データ | hypertable |
| 時間集計 | continuous aggregate |
| 出力 | 利用者が起動する COPY とファイル |

## 5. 参考資料

- [Timescale hypertables](https://www.tigerdata.com/docs/learn/hypertables/understand-hypertables)
- [Timescale continuous aggregates](https://www.tigerdata.com/docs/learn/continuous-aggregates)
- [PostgreSQL COPY](https://www.postgresql.org/docs/current/sql-copy.html)
