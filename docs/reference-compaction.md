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

## 9. 実装例：Spark プロシージャで Iceberg の小ファイルを整理

注文の Iceberg テーブルへ継続書き込みし、Spark の保守ジョブで小さなファイルをまとめる例。読み手のスナップショットと古いファイルの保持期間を管理する。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| マイクロバッチ書き込み | Spark のマイクロバッチ書き込み | Iceberg へ小さな Parquet ファイルを継続して追加する。 |
| 対象選択プランナー、データファイルの再作成 | Spark の rewrite_data_files | テーブルのファイル群を調べ、binpack 戦略で対象を選んで書き直す。 |
| 表の状態を管理するメタデータ、orders / order_date、公開された新しい読取時点 | Iceberg のテーブル・メタデータ・スナップショット | 注文データのファイル集合をスナップショットで管理し、再作成をコミットする。 |
| クエリエンジン | Spark SQL の読み手 | 読み取り時に選択したスナップショットの一貫した状態を参照する。 |
| 保持期限後の古いデータの整理 | Spark の expire_snapshots | 保護対象のスナップショットを保持し、期限切れのものと参照されなくなったファイルを整理する。 |

実装で加わる部品を以下に示す。

- コンパクションと保持の設定。対象ファイルの基準、出力サイズの目安、履歴を保持する期間を決めてから実行する。

公式資料

- [Apache Iceberg Maintenance](https://iceberg.apache.org/docs/nightly/maintenance/)
- [Apache Iceberg Spark Procedures](https://iceberg.apache.org/docs/latest/spark-procedures/)
- [Delta Lake Optimizations](https://docs.delta.io/optimizations-oss/)
- [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)
- [Iceberg Table Maintenance](https://iceberg.apache.org/docs/latest/maintenance/)

## 10. 実装例：AWS（Glue テーブルオプティマイザー）

注文を AWS Glue Streaming のマイクロバッチで取り込み、AWS Glue Data Catalog に登録した Iceberg v2 の Parquet テーブルへ追記する。テーブルにコンパクションとスナップショット保持を個別に設定する。

| 機能 | 担い手 |
| --- | --- |
| マイクロバッチ書き込み | AWS Glue Streaming ジョブ |
| 対象選択とデータファイルの再作成 | AWS Glue のコンパクションオプティマイザー |
| 現在の表の状態と新しいスナップショット | AWS Glue Data Catalog のメタデータ位置と S3 上の Iceberg メタデータ |
| 現行・過去スナップショットの読み取り | Amazon Athena のエンジン 3 |
| 期限切れスナップショットとファイルの整理 | AWS Glue のスナップショット保持オプティマイザー |

この例の再作成は binpack を使う。対象はファイル数・サイズなどの設定で決まり、出力の目安を `write.target-file-size-bytes` で設定できる。保持期間と最低保持数はコンパクションとは独立して設定する。保持のオプティマイザーはスナップショットを期限切れにする。`cleanExpiredFiles` を有効にすると、保持中のスナップショットが参照しない関連ファイルも整理する。

- [AWS Glue Streaming](https://docs.aws.amazon.com/glue/latest/dg/streaming-chapter.html)
- [AWS Glue のコンパクション設定](https://docs.aws.amazon.com/glue/latest/dg/enable-compaction.html)
- [AWS Glue のスナップショット保持設定](https://docs.aws.amazon.com/glue/latest/dg/enable-snapshot-retention.html)
- [Athena の Iceberg タイムトラベル](https://docs.aws.amazon.com/athena/latest/ug/querying-iceberg-time-travel-and-version-travel-queries.html)

自前例は Linux Spark Standalone と Kafka、HDFS 上の Hadoop カタログを仮定する。AWS 例は MSK を入力とし、Glue Streaming のチェックポイントを S3 の別パスに置く。AWS は Glue・MSK・Athena・S3 の基盤を運用し、利用者はジョブ、最適化と保持ポリシー、IAM・データを管理する。オプティマイザーの内部ホストは直接操作しない。どちらも公式資料を組み合わせた代表例で、ジョブ設定、認証、バージョンと実動作は未検証。
