# Apache Hudi：Copy-on-Write と Merge-on-Read

## 1. 対象

同じレコードキーへの更新を、Copy-on-Write（CoW）の表と Merge-on-Read（MoR）の表がどう書き、どう読むかを扱う。MoR のログファイルとコンパクションを含む。タイムラインとコミットは前の図で扱う。出典は [Hudi Table & Query Types](https://hudi.apache.org/docs/table_types/)。

## 2. CoW の書き込み

CoW は、更新を受けるたびに該当するベースファイル（Parquet）を、更新込みの新しいバージョンへ書き直す。ログファイルを持たないため、読み取りはベースファイルだけで済む。書き込みでは、更新が 1 件でもファイル全体を書き直す。

## 3. MoR の書き込み

MoR は、更新をログファイルへ追記し、ベースファイルを書き換えない。書き込みの I/O は CoW より小さくなりやすい。ログに積まれた更新は、読み取りかコンパクションでベースにマージされるまでベースの外にある。

## 4. コンパクション

コンパクションは、MoR のベースファイルとログファイルをマージして新しいベースファイルを書く。計画はタイムラインに compaction の instant として記録する。実行は、書き込みと同じジョブの非同期処理、または別のジョブで動かせる。コンパクションが終わるまで、読み取りはログのマージを続ける。起動条件の選び方は未確認である。

## 5. 読み取り

Snapshot query は、CoW ならベースファイルだけを読む。MoR ならベースとログをマージして最新の内容を返し、ログが長いほどマージの負担が増える。Read Optimized query は MoR のベースファイルだけを読み、コンパクション済みの内容を返す。コンパクション前の更新は見えない。

## 6. 選び方の目安

更新の少ない表や読み取りの速さを優先する表は CoW が合う。更新が頻繁で書き込みのレイテンシーを抑えたい表は MoR が合う。実データでの差は未測定である。

## 7. 未確認

コンパクションの起動条件、実データでの書き込み量と読み取り時間の差、コンパクションの所要時間は未確認である。ファイルグループ・ファイルスライスの命名とログの形式も扱わない。実装例の構成全体は動作を確かめていない。

## 8. 実装例：自前の Kafka・Spark・HDFS

運用者が自前 Linux 上に Kafka、Spark、HDFS を用意する。Spark 上の Hudi Streamer が Kafka の更新を読み、CoW と MoR の別の表を HDFS に書く。MoR のコンパクションは、Streamer とは別の Spark ジョブで実行する。クエリは Spark SQL で、Snapshot と Read Optimized を切り替えて読む。

| 機能 | 担い手 |
| --- | --- |
| 更新イベント | Kafka の注文更新トピック |
| Hudi 書き込みジョブ | Spark 上の Hudi Streamer |
| CoW のベースファイル | HDFS の CoW 表 |
| MoR のログ・ベースファイル | HDFS の MoR 表 |
| コンパクションの計画 | HDFS 上の `.hoodie` |
| コンパクション処理 | Spark のコンパクションジョブ |
| Snapshot・Read Optimized クエリ | Spark SQL |

[Hudi Docker Demo](https://hudi.apache.org/docs/docker_demo/) では、MoR の取り込み時にコンパクションを無効にして別に実行する。注文データの構成は説明用で、動作は未検証である。

## 9. 実装例：AWS の EMR on EC2・MSK・S3

同一 AWS アカウントで、EMR が EC2 クラスタを管理する。YARN 上の Spark で Hudi Streamer を動かし、Amazon MSK のトピックから更新を読み、S3 の CoW 用と MoR 用の別プレフィックスへ書く。MoR のコンパクションは、Streamer と同じ Spark アプリケーションの非同期処理、または別の Spark ジョブで動かす。クエリは EMR の Spark SQL で、クエリ方式を設定して Snapshot と Read Optimized を切り替える。

| 機能 | AWS での担い手 |
| --- | --- |
| 更新イベント | Amazon MSK のトピック |
| Hudi 書き込みジョブ | EMR on EC2 の Spark / Hudi Streamer |
| CoW のベースファイル | S3 の CoW 用プレフィックス |
| MoR のログ・ベースファイル | S3 の MoR 用プレフィックス |
| コンパクションの計画と処理 | MoR の `.hoodie` と EMR 上のコンパクション |
| Snapshot・Read Optimized クエリ | EMR の Spark SQL |

AWS は EMR、EC2、MSK、S3 の基盤を運用し、利用者はクラスタ、ゲスト OS、ジョブ、データ、権限を管理する。EMR のリリースごとの Hudi・Spark の版は確認が必要で、この組み合わせは動作を確かめていない。

## 公式資料

- [Apache Hudi Table & Query Types](https://hudi.apache.org/docs/table_types/)
- [Apache Hudi Compaction](https://hudi.apache.org/docs/compaction/)
- [Apache Hudi Streamer Deployment](https://hudi.apache.org/docs/deployment/)
- [Apache Hudi Docker Demo](https://hudi.apache.org/docs/docker_demo/)
- [Amazon EMR Release Guide：How Hudi works](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-hudi-how-it-works.html)
- [Amazon MSK Developer Guide](https://docs.aws.amazon.com/msk/latest/developerguide/what-is-msk.html)
- [Amazon EMR Management Guide](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-overview.html)
- [AWS Shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
