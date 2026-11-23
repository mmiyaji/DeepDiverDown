# Apache Polaris の Iceberg カタログ

## 1. 管理 API とテーブル操作

Polaris は Iceberg REST Catalog を実装する。管理者は管理 API でカタログ、Principal、ロール、権限を設定し、処理エンジンは Iceberg REST API で namespace やテーブルを操作する。本図は内部カタログと AWS S3 を使う構成を扱う。

[Apache Polaris 1.9.0 Documentation](https://polaris.apache.org/releases/1.9.0/)、[Using the Polaris REST APIs with curl](https://polaris.apache.org/guides/rest-api/)

## 2. テーブル解決と書き込み

エンジンはカタログ、namespace、テーブルから Iceberg メタデータを解決する。書き込みではエンジンがファイルをストレージに置き、更新内容と事前条件を REST のコミット要求に含める。事前条件を満たした変更をカタログが公開し、競合時はクライアントが最新状態を読み直す。

[Apache Polaris 1.9.0 Documentation](https://polaris.apache.org/releases/1.9.0/)、[Iceberg REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)

## 3. Principal とカタログ権限

Principal に Principal Role、Principal Role に Catalog Role を割り当てる。Catalog Role は特定のカタログに属し、カタログ、namespace、テーブルなどへの操作権限を持つ。たとえば分析用の Principal にはテーブルの読み取りに必要なロールを付与する。

[Role-Based Access Control](https://polaris.apache.org/releases/1.9.0/managing-security/access-control/)

## 4. ストレージの認証情報

AWS S3 の例では、Polaris がカタログの IAM ロールを AWS STS で引き受け、対象と操作を絞った一時認証情報をクライアントに返す。エンジンはその認証情報で直接 S3 にアクセスする。カタログ権限に加えて IAM ロールの信頼関係と許可範囲も確認する。

[Configuring S3 Storage](https://polaris.apache.org/releases/1.9.0/configuration/configuring-polaris-for-production/configuring-aws-s3-cloud-storage-specific/)

## 5. シナリオの見方

「注文テーブルを読む」では、読み取り用の権限設定から、テーブル解決、一時認証情報、実ファイルの読み出しまでを追う。「追加ファイルを公開する」では、アップロードからカタログコミットまでの順序を追う。例の名前と権限構成は説明用。
