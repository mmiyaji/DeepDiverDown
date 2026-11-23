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
