# Iceberg カタログ経由の読み取り：カタログからページまで

## 1. 目的と前提

`SELECT ... FROM lake.db.events WHERE ...` を実行したとき、エンジンが**カタログ**に問い合わせてから、Parquet のページを読むまでの全経路を追う。カタログは REST カタログ（Iceberg REST Catalog 仕様）を例にする。Hive Metastore、AWS Glue、JDBC などのカタログでも「テーブル名 → 現在の metadata.json の場所」を返す役割は同じ。出典 [Iceberg REST Catalog OpenAPI](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)、[Iceberg Specification](https://iceberg.apache.org/spec/)

## 2. カタログの役割

カタログはテーブルの**現在のメタデータファイルへのポインタ**を持つ唯一の場所で、コミットはこのポインタを古い値から新しい値へ原子的に差し替える（楽観的並行制御）。データやマニフェストはカタログを通らず、オブジェクトストレージから直接読む。

REST カタログの主な呼び出し：

- `GET /v1/config`：クライアント設定（既定値・上書き値、使えるエンドポイント）を得る。
- `GET /v1/{prefix}/namespaces/{ns}/tables/{table}`（loadTable）：`metadata-location` と、テーブルメタデータ本体、ストレージ用の設定を返す。
- 認証は OAuth2 などのトークン。`X-Iceberg-Access-Delegation: vended-credentials` を付けると、カタログがそのテーブルの場所だけに使える**一時的なストレージ資格情報**を返せる（credential vending）。エンジンに広いバケット権限を持たせずに済む。

出典 [Iceberg REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)、[Iceberg Catalogs](https://iceberg.apache.org/docs/latest/catalogs/)

## 3. 読み取りの全経路

1. **テーブル解決**：エンジンが loadTable を呼び、metadata.json の場所（とメタデータ本体、一時資格情報）を受け取る。
2. **スナップショット選択**：metadata.json の `current-snapshot-id`（時点指定なら `snapshots` と `snapshot-log` から選ぶ）、スキーマ、パーティション仕様、ソート順を得る。
3. **Manifest List**：スナップショットの `manifest-list` が指す Avro を読み、パーティション要約で Manifest を除外する。
4. **Manifest**：残った Manifest（Avro）を読み、ファイルごとのパーティション値・列統計でデータファイルを除外し、適用すべき Delete ファイルを対応づける。各エントリにデータファイルの**完全パス・ファイルサイズ・split_offsets** がある。
5. **Split 化と配布**：残ったファイルを Split にして Worker に配る（[Iceberg の分散スキャン](reference-iceberg-distributed-scan.md) 参照）。
6. **Parquet の読み取り**：Worker は Manifest にあるファイルサイズから末尾を範囲 GET してフッターを読み、Row Group・ページを選んで列チャンクを取り、解凍・デコードする（[Parquet ファイルの内部](reference-parquet-internals.md) 参照）。
7. **Delete の適用**：位置削除・削除ベクトルは行位置で、等値削除は列値で突き合わせて行を除く。

ストレージへの**ディレクトリ一覧（LIST）は一度も使わない**。ファイルの存在と場所はすべてメタデータの木から得る。

## 4. キャッシュと往復回数

1 クエリの往復は、カタログ 1〜2 回、metadata.json 1 回、Manifest List 1 回、Manifest 数回〜数百回、データファイルはファイル数 ×（フッター 1 回＋列チャンク数回）が目安になる。エンジンはこれを減らすため、

- metadata.json と Manifest をメモリやローカルにキャッシュする（Manifest は不変なので安全にキャッシュできる）
- Manifest の読み込みを並列化する
- Parquet のフッターをキャッシュし、近い範囲 GET をまとめる

などを行う。REST カタログ仕様には、計画（どのファイルを読むか）をサーバー側で行うスキャン計画のエンドポイントも定義されており、対応するカタログとエンジンの組み合わせでは 3〜4 をカタログ側に任せられる。

## 5. 書き込み側との関係

書き手は新しいデータファイルと Manifest・Manifest List・metadata.json を書いてから、カタログで「今のポインタが自分の読んだ版なら新しい版に差し替える」コミットを行う。失敗したら最新を読み直して再試行する。読み手は loadTable の時点のスナップショットを読み続けるので、読み取り中のコミットで結果が混ざらない。

## 6. シナリオの見方

- `catalog-to-page`：カタログ → metadata.json → Manifest List → Manifest → Parquet のフッター → ページまでの全経路。
- `vended-credentials`：一時資格情報を受け取り、その範囲だけでストレージを読む。
- `concurrent-commit`：読み取り中に書き手がコミットしても、読み手は選んだスナップショットを読み続ける。

## 7. 実装例：Trino・Polaris・Amazon S3

Trino の Iceberg REST カタログで委任認証情報を有効化し、Polaris が S3 用の一時認証情報を返す構成例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| Coordinator | Trino Coordinator | カタログ解決、メタデータ読み取りとタスク計画を調停する。 |
| Worker | Trino Workers | 割り当てられたファイルの読み取りとフィルタを実行する。 |
| REST Catalog | Polaris Iceberg REST API | 対象テーブルのメタデータを返す。 |
| Vended Credentials | Polaris が返す一時認証情報 | AWS STS で取得した短期認証情報をクライアントに返す。 |
| 実装で追加 | AWS STS | IAM ロールの短期セッションを発行する。 |
| metadata.json | S3 の metadata.json | スナップショットとテーブル定義を保持する。 |
| Manifest List (Avro) | S3 の Manifest List（Avro） | 対象スナップショットの Manifest を列挙する。 |
| Manifests (Avro) | S3 の Manifest（Avro） | ファイル位置と統計を保持する。 |
| Data Files (Parquet) | S3 の Parquet ファイル | 該当するデータファイルを読む。 |
| Delete Files | S3 の位置削除ファイル | v2 の削除対象の位置を記録する。 |
| 実装で追加 | etc/catalog/iceberg.properties | REST URI と一時認証情報取得を設定する。 |

`iceberg.rest-catalog.vended-credentials-enabled` を有効にし、Coordinator と Worker の両方から分散ストレージへ到達できるよう構成する。対象は Iceberg v2 の位置削除を含む読み取りで、エンジンのフォーマット仕様対応を確認する。

[Iceberg REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)、[Trino Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)、[Trino REST Catalog metastores](https://trino.io/docs/current/object-storage/metastores.html)、[Polaris Configuring S3 Storage](https://polaris.apache.org/releases/1.9.0/configuration/configuring-polaris-for-production/configuring-aws-s3-cloud-storage-specific/)

## 8. 実装例：EKS の Trino・Polaris と RDS・S3

Trino Coordinator / Worker と Polaris を EKS の EC2 ノードで Pod として実行する例。Polaris は JDBC で RDS for PostgreSQL にカタログ状態を永続化し、テーブルの Iceberg メタデータとファイルは S3 に置く。Trino は REST API でテーブルを解決し、Polaris が AWS STS を使って発行する一時認証情報を使い S3 にアクセスする。

| 機能 | 担い手 |
| --- | --- |
| クエリ計画と読み取り | EKS 上の Trino Coordinator / Worker Pods |
| REST カタログ | EKS 上の Polaris Pod |
| カタログ状態 | RDS for PostgreSQL |
| 一時認証情報 | Polaris、AWS STS、IAM ロール |
| テーブルファイル | Amazon S3 |
| 実行基盤 | EKS と EC2 マネージドノードグループ |

Polaris と Trino のバージョン互換性、JDBC の初期化と認証、S3・STS へのネットワークと IAM、REST カタログの認証を個別に構成する。EKS は Pod の実行環境であり、Trino や Polaris の運用そのものを AWS に委ねるものではない。

[Trino on Kubernetes](https://trino.io/docs/current/installation/kubernetes.html)、[Polaris Helm persistence](https://polaris.apache.org/releases/1.9.0/helm-chart/persistence/)、[Polaris S3](https://polaris.apache.org/releases/1.9.0/configuration/configuring-polaris-for-production/configuring-aws-s3-cloud-storage-specific/)、[EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)。

自前例は利用者管理の Linux ホスト群で Trino と Polaris を実行し、Polaris の状態を自前 PostgreSQL に保存する。AWS 例は AWS が EKS 制御プレーン・EC2・RDS・STS・S3 基盤を運用し、利用者が Kubernetes API、ノード、Trino・Polaris、DB、IAM とデータを管理する。制御プレーンサーバーへの直接操作は想定しない。両例は公式資料を組み合わせた代表構成で、Trino と Polaris のバージョン、認証・IAM・ネットワークと削除形式の実動作は未検証。

- [Trino deployment](https://trino.io/docs/current/installation/deployment.html)
- [Polaris Helm persistence](https://polaris.apache.org/releases/1.9.0/helm-chart/persistence/)
