# Apache Hudi：タイムラインとコミット

## 1. 対象

Hudi の表で、書き込みのコミットが `.hoodie` 配下のタイムラインに instant として記録される流れと、読み取りがどの instant を基準にスナップショットを決めるかを扱う。コンパクションなど表の保守は次の図で扱う。出典は [Hudi Timeline](https://hudi.apache.org/docs/timeline/)。

## 2. instant の 3 つの状態

タイムラインは instant の列である。instant は、操作の種類（commit、deltacommit、compaction、clean、rollback など）、時刻、状態の組で表す。状態は requested、inflight、completed の 3 つで、書き込みは requested から inflight、completed の順に進む。requested は操作の計画、inflight は実行中、completed は完了を示す。

## 3. 書き込みのコミット

書き込みジョブは instant 時刻を 1 つ決め、requested の instant を作る。実行を始めると inflight に進み、データファイルを書く。ファイル名には書いた instant 時刻が入る。すべて書き終えて、inflight を completed にした時点がコミットである。コミットまでは、書いたファイルは読み取りの対象にならない。

## 4. 読み取りのスナップショット

Snapshot query は、読み取りの開始時点で completed の instant を基準にし、その時点までに完了したコミットのファイルを読む。inflight や requested の instant が書いたファイルは含めない。Incremental query は、指定した instant より後の completed の instant を読む。MVCC により、書き込み中でも読み取りは完了済みのスナップショットを使える。

## 5. 並行書き込み

複数の書き込みジョブが同じ表へコミットするときは、ロックプロバイダーで競合を確認する。ロックプロバイダーには ZooKeeper、Hive メタストア、DynamoDB、ファイルシステムを使うものがある。単一ライターの場合は、この設定を使わない。ライターとコンパクションなどの保守は、ロックを使わず MVCC で並行して動かせる場合がある。条件と制約は Hudi のバージョンに依存し、未確認である。

## 6. 失敗した書き込み

書き込みジョブが止まると、inflight の instant が残る。次の書き込みはそれを失敗とみなして巻き戻し、巻き戻しも instant としてタイムラインに記録する。読み取りは completed だけを見るため、残った inflight は影響しない。巻き戻しの時機や設定は未確認である。

## 7. 未確認

タイムラインのファイル配置と名前は Hudi のバージョンで異なり、この資料は配置を扱わない。ロックプロバイダーの実環境での動作と、競合時の再試行は未検証である。実装例の構成全体は動作を確かめていない。

## 8. 実装例：自前の Spark・HDFS・ZooKeeper

運用者が自前 Linux 上に Spark の master と worker、HDFS、ZooKeeper を用意する。Spark の Executor で Hudi の書き込みジョブを動かし、HDFS 上の表パスに `.hoodie` の instant とデータファイルを書く。複数ライターが同じ表を書く場合は ZooKeeper のロックプロバイダーを設定する。クエリは同じ Spark クラスター上の Spark SQL で動かす。

| 機能 | 担い手 |
| --- | --- |
| Hudi 書き込みジョブ | Spark 上の Hudi 書き込みジョブ |
| 並行書き込みのロック | ZooKeeper のロック |
| requested・inflight・completed の instant | HDFS 上の `.hoodie` |
| データファイル | HDFS 上の表パス |
| クエリエンジン | Spark SQL |

組み合わせは [Hudi Docker Demo](https://hudi.apache.org/docs/docker_demo/) と公式のロック設定を参考にした例であり、動作は未検証である。ZooKeeper を使う構成は公式デモには含まれない。

## 9. 実装例：AWS の EMR on EC2・S3・DynamoDB

同一 AWS アカウントで、EMR が EC2 クラスタを管理する。YARN 上の Spark で Hudi 書き込みジョブを動かし、S3 のテーブルパスに `.hoodie` の instant とデータファイルを書く。複数ライターが同じ表を書く場合は DynamoDB を使うロックプロバイダーを設定する。クエリは同じ EMR クラスタ上の Spark SQL で動かす。

| 機能 | AWS での担い手 |
| --- | --- |
| Hudi 書き込みジョブ | EMR on EC2 の Spark ジョブ |
| 並行書き込みのロック | DynamoDB のロック表 |
| requested・inflight・completed の instant | S3 のテーブルパス内の `.hoodie` |
| データファイル | S3 のテーブルパス |
| クエリエンジン | EMR の Spark SQL |

AWS は EMR、EC2、S3、DynamoDB の基盤を運用し、利用者はクラスタ、ゲスト OS、ジョブ、データ、権限を管理する。EMR のリリースごとに同梱の Hudi・Spark の版とロックプロバイダー設定を確認する必要がある。S3 のデータ整合や並行書き込みの制約は未確認で、この組み合わせは動作を確かめていない。

## 公式資料

- [Apache Hudi Timeline](https://hudi.apache.org/docs/timeline/)
- [Apache Hudi Concurrency Control](https://hudi.apache.org/docs/concurrency_control/)
- [Apache Hudi Docker Demo](https://hudi.apache.org/docs/docker_demo/)
- [Amazon EMR Release Guide：How Hudi works](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-hudi-how-it-works.html)
- [Amazon EMR Management Guide](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-overview.html)
- [AWS Shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
