# 小ファイルの整理：コンパクション

## 1. 例：ストリーミングが小ファイルを生む

`orders` テーブルを `order_date` でパーティション分割し、注文イベントをストリーミングのマイクロバッチで追加する。各マイクロバッチが短時間でコミットされると、同じ `order_date=2026-11-23` に小さなデータファイルが多数できる。ファイル数が増えると、テーブルのメタデータ量とクエリのファイルオープン回数が増えるため、読み取りの計画・実行コストが上がる。Iceberg 公式ドキュメントも、ストリーミングが小さいデータファイルを作り得るため、データファイルのコンパクションが必要になると説明している。[出典: Apache Iceberg Maintenance - Compact data files](https://iceberg.apache.org/docs/nightly/maintenance/)

## 2. コンパクションは圧縮ではなくデータファイルの再構成

ここでいうコンパクションは、複数の入力データファイルを読み、同じ論理データをより少数の出力データファイルへ**書き直す（rewrite）**処理である。Parquet の codec を変える、列を圧縮する、といったバイト列の圧縮とは目的も処理単位も異なる。Delta Lake の `OPTIMIZE` も、小ファイルを大きなファイルへまとめる bin-packing であり、データ変更ではないことをトランザクションログの `dataChange = false` で表す。[出典: Delta Lake Optimizations](https://docs.delta.io/optimizations-oss/), [出典: Delta Lake Utility Commands](https://docs.delta.io/delta-utility/)

## 3. 対象パーティションと入力ファイルを選ぶ

プランナーは `orders` のファイル一覧・サイズ・パーティション値を調べ、例えば `order_date=2026-11-23` のうち目標サイズ未満のファイルを候補にする。全表を毎回書き直すのではなく、到着が集中したパーティションやファイル数が閾値を超えたパーティションを対象にする。Iceberg の `rewrite_data_files` はパーティションを絞る `where` と、目標ファイルサイズなどのオプションを提供し、Delta の `OPTIMIZE ... WHERE` もパーティション述語で対象を限定できる。[出典: Apache Iceberg Spark Procedures - rewrite_data_files](https://iceberg.apache.org/docs/latest/spark-procedures/), [出典: Delta Lake Optimizations](https://docs.delta.io/optimizations-oss/)

## 4. bin-packing と任意の sort rewrite

標準の **bin-packing** は小さい入力をまとめ、ほぼ均一なサイズの出力ファイルを作る。まずファイルオープン数とメタデータを減らしたい `orders` には、通常これが費用と効果のバランスを取りやすい。注文検索で `customer_id` や `order_status` の局所性を高めたい場合だけ、**sort rewrite**（Delta では Z-Ordering など）を選択肢にする。ただし sort はデータを並べ替える追加 CPU・I/O を使い、列を増やすほど局所性の効果が落ちる場合があるため、常に有効とは限らない。[出典: Apache Iceberg Procedures - binpack and sort](https://iceberg.apache.org/docs/nightly/spark-procedures/), [出典: Delta Lake Optimizations - Z-Ordering](https://docs.delta.io/optimizations-oss/)

## 5. 新ファイルを作り、メタデータを原子的にコミットする

rewrite ジョブは入力を読み、新しいデータファイルをオブジェクトストレージへ一時的に書く。処理が完了したら、テーブル形式のメタデータ更新をコミットして、新ファイルを追加し、入力ファイルを現行スナップショットから外す。このコミットが読み取り側から見える切り替え点であり、読み取り中のクエリは開始時点の一貫したスナップショットを使える。Iceberg はスナップショットをメタデータ更新としてコミットし、Delta はログへ `add`/`remove` アクションを原子的にコミットする。[出典: Apache Iceberg Specification](https://iceberg.apache.org/spec/), [出典: Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)

## 6. 旧ファイルはコミット直後に即削除しない

コミット後、入力ファイルは現行スナップショットからは外れるが、過去の時点読み取り、同時実行中の読み取り、リトライの安全性に必要な期間がある。そのため、旧ファイルの物理削除はスナップショットの期限切れや保持期間、孤児ファイルの掃除と分けて運用する。保持を短くしすぎると時点読み取りや長時間クエリを壊し得る一方、長くしすぎるとストレージ費用が増える。具体的な日数は利用者の復旧・監査要件で決め、このモデルでは固定しない。[出典: Apache Iceberg Maintenance](https://iceberg.apache.org/docs/nightly/maintenance/), [出典: Delta Lake Optimizations - vacuum and retention](https://docs.delta.io/optimizations-oss/)

## 7. 実行頻度と費用を調整する

コンパクションは読み取り時のファイルオープン・メタデータ負荷を減らす代わりに、入力ファイルの再読込、出力書込、並べ替え、コミット競合、計算時間を追加する。マイクロバッチごとに同期実行すると書き込み遅延と競合が増えるため、ファイル数・平均サイズ・対象パーティションのクエリ頻度を監視し、非同期の定期ジョブまたは自動コンパクションの閾値で費用を制御する。Delta の auto compaction は書き込み成功後に同期実行されるため、レイテンシーとのトレードオフを確認する。[出典: Apache Iceberg Maintenance](https://iceberg.apache.org/docs/nightly/maintenance/), [出典: Delta Lake Optimizations - Auto compaction](https://docs.delta.io/optimizations-oss/)

## 8. シナリオの見方

「注文の日次パーティションを整理する」では、(1) ストリーミングの小ファイルを観測し、(2) 対象パーティションを選び、(3) bin-packing または必要時だけ sort rewrite を実行し、(4) 新スナップショットをコミットしてから保持期間後に旧ファイルを掃除する。`compact-orders` のリンクを順に選ぶと、この流れを追える。[出典: 本文 §1–§7]
