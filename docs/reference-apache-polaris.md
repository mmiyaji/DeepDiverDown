# Apache Polaris の Iceberg カタログ

## 1. 管理 API とテーブル操作

Polaris は Iceberg REST Catalog を実装する。管理者は管理 API でカタログ、Principal、ロール、権限を設定し、処理エンジンは Iceberg REST API で namespace やテーブルを操作する。本図は内部カタログと AWS S3 を使う構成を扱う。2026 年 11 月時点の公式ダウンロードページで最新の版は 1.9.0（2026 年 11 月 14 日公開）で、本図の参照版と一致する。

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

## 6. 実装例：Spark・Polaris・Amazon S3

Spark から Polaris に接続し、カタログ状態を JDBC で永続化して S3 を読み書きする例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| カタログ管理者 | 運用者の管理 CLI | 管理 API でカタログとロールを作る。 |
| 処理エンジン | Apache Spark SQL | Iceberg REST に接続してファイルを読み書きする。 |
| 管理 API・Iceberg REST API・ロール・権限判定 | Polaris Server | 管理 API と Iceberg REST と権限判定を一つのサーバーで提供する。 |
| カタログ状態 | PostgreSQL（JDBC 永続化） | カタログ状態を永続化する。 |
| 認証情報の発行 | AWS STS | IAM ロールの短期セッションを発行する。 |
| オブジェクトストレージ | Amazon S3 | Iceberg メタデータとデータファイルを置く。 |
| 実装で追加 | カタログ用 IAM ロール | Polaris 実行元を信頼し、対象バケットへの権限を定義する。 |

Polaris 実行元をカタログ用 IAM ロールの信頼ポリシーに設定する。Spark の一時認証情報の範囲は IAM と Polaris の権限に依存する。

[Role-Based Access Control](https://polaris.apache.org/releases/1.9.0/managing-security/access-control/)、[Configuring S3 Storage](https://polaris.apache.org/releases/1.9.0/configuration/configuring-polaris-for-production/configuring-aws-s3-cloud-storage-specific/)、[Polaris JDBC・PostgreSQL・Spark SQL](https://polaris.apache.org/guides/jdbc/)


### AWS 上の実行環境

この例は EKS 上の Polaris Server Pod と、EMR on EC2 上の Spark SQL を分けて配置する。Polaris の Helm 構成は JDBC の永続メタストアとして RDS for PostgreSQL を利用し、Iceberg データとメタデータは S3 に置く。Polaris は指定した IAM ロールと AWS STS により、設定に応じてクライアントへ一時認証情報を発行する。Spark と Polaris はそれぞれの実行基盤を個別に構成する。

| 役割 | AWS 上の担い手 |
| --- | --- |
| SQL の実行 | Amazon EMR on EC2 の Spark |
| カタログ API と権限判定 | EKS の Polaris Server Pod |
| Kubernetes 実行先 | EKS と EC2 マネージドノードグループ |
| カタログ状態 | RDS for PostgreSQL の JDBC 永続化 |
| データ保存・委任認証 | S3、IAM ロール、AWS STS |

ネットワーク経路、認証、秘密情報、ロールの信頼ポリシーとアクセス範囲を設定する。Polaris のデフォルト in-memory 永続化は再起動で失われるため利用しない。S3 のバケットとロールを追加するだけで Polaris や Spark が自動的に配備されるわけではない。

[Polaris Helm persistence](https://polaris.apache.org/releases/1.9.0/helm-chart/persistence/)、[Polaris S3](https://polaris.apache.org/releases/1.9.0/configuration/configuring-polaris-for-production/configuring-aws-s3-cloud-storage-specific/)、[Amazon EMR Spark](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-spark.html)、[EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)、[RDS for PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)。

AWS は EKS の制御プレーンを運用し、利用者は Kubernetes API とクラスタ設定、Polaris のデプロイを操作する。制御プレーンのサーバーへの直接アクセスは伴わない。マネージドノードグループは AWS がライフサイクルを管理し、利用者はノードとワークロードの設定を管理する。EMR の Spark は EC2 ノードと YARN 上で実行する。RDS、S3、STS の基盤は AWS が運用し、利用者はデータ、権限、ロールの信頼関係を設定する。公式資料を組み合わせた構成で、各バージョンの組み合わせと実動作は未検証。[AWS 共有責任](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)、[EKS マネージドノードグループ](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
