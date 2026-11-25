# Trino の基本アーキテクチャ

Trino 484 の公式ドキュメントを基準に、構成部品・データの流れ・実行場所を整理する。Stage や Split の詳細、メモリ、プッシュダウンは「仕組みの深掘り」の図で扱う。

## 1. Trino の位置づけ

Trino は、テラバイトからペタバイト規模のデータを SQL で分析する分散クエリエンジンで、データウェアハウス的な集計やレポート（OLAP）を想定する。HDFS に限らず、RDB や Cassandra など多くのデータソースを読める。MySQL や PostgreSQL のような汎用 RDB の代わりにはならず、OLTP 向けでもない。

データ自体は Trino の外（オブジェクトストレージや RDB など）にあり、Trino は計算を担う。

## 2. Coordinator と Worker

- **Coordinator**：SQL を解析し、クエリを計画し、Worker を管理する。クライアントが接続する先で、REST API を通じて実行を調整する。
- **Worker**：Task を実行してデータを処理する。Connector からデータを取り、Worker どうしで中間データをやり取りする。起動時に Coordinator の discovery サービスへ登録し、定期的なハートビートで登録を保つ。
- 1 クラスタに Coordinator は 1 つ置く。大きなクラスタでは専用の Coordinator が望ましい。`node-scheduler.include-coordinator=false` にすると、Coordinator に処理を割り当てない。
- Worker は `coordinator=false` で起動し、Worker を足してスケールアウトする。

## 3. カタログと Connector

- **Connector**：データソースへのアダプターで、データベースのドライバーに近い。Trino の SPI を実装する。
- **カタログ**：1 つのデータソースへの接続設定。Connector 名、URL、認証情報などを持つ。`etc/catalog/<名前>.properties` を置くと、その名前のカタログができる。`connector.name` の指定が必須で、同じ Connector で複数のカタログを作れる。
- **スキーマ・テーブル**：カタログとスキーマの組み合わせで、問い合わせられる対象が決まる。型の対応は Connector ごとに決まる。
- Iceberg Connector は、メタストア（Hive metastore、AWS Glue、JDBC、REST、Nessie、Snowflake カタログ）と、対応するファイルシステム（S3、GCS、Azure、HDFS）を設定して使う。

## 4. データの流れ

1. クライアントが SQL を Coordinator に送る。
2. Coordinator が分散クエリ計画を作り、Connector にテーブルのメタデータと読み取り単位（Split）の一覧を問い合わせる。
3. Coordinator が Worker の Task に Split を割り当てる。
4. Worker が Connector を通してデータソースを読み、処理する。Stage 間の中間データは Exchange で渡す。
5. 結果は Coordinator 経由でクライアントに返る（direct protocol）。spooling protocol では Worker が結果の断片をオブジェクトストレージに書き、クライアントが直接読む。

Statement（SQL 文）と Query（その実行）、Stage・Task・Split・Driver・Operator・Exchange の関係は、次の「Trino：Stage・Task・Split と Exchange」で扱う。

## 5. 動く場所

- 各ノードを `node.properties`（環境名、ノード ID、データディレクトリ）と `config.properties` で構成する。Coordinator と Worker は同じ環境名にする。
- 実行には 64 ビットの Java 25 が必要（25.0.1 以降）。
- Kubernetes では公式の Helm チャートが Coordinator 1 つと Worker 複数を配置する。カタログは Helm の values の `catalogs` に書く。Pod は非公開ネットワークで動くため、外部公開は別途構成する。Worker は少数の大きな Pod が向き、同じ物理ホストに複数の Trino Pod を置かないことが推奨される。

## 6. 実装例：EKS 上の Trino・Glue Catalog・S3

EKS の EC2 マネージドノードグループに Trino Helm チャートを配置し、Coordinator と Worker を別 Pod で実行する例。Iceberg Connector は Glue Data Catalog でテーブルのメタデータ位置を解決し、Coordinator と Worker は必要なメタデータやデータファイルを Amazon S3 から読み取る。クライアントは、別途設定した接続経路（port-forward や Kubernetes Service など）で Coordinator に SQL を送る。

| 機能 | 担い手 |
| --- | --- |
| クライアント | 外部の Trino CLI |
| Coordinator・カタログ設定・Connector | Trino Coordinator Pod（Iceberg Connector） |
| Worker・Connector | Trino Worker Pods |
| メタストア | AWS Glue Data Catalog |
| データソース | Amazon S3 上の Iceberg テーブル |
| 実行基盤 | EKS の Kubernetes 制御プレーンと EC2 ノードグループ |
| AWS アクセス | Pod の Kubernetes Service Account に対応する IAM ロール |

カタログに `iceberg.catalog.type=glue` と `fs.s3.enabled=true` を指定する。EKS の IAM roles for service accounts を使う場合、S3 は `s3.auth-type=WEB_IDENTITY`、Glue は `hive.metastore.glue.use-web-identity-token-credentials-provider=true` が公式に用意されている（Iceberg の Glue カタログも同じ Glue 設定を受け付ける）。Coordinator と Worker の両方に、必要な S3・Glue の権限が要る。ロールやポリシーが自動で作られるわけではない。

AWS が EKS 制御プレーンと EC2・Glue・S3 の基盤を運用する。利用者は Kubernetes API、ノードグループ、Trino の配置・設定・更新、カタログ、S3 データ、IAM 権限を管理する。EKS が Trino をマネージドサービスとして運用するわけではない。図は公式資料を組み合わせた代表例であり、実動作は未検証。クライアントの公開方式、Glue と S3 のネットワーク経路、Trino・Iceberg・EKS のバージョン互換性は未確認。

## 公式資料

- [Trino · Use cases](https://trino.io/docs/current/overview/use-cases.html)
- [Trino · Concepts](https://trino.io/docs/current/overview/concepts.html)
- [Trino · Deploying Trino](https://trino.io/docs/current/installation/deployment.html)
- [Trino · Client protocol](https://trino.io/docs/current/client/client-protocol.html)
- [Trino · Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)
- [Trino · Metastores](https://trino.io/docs/current/object-storage/metastores.html)
- [Trino · S3 file system support](https://trino.io/docs/current/object-storage/file-system-s3.html)
- [Trino · Trino on Kubernetes with Helm](https://trino.io/docs/current/installation/kubernetes.html)
- [Amazon EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [IAM roles for service accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
