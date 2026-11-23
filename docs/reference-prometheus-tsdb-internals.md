# Prometheus TSDB：WAL・Head・ブロック

## 1. 対象と入力

メトリクス名とラベルの組合せが系列を識別する。スクレイプしたサンプルの現在のブロックは Head としてメモリに置かれ、WAL で障害復旧を支える。

## 2. 保存と読み出し

ローカル TSDB は時間範囲ごとのブロックを作り、各ブロックに chunks、ラベルと系列を対応させる index、metadata がある。削除記録は tombstone で管理する。初期ブロックは通常 2 時間単位で、後に compaction される。

## 3. 制約と運用

PromQL の検索では Head と保存済みブロックが対象になる。保持時間・容量に基づき古いブロックを削除する。compaction 中は元と新しいブロックが一時的に共存する。ローカル TSDB は単一ノードであり、複製・長期保持は remote write 先などの別設計が必要。

## 4. 実装例

利用者管理の Linux 上で Prometheus を実行し、対象を scrape してローカルディスクに WAL とブロックを保存する。 この図は公開資料に基づく代表的な構成であり、特定環境での実行や耐障害性を検証した導入事例ではない。設定とバージョンにより挙動は変わる。

| 役割 | 担い手 |
|---|---|
| 実行・処理 | Linux 上の Prometheus ローカル TSDB |
| データと設定 | 利用者が管理する保存先と設定 |

## 5. 参考資料

- [Prometheus Storage](https://prometheus.io/docs/prometheus/latest/storage/)
- [Prometheus data model](https://prometheus.io/docs/concepts/data_model/)
