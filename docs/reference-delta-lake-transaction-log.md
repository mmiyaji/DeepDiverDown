# Delta Lake：トランザクションログとチェックポイント

## 1. 対象

表ディレクトリ内の `_delta_log` が、コミット、チェックポイント、読み取り時の再生、同時書き込みの競合検出をどう担うかを扱う。データファイルの整理と削除は [Delta Lake：コンパクションと古いファイルの削除](reference-delta-lake-optimize-vacuum.md) で扱う。

## 2. JSON コミット

ライターは新しいデータファイルを書いた後、`_delta_log` に次のバージョンの JSON ファイルを作る。ファイル名は 20 桁にそろえたバージョン番号で、中身は `add`、`remove`、`metaData` などのアクションである。バージョンの作成は、同名ファイルがあれば失敗する排他的な作成に依存する。出典：[Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)

## 3. ログの再生

読み手は `_delta_log` のアクションを順に適用し、有効なデータファイルの集合を求める。`remove` されたファイルは集合から外れる。読み取り中に別のコミットが入っても、読み手は開始時に選んだバージョンの状態を使う。出典：同上

## 4. チェックポイント

チェックポイントは、あるバージョンまでの有効なアクションを Parquet にまとめたものである。`_last_checkpoint` が最新のチェックポイントを示し、読み手はその状態から後続の JSON コミットだけを再生する。チェックポイントの分割形式や追加形式はプロトコルのバージョンに依存する。出典：同上

## 5. 楽観的並行制御

書き込みは、最新バージョンを読み、新しいファイルを書き、コミット前に検査する。読んだ後に入ったコミットが、読んだファイルを削除した場合や、読んだ範囲に追加した場合は、`ConcurrentDeleteReadException` や `ConcurrentAppendException` などの例外で失敗する。INSERT 同士は衝突しない。UPDATE・DELETE・MERGE・コンパクションは、同じファイルに触れると衝突する。出典：[Concurrency control](https://docs.delta.io/latest/concurrency-control.html)

## 6. シナリオの見方

「競合を検査してコミットし、再生して読む」では、データファイルを書き、読んだ後のコミットを検査し、次のバージョンを作る。読み手は `_last_checkpoint` からチェックポイントを選び、後続コミットを再生して有効ファイルを読む。

## 7. 実装例：AWS の EMR on EC2・Spark・S3

EMR on EC2 の Spark が、Delta Lake を使って S3 のテーブルを書き、読む。S3 のプレフィックスにデータファイルと `_delta_log` を置く。

| 機能 | 担い手 |
| --- | --- |
| 書き込みエンジン | Spark の書き込みジョブ |
| 競合の検査 | Spark 内の Delta ライブラリ |
| 新しいデータファイル | S3 の Parquet |
| JSON コミットファイル | S3 の `_delta_log` |
| チェックポイント・`_last_checkpoint` | 同じ `_delta_log` |
| 読み取りエンジン・再生した表の状態 | Spark の読み取りジョブ |

EMR は EC2 クラスタを管理し、YARN が Spark の実行リソースを割り当てる。複数クラスターからの同時書き込みには、概要図の実装例にある LogStore の設定が別に必要である。この構成は公式資料を組み合わせた例で、実環境の動作は検証していない。

## 8. 未確認

チェックポイントを書く間隔の既定値、競合時の再試行方針、S3 での同時コミットの挙動は未確認である。

## 公式資料

- [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)
- [Concurrency control](https://docs.delta.io/latest/concurrency-control.html)
- [Use a Delta Lake cluster with Spark](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/Deltausing-cluster-spark.html)
- [Delta Lake Storage configuration](https://docs.delta.io/delta-storage/)
