# データレイクハウスの基本アーキテクチャ（Apache Iceberg 例）

## 1. 読み方と範囲

クラウドオブジェクトストレージ上の Iceberg テーブルを、計算エンジンとカタログが利用する構成を示す。計算、データ、メタデータを分離して考える。

出典 [Databricks Reference Architectures](https://docs.databricks.com/aws/en/lakehouse-architecture/reference)・[Apache Iceberg Terms](https://iceberg.apache.org/terms/)

## 2. 計算と共有ストレージ

ETL やクエリを実行する計算エンジンは、クラウドストレージにあるテーブルへアクセスする。計算資源と保存資源を別々に増減できる構成として読む。

出典 [Databricks Reference Architectures](https://docs.databricks.com/aws/en/lakehouse-architecture/reference)

## 3. Catalog とテーブル解決

カタログはテーブル名や場所、スキーマなどを解決し、計算エンジンが対象テーブルを見つける入口になる。ガバナンス機能は利用するカタログの製品・設定に依存する。

出典 [Databricks Reference Architectures](https://docs.databricks.com/aws/en/lakehouse-architecture/reference)・[Apache Iceberg Java API](https://iceberg.apache.org/docs/latest/api/)

## 4. Iceberg のメタデータ木

Iceberg の snapshot はある時点のテーブル状態を示し、manifest list と manifest がその snapshot を構成するデータファイルを列挙する。メタデータの統計はスキャン計画にも使われる。

出典 [Apache Iceberg Terms](https://iceberg.apache.org/terms/)・[Iceberg Specification](https://iceberg.apache.org/spec/)

## 5. 書き込みと読み出し

計算エンジンがデータファイルを書き、テーブル更新をコミットすると新しい snapshot が参照される。読み手はカタログでテーブルを解決し、メタデータから必要なデータファイルを選ぶ。

出典 [Apache Iceberg Java API](https://iceberg.apache.org/docs/latest/api/)・[Apache Iceberg Terms](https://iceberg.apache.org/terms/)

## 6. シナリオ

「Iceberg テーブルの書き込みと読み出し」シナリオをクリックすると、計算、Catalog、snapshot、manifest、データファイルの順に追える。

## 7. ストレージ階層とライフサイクル

オブジェクトストレージには、アクセス頻度に応じた保存クラスがある（例：S3 の Standard、Standard-IA、Glacier 系）。ライフサイクルルールで、作成から一定日数を過ぎたオブジェクトを安い保存クラスへ自動的に移せる。安いクラスほど保存料金は下がるが、取り出し料金や最低保存期間がかかり、アーカイブ系のクラスは読む前に復元（restore）が必要で、すぐには読めない。テーブルのデータファイルを移すときは、クエリが参照する可能性のある範囲を移さないよう、パーティションや保持期間と合わせて設計する。出典 [Amazon S3 storage classes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html)、[S3 Lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)

## 8. 実装例：Amazon Athena・Glue・S3 の Iceberg

Amazon Athena エンジン v3 のワークグループで、Glue に登録した S3 の入力 Parquet を `INSERT INTO … SELECT` で Iceberg v2 に追記し、`SELECT` の結果を別の S3 領域へ返す例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| Compute Engine | Amazon Athena エンジン v3 | Iceberg v2 のテーブル解決と SQL 読み書きを担う。 |
| Catalog | AWS Glue Data Catalog | 現在のテーブルメタデータを指し、楽観的ロックを適用する。 |
| Iceberg Snapshot・Table Metadata | S3 の Iceberg メタデータと Snapshot | テーブル定義とスナップショットをファイルに保持する。 |
| Manifest List / Files | S3 の Manifest List と Manifest | 対象スナップショットのファイルと統計を格納する。 |
| Data Files | S3 の Parquet ファイル | テーブルの行データを保存する。 |
| 実装で追加 | S3 Lifecycle ルール | データの利用頻度に応じて対象オブジェクトの保存クラスを変える。 |
| 取り込みと結果提供 | S3 の入力領域とワークグループのクエリ結果領域 | Iceberg テーブル本体と分ける。 |

Athena で更新する Iceberg テーブルには AWS Glue の楽観的ロックを使う。S3 Lifecycle はファイルの管理を担う。現在も参照されるファイルは即時読み取り可能なクラスに保ち、復元が要るアーカイブクラスへ移す対象は、テーブルの参照と保持条件を確かめて選ぶ。

この例は IAM で管理する Glue テーブルを前提とする。ロード担当には入力の参照、テーブルデータと Glue メタデータの更新を許可する。分析担当にはワークグループの使用、対象テーブルの参照、許可した結果領域へのアクセスを付与する。結果の S3 アクセスも別に制限する。

- [Athena のワークグループ](https://docs.aws.amazon.com/athena/latest/ug/creating-workgroups.html)
- [Athena の Iceberg 更新](https://docs.aws.amazon.com/athena/latest/ug/querying-iceberg-updating-iceberg-table-data.html)

[Apache Iceberg Terms](https://iceberg.apache.org/terms/)、[Query Apache Iceberg tables](https://docs.aws.amazon.com/athena/latest/ug/querying-iceberg.html)、[Create Iceberg tables](https://docs.aws.amazon.com/athena/latest/ug/querying-iceberg-creating-tables.html)、[S3 Lifecycle transition considerations](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html)

Athena は AWS がサーバーレス計算基盤を運用し、利用者は SQL、ワークグループ、結果保存先と権限を設定する。Glue と S3 の基盤は AWS が運用し、利用者はカタログ内容、データ、ライフサイクルと権限を管理する。内部の計算ノードを利用者が直接操作する構成ではない。公式資料を組み合わせた例であり、実動作は未検証。[Athena の耐障害性](https://docs.aws.amazon.com/athena/latest/ug/security-resilience.html)、[AWS 共有責任](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
