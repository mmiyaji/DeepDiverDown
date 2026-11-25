# RisingWave：Hummock ストレージとコンパクション

docs.risingwave.com の公式ドキュメントを基準に、状態がオブジェクトストレージに置かれ、Compactor に整理され、キャッシュ経由で読まれる流れを追う。前提は「RisingWave の基本アーキテクチャ」と「マテリアライズドビューの増分更新」。

## 1. 対象と前提

- 対象は Hummock の書き込み・整理・読み取りと、コンパクションが遅れたときの兆候。
- SST のファイル形式や層ごとのサイズ比、コンパクションの選択方法は資料で確認していない。図は資料にある範囲の概略である。

## 2. Hummock と LSM ツリー

- Hummock は行ベースの LSM ツリーのストレージエンジンで、Table・マテリアライズドビュー・ストリーム処理の状態を持つ。
- 永続コピーは S3・GCS・Azure Blob・MinIO などのオブジェクトストレージに置く。OpenDAL で抽象化している。
- 層は L0 から L6（それ以上のことも）。書き込みはすべて追記で、削除は削除印で書く。L0 は未ソートで、L1 からソートされる。更新の多いデータは下位、冷たいデータは上位に移る。
- 低遅延の点参照・短い範囲走査・CDC や upsert のような頻繁な差分更新に向く。大量の全表走査は列指向の形式より不得手とされる。

## 3. 書き込みの経路

- Compute は未保存の変更（dirty state）をメモリに溜める。バッファが設定したしきい値を超えるか、checkpoint で書き出す。
- checkpoint では、演算子の差分の状態と出力結果を耐久性のあるリモートストレージへ保存する。
- 共有バッファが満杯になると状態の更新が待たされる。Compute のログの `blocked at requiring memory` や、Uploader Memory Size が既定の上限 4GB 付近に張り付く状態が目印になる。

## 4. コンパクション

- Meta がコンパクションタスクを作って Compactor に割り当て、完了するとメタデータを更新する。
- コンパクションは SST をマージして上位の層へ書き直し、L0 を小さく保つ。読み取りでのマージ処理が減り、不要な領域を回収できる。
- Compactor は主に CPU を使う。メモリは小さくてよい（資料の例は 4 コア 4GB）。Compute のコア数に対し Compactor は 2 対 1 が推奨。資料のハードウェア要件は Compactor を最小 1 コア・4 GiB、推奨 2 コア・8 GiB 以上とする。

## 5. 読み取りとキャッシュ

- Executor のキャッシュにないものはストレージへ読みに行く。ブロックキャッシュとメタキャッシュを使う。
- `Get` は点参照（ハッシュ集約）、`Iter` は範囲走査（ハッシュ結合）。削除印や古い版の滞留は主に `Iter` に効く。
- **Elastic disk cache**：ローカルの NVMe SSD や EBS を、メモリキャッシュの延長として使う。`meta_file_cache`（SST のメタデータ）と `data_file_cache`（SST のデータブロック）を持つ。S3 への読み取りと遅延を減らす。資料は有償機能（v2.3.0 で追加）とする。再起動後は既定で冷えた状態から始まる。

## 6. 詰まりの見方

- **書き込み停止**：L0 のサブレベル数が上限を超えると書き込みが止まる（資料の例は 301 が 300 を超過）。`rw_hummock_compaction_group_configs` の `active_write_limit` と、Grafana の Hummock Manager > Write Stop Compaction Groups で確認する。Compactor の CPU が使い切られているかも見る。対処は Compactor の増強と、オブジェクトストレージの問題の確認。
- **削除印・古い版の滞留**：`safe_epoch`・`min_pinned_epoch` と `max_committed_epoch` の差が大きいと、`min_pinned_epoch` より新しいデータはコンパクションで回収できない。長時間のバッチクエリが原因になりうる（`SHOW PROCESSLIST;` で確認）。Hummock (Read) の Iter Keys flow で `skip_delete`・`skip_multi_version` が高いと、コンパクションが遅れている。

## 7. 実装例：AWS の EKS・S3

「RisingWave の基本アーキテクチャ」と同じ AWS 構成。Compute Pod が共有バッファと読み取りキャッシュを持ち、Compactor Pod が S3 上の SST を読んで書き直す。Meta Pod がタスクを生成する。

| 機能 | 担い手 |
| --- | --- |
| 状態の書き込み・共有バッファ・読み取り・キャッシュ | Compute Pod（EC2 ノードのメモリ。ディスクキャッシュを使う場合は未確認） |
| コンパクションタスクの生成・書き込み停止の判定 | Meta Pod |
| コンパクション | Compactor Pod |
| L0・L1 以上の SST | Amazon S3 |
| メタデータ | RDS for PostgreSQL（実装で加わる部品） |

S3 のバケットは利用者が管理し、Compactor と Compute には S3 へのアクセス権が要る。図は公式資料を組み合わせた代表例で実動作は未検証。ノードサイズ、Compactor の台数、S3 のリクエスト性能は未確認。

## 公式資料

- [RisingWave · Storage overview](https://docs.risingwave.com/store/overview)
- [RisingWave · Architecture](https://docs.risingwave.com/get-started/architecture)
- [RisingWave · Data persistence](https://docs.risingwave.com/reference/data-persistence)
- [RisingWave · Specific bottlenecks](https://docs.risingwave.com/performance/specific-bottlenecks)
- [RisingWave · Elastic disk cache](https://docs.risingwave.com/get-started/disk-cache)
- [RisingWave · Hardware requirements](https://docs.risingwave.com/deploy/hardware-requirements)
