# Delta Lake：コンパクションと古いファイルの削除

## 1. 対象

小さなデータファイルを統合する OPTIMIZE と、不要になったファイルを物理的に削除する VACUUM を扱う。VACUUM が表のどのバージョンを読めなくするかも含める。ログの構造は [Delta Lake：トランザクションログとチェックポイント](reference-delta-lake-transaction-log.md) で扱う。

## 2. OPTIMIZE

OPTIMIZE は小さなファイルを読み、大きなファイルに書き直して、`add` と `remove` を新しいバージョンとしてコミットする。同じコマンドを続けて実行しても、2 回目は変更しない。`WHERE` でパーティションを絞れる。`ZORDER BY (列)` を付けると、その列の値が近い行を同じファイルに集め、データスキップの効果を上げる。ZORDER は実行のたびに対象パーティションのファイルを再配置する。OPTIMIZE はデータの内容を変えないため、実行前後で読み取り結果は同じである。出典：[Optimizations](https://docs.delta.io/latest/optimizations-oss.html)

## 3. VACUUM

VACUUM は、ログが参照せず、保持期間より古いデータファイルを削除する。自動では実行されない。保持期間の既定は 7 日である。これより短くするとコマンドが安全確認で止まる。確認は `spark.databricks.delta.retentionDurationCheck.enabled` で無効にできるが、保持期間より長く動く処理が表にない場合に限る。公式資料は、読み手や書き手が古いスナップショットを使い続ける場合に備えて 7 日以上を勧める。`_delta_log` のファイルは VACUUM の対象外で、チェックポイントの後に非同期で削除され、保持期間は `delta.logRetentionDuration`（既定 30 日）で決まる。出典：[Table utility commands](https://docs.delta.io/latest/delta-utility.html)

## 4. タイムトラベルへの影響

過去のバージョンを読むには、そのバージョンで有効だったデータファイルが残っている必要がある。OPTIMIZE で `remove` されたファイルは VACUUM まで物理的に残るため、その間は統合前のバージョンを読める。VACUUM で削除すると、保持期間より古いバージョンへはタイムトラベルできなくなる。

## 5. 同時書き込みとの関係

コンパクションは UPDATE・DELETE・MERGE や別のコンパクションと、同じファイルに触れると衝突し、`ConcurrentDeleteDeleteException` などで失敗する。INSERT とは衝突しない。読み手はスナップショットを使うため、OPTIMIZE がファイルを `remove` しても中断されない。出典：[Concurrency control](https://docs.delta.io/latest/concurrency-control.html)

## 6. シナリオの見方

「統合し、期間を過ぎたファイルを消す」では、OPTIMIZE が新しいバージョンをコミットし、VACUUM が保持期間を過ぎた旧ファイルを削除する。最後に、削除前後のバージョンを読んだ結果が変わることを確かめる。

## 7. 実装例：AWS の EMR on EC2・Spark・S3

EMR on EC2 の Spark ジョブが、S3 の Delta テーブルに対して OPTIMIZE と VACUUM を実行する。

| 機能 | 担い手 |
| --- | --- |
| OPTIMIZE ジョブ | Spark の OPTIMIZE ジョブ |
| VACUUM ジョブ | Spark の VACUUM ジョブ |
| 小さなファイル群・remove 済みの古いファイル | S3 の統合前の Parquet |
| 統合したデータファイル | S3 の統合後の Parquet |
| `_delta_log` | 同じ S3 プレフィックスの `_delta_log` |
| 保持期間の設定 | テーブルプロパティまたは VACUUM コマンドの指定 |
| 過去版の読み取り | Spark のバージョン指定読み取り |

OPTIMIZE と VACUUM の実行契機（EMR のステップ、別のスケジューラなど）は公式資料で確認しておらず、利用者の運用に依存する。この構成は公式資料を組み合わせた例で、実環境の動作は検証していない。

## 8. 未確認

OPTIMIZE の既定の目標ファイルサイズ（公式の OSS ドキュメントに記載がなく、未確認）、実環境の所要時間、`delta.deletedFileRetentionDuration` との関係は未確認である。

## 公式資料

- [Optimizations](https://docs.delta.io/latest/optimizations-oss.html)
- [Table utility commands](https://docs.delta.io/latest/delta-utility.html)
- [Concurrency control](https://docs.delta.io/latest/concurrency-control.html)
- [Use a Delta Lake cluster with Spark](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/Deltausing-cluster-spark.html)
