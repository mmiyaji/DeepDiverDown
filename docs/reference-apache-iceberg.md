# Apache Iceberg の基本アーキテクチャ

## 1. テーブルの入口

SQL エンジンはテーブルの現在のメタデータを読み、そこから対象スナップショットを選ぶ。ストレージ上のデータファイル一覧を直接推測するのではなく、テーブルメタデータを起点に読む。出典 [Iceberg Specification](https://iceberg.apache.org/spec/)

v3 の詳細は [Variant と Parquet shredding](reference-iceberg-v3-variant.md)、[メタデータと削除参照](reference-iceberg-v3-metadata.md) を参照する。

## 2. スナップショットの切り替え

ライターは新しいデータファイルを準備し、メタデータを更新してスナップショットをコミットする。読み手は読み込み時点のスナップショットを使い、更新をリフレッシュするまで同じ状態を見続ける。出典 [Iceberg Specification](https://iceberg.apache.org/spec/)

## 3. Manifest List と Manifest

各スナップショットは Manifest List から複数の Manifest をたどる。Manifest はパーティション値や列統計を持つデータファイルの一覧で、クエリ計画時のプルーニングに使われる。出典 [Iceberg Terms](https://iceberg.apache.org/terms/)

## 4. データファイルの読み出し

エンジンは Manifest のファイル情報と統計で不要なファイルを除外し、残った Parquet などのデータファイルをストレージから読む。スナップショットの内容は、その Manifest にある生存ファイルの集合である。出典 [Iceberg Specification](https://iceberg.apache.org/spec/)

## 5. 時点読み取り

スナップショット ID または時刻を選べば、過去の表状態を読むシナリオを表現できる。古いメタデータやファイルの保持期間は運用設定に依存するため、このモデルでは固定しない。出典 [Iceberg Terms](https://iceberg.apache.org/terms/)

## 6. シナリオの見方

「注文のスナップショットを読む」では、コミット済みメタデータから snapshot、Manifest List、Manifest を順にたどり、必要なデータファイルだけを読む。`snapshot-read` のリンクを順番に選択すると流れを追える。

## 7. スナップショットの履歴と失効

データの追加・削除などの更新では新しいスナップショットが作られ、テーブルメタデータの `snapshots` と `snapshot-log` に履歴が残る。スキーマ変更などのメタデータ更新では、必ずしも新しいスナップショットは作られない。操作の種類（append、overwrite、delete、replace＝コンパクションなど）と追加・削除したファイル数が `summary` に記録される。`FOR TIMESTAMP AS OF` や `FOR VERSION AS OF` で過去のスナップショットを選ぶと、その版の Manifest List から当時の生存ファイルを読む。古いスナップショットは `expire_snapshots` で失効させ、失効した版だけが参照していたファイルを削除する。失効させた版へはタイムトラベルできない。出典 [Iceberg Maintenance](https://iceberg.apache.org/docs/latest/maintenance/)

## 8. パーティションの進化と孤立ファイル

パーティション仕様は変更でき（partition evolution）、変更はメタデータに新しい仕様を追加するだけで、既存のデータファイルは書き直さない。古いファイルは古い仕様（例：月）のまま残り、新しく書くファイルだけが新しい仕様（例：日）で置かれる。クエリは各ファイルに記録された仕様ごとにプルーニングする。また、スナップショットを失効させると、失効した版だけが参照していたファイルが削除される。どのメタデータからも参照されないまま残ったファイル（書き込み失敗の残骸など）は `remove_orphan_files` で掃除する。出典 [Iceberg Partitioning](https://iceberg.apache.org/docs/latest/partitioning/)、[Iceberg Maintenance](https://iceberg.apache.org/docs/latest/maintenance/)

## 9. 実装例：Spark・Iceberg REST・RustFS

Apache Iceberg の Spark Quickstart に沿って、Spark と REST カタログを起動し、RustFS へテーブルファイルを置く例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| SQL エンジン | Spark SQL・Iceberg Runtime | テーブルをロードし、計画と読み書きを行う。 |
| Table Metadata・Snapshot | RustFS の metadata.json と Snapshot | 表定義と各スナップショットの参照情報を同じメタデータに保持する。 |
| Manifest List | RustFS の Manifest List | スナップショットで使う Manifest の一覧を保持する。 |
| Manifest | RustFS の Manifest | 対象データファイルの位置と統計を保持する。 |
| Data Files | RustFS の Parquet | クエリに必要なデータ本体。 |
| 実装で追加 | REST Catalog コンテナ | Spark が使う現在のテーブルメタデータを解決する。 |

テーブル作成の後、書き込みごとに Iceberg のスナップショットが公開される。カタログの REST エンドポイントを Spark に設定し、初期化処理で S3 互換バケットを用意する。ローカル確認用の認証情報と運用用の認証設定は分ける。

[Apache Iceberg Specification](https://iceberg.apache.org/spec/)、[Spark and Iceberg Quickstart](https://iceberg.apache.org/spark-quickstart/)

公式 Quickstart はローカルの Docker Compose ホストで Spark、REST fixture、RustFS とバケット初期化コンテナを実行する。初期化コンテナは RustFS の準備完了を待って warehouse バケットを作成する。REST fixture は検証用である。RustFS の個別アイコンは既存カタログにないため汎用記号で示す。各コンテナとホストの運用は利用者が担う。

## 10. 実装例：AWS の EMR on EC2・Glue Data Catalog・S3

同一 AWS アカウントで Amazon EMR が EC2 クラスタを管理し、Spark の Driver と Executor を YARN 上で実行する。Spark は Iceberg 拡張と `type=glue` の `SparkCatalog` を使い、Amazon S3 を warehouse にする。

| 機能配置 | AWS での担い手 |
|---|---|
| SQL エンジン | EMR の Spark SQL と Iceberg Runtime。Driver が計画し、Executor がスキャンする |
| Table Metadata・Snapshot | S3 上の `metadata.json` とファイル内のスナップショット参照 |
| Manifest List・Manifest | S3 上の Iceberg メタデータファイル |
| Data Files | 同じテーブルの S3 プレフィックスにある Parquet |

Glue Data Catalog は現在のメタデータファイルの位置を返す。Spark はその位置を使って S3 からファイルを読み、クエリの版を選ぶ。Spark 拡張を設定したクラスタでは `expire_snapshots` や `remove_orphan_files` などの保守手続きもジョブとして実行できる。クラスタに付与する IAM 権限は、S3 と Glue でジョブに必要な操作に合わせる。

- [Amazon EMR Release Guide — Use an Iceberg cluster with Spark](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-iceberg-use-spark-cluster.html)
- [Amazon EMR Management Guide — Understanding Amazon EMR clusters](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-overview.html)
- [Apache Iceberg Specification](https://iceberg.apache.org/spec/)

運用分担は AWS の共有責任モデルに従う。EMR、Glue、S3 のサービス基盤は AWS が運用し、利用者はクラスタやジョブの設定、ゲスト OS、データ、暗号化、権限を管理する。EMR クラスタの EC2 ノード上のソフトウェアには SSH やアプリケーションのインターフェースからアクセスできる。サービス基盤そのものへの直接操作を意味しない。この構成は公式資料を組み合わせた例であり、実環境での動作検証は行っていない。

- [AWS — Shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
