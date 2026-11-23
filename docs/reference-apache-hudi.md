# Apache Hudi の基本アーキテクチャ

## 1. 更新イベントの取り込み

Hudi は更新・挿入・削除をテーブルのコミットとして取り込み、ストレージ上のファイルを世代管理する。CDC や増分処理では、コミットのタイムラインを下流処理の入力にできる。出典 [Hudi Concepts](https://hudi.apache.org/docs/concepts/)

## 2. Copy-on-Write

Copy-on-Write（CoW）は更新時に列指向のベースファイルを書き換える。読み取りはベースファイルだけで済むため読み取り性能を優先するが、更新時の I/O は大きくなる。出典 [Hudi Concepts](https://hudi.apache.org/docs/concepts/)

## 3. Merge-on-Read

Merge-on-Read（MoR）はベースファイルに加えてログファイルへ更新を追記し、読み取り時にマージする。必要に応じてコンパクションでログを新しいベースファイルへ反映し、書き込みレイテンシーと読み取りコストを調整する。出典 [Hudi Concepts](https://hudi.apache.org/docs/concepts/)

## 4. タイムラインとクエリ

Snapshot query はコミット済みの最新状態を読み、Incremental query は指定したコミット以降の変更を読む。MoR の Read Optimized query はベースファイルだけを読み、コンパクション後の状態を使う。出典 [Hudi Concepts](https://hudi.apache.org/docs/concepts/)

## 5. シナリオの見方

「CDC 更新を取り込む」では、更新イベントをコミットし、CoW ならベースファイルを書き換え、MoR ならログへ追記してから snapshot または incremental query で読む。`upsert-cdc` のリンクを順番に選択すると比較できる。

## 6. 実装例：Hudi Streamer・Kafka・Spark

Hudi の Docker デモをもとに、Kafka の変更を Spark 上の Hudi Streamer で取り込み、表の配置を比較する例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| CDC / 更新イベント | Kafka の注文更新トピック | Hudi Streamer が読む変更を保持する。 |
| Hudi Timeline | Hudi のタイムライン（`.hoodie`） | コミットとテーブル保守の状態を記録する。 |
| Copy-on-Write Base Files | 分散ファイルシステムの COW テーブル | 更新済みベースファイルを置く。 |
| Merge-on-Read Log Files | 分散ファイルシステムの MOR テーブル | 更新ログとベースファイルを維持する。 |
| Compactor | Hudi Streamer の非同期コンパクション | MOR の変更ログをベースファイルへ統合する。 |
| Query Engine | Spark SQL | Hudi のテーブルを読む。 |
| 分析結果 | Spark SQL の集計結果 | 読み取り後のデータを利用者へ返す。 |
| 実装で追加 | Hudi Streamer（Spark） | Kafka から取り込み、キーで更新を適用する。 |

Docker デモの Spark master / worker、Kafka broker、HDFS NameNode / DataNode をローカルホスト上のコンテナで動かす。Streamer は Kafka を読み HDFS にテーブルを書き、Spark SQL が読む。図の注文データと連続モードはデモを基にした説明用の変更であり、公式デモそのものは株価データを使う。公式デモでは MoR の取り込み時にコンパクションを無効にして別に実行する。構成を組み合わせた例であり、この注文データの構成は動作未検証。Copy-on-Write と Merge-on-Read は別のテーブルで試す。Merge-on-Read では Hudi Streamer の連続モードで非同期コンパクションを選べる。順序付けとレコードキーはデータ契約に合わせて設定する。

[Hudi Docker Demo](https://hudi.apache.org/docs/docker_demo/)、[Apache Hudi Concepts](https://hudi.apache.org/docs/concepts/)、[Hudi Streamer Deployment](https://hudi.apache.org/docs/deployment/)、[Hudi Compaction](https://hudi.apache.org/docs/compaction/)

## 7. 実装例：AWS の EMR on EC2・MSK・Glue Data Catalog・S3

同一 AWS アカウントで EMR が EC2 クラスタを管理する。YARN 上の Spark に Hudi Streamer を投入し、Amazon MSK の Kafka トピックから、上流が注文キーと更新内容を付けて配信したイベントを読む。CoW と MoR の比較には S3 の別々のテーブルプレフィックスを用いる。

| 機能配置 | AWS での担い手 |
|---|---|
| 更新イベントと取り込み | Amazon MSK の Kafka トピックと EMR の Hudi Streamer |
| タイムライン | 各テーブルの S3 プレフィックス内の `.hoodie` |
| CoW ベースファイル・MoR ベースとログ | 各テーブルの S3 プレフィックス |
| コンパクション | MoR を書く Streamer の Spark アプリケーション内で動く非同期コンパクション |
| クエリと分析結果 | EMR の Spark SQL と Hudi 読み取り、下流の分析利用者 |

Hudi の Hive 同期を有効にして Glue Data Catalog を metastore に設定すると、テーブルのスキーマと場所を同期できる。クエリ方式によって Hudi のタイムライン・ベースファイル・ログを使い分ける処理は Spark 側にある。MSK までのネットワーク到達性と Kafka クライアント認証を設定し、クラスタの IAM ロールに必要な S3 と Glue の操作を許可する。

- [Amazon EMR Release Guide — How Hudi works](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-hudi-how-it-works.html)
- [Apache Hudi — Streamer deployment](https://hudi.apache.org/docs/deployment/)
- [Apache Hudi — Compaction](https://hudi.apache.org/docs/compaction/)
- [Amazon MSK Developer Guide](https://docs.aws.amazon.com/msk/latest/developerguide/what-is-msk.html)
- [Amazon EMR Management Guide — Understanding Amazon EMR clusters](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-overview.html)

EMR のリリースごとに同梱 Hudi・Spark と Streamer の対応、Kafka 接続および Glue 同期設定を確認する必要がある。この資料の組み合わせは動作検証していない。 AWS は EMR、EC2、ストレージなどのサービス基盤を運用し、利用者はクラスタ、ゲスト OS、ジョブ、データおよび権限を管理する。EC2 上のソフトウェアには SSH やアプリケーションのインターフェースから操作できるが、マネージドサービスの内部基盤に直接アクセスすることを意味しない。

- [AWS — Shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
