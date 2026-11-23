# Iceberg v3：メタデータと削除・行の系譜

## 1. 対象
Iceberg 表の参照点からスキーマ、スナップショット、データファイルと削除情報にたどる関係を、v3 の Variant や deletion vector とともに整理する。図は v3 の一例である。

## 2. 参照と問い合わせの流れ
カタログは表の現在の metadata location を管理する。テーブルメタデータ JSON は format version、スキーマと field ID、パーティション仕様、スナップショットと参照情報を保持する。選択した snapshot は manifest list を指し、manifest list は data manifest と delete manifest の位置を示す。Data manifest の各エントリはデータファイルの位置、パーティション、件数や列統計等を示す。Reader はその情報と条件を使い対象ファイルを選ぶ。

Variant 列の定義は表スキーマにあり、内部データのフィールド名辞書は各 Variant 値の `metadata` にある。Variant の `metadata` と Iceberg の表メタデータは別である。パスの上下限統計は任意なので、欠けている場合に除外できると決めつけない。snapshot によって採用するファイル群とスキーマが異なる。

## 3. v3 の削除と行の系譜
v3 では新しい position delete file は書かず、data file の行位置を表す deletion vector（DV）を利用できる。DV は Puffin の blob として保存され、delete manifest は参照先データファイル、Puffin の位置・オフセット・長さを記録する。1 snapshot で 1 data file に適用する DV は最大 1 個である。v2 からのアップグレード後も既存の position delete file は残り得る。equality delete は v3 でも可能であり DV と同じ方式ではない。

v3 の row lineage は `_row_id` と `_last_updated_sequence_number` を使って行の識別と最終変更の情報を扱う。`first-row-id` などのファイル・snapshot 側メタデータを通じた継承規則があるため、行 ID を単純に全データファイルの通常列として必ず保存するとは限らない。削除や更新の取り扱い、アップグレード時の既存データへの割り当ては実装と仕様の規則に従う。

## 4. 注意点
カタログはデータファイルそのものではなく、公開済みメタデータの参照点を管理する。データと delete の適用には snapshot、partition、sequence number などの規則があり、同じ表内のすべての delete を無条件に全ファイルへ適用しない。書き込みの可視化は新しいメタデータのコミットによる。並行更新、スナップショット保持・失効、未参照ファイルの処理は運用方針とカタログの実装に依存する。

## 5. 実装例：Iceberg REST Catalog とファイルストレージ
Iceberg の Spark quickstart にある REST Catalog と S3 互換 MinIO を使う構成を基礎とし、v3 を理解するために data manifest、delete manifest、Puffin DV と Parquet Variant を区別して描いた概念例。Spark と Iceberg runtime の組合せや実際の v3 書き込み・DV の生成を、quickstart の既定動作として保証するものではない。MinIO は AWS S3 そのものではない。

| 機能 | 担い手 |
|---|---|
| 参照の解決 | Iceberg REST Catalog |
| カタログの状態 | Quickstart の REST fixture 内の JdbcCatalog と SQLite。コンテナ再作成後も状態を保持するには SQLite ファイルを永続ボリュームに置く設定が必要 |
| 形式と表の定義 | ストレージ上の table metadata JSON |
| ファイル群の選択 | snapshot・manifest list・data / delete manifest |
| 行データ | Parquet データファイルの Variant 列 |
| 削除位置 | Puffin に格納された deletion vector |
| 行の系譜 | v3 の行 ID と最終更新シーケンス、および継承用メタデータ |
| 計画と読み取り | 対応する Iceberg reader / engine |

[Iceberg 仕様](https://iceberg.apache.org/spec/)、[Iceberg Variant 解説](https://iceberg.apache.org/blog/variant-in-apache-iceberg/)、[Spark quickstart](https://iceberg.apache.org/spark-quickstart/)。

[Apache Iceberg — REST fixture の既定の保存先](https://apache.googlesource.com/iceberg/+/refs/heads/main/docker/iceberg-rest-fixture/README.md)

## 6. 実装例：AWS の EMR on EC2・Glue Data Catalog・S3

`emr-spark-8.1.0` の Amazon EMR on EC2 を使う。このリリースは Spark 4.1.1 と Iceberg 1.11.0 の AWS ビルドを含み、Deletion Vector と行の系譜に加えて Variant の shredding に対応する。Iceberg の `format-version=3` を指定し、Amazon S3 を warehouse に持つ GlueCatalog を Spark に設定する。

| 機能配置 | AWS での担い手 |
|---|---|
| 表の参照点 | AWS Glue Data Catalog が現行のメタデータ位置を管理 |
| 表定義・列 ID・Snapshot | S3 上の Iceberg `metadata.json` |
| Manifest List・Data / Delete Manifest | 同じテーブルの S3 メタデータファイル |
| データファイル・Variant 値の名前辞書 | Amazon S3 上の Parquet |
| 削除ベクトル | 同じ S3 テーブルプレフィックスの Puffin ファイル |
| 行の系譜 | データファイルの行値または Iceberg メタデータから継承した値 |
| 読み取りと計画 | EMR の EC2/YARN 上で動く Spark Driver・Executor と Iceberg Runtime |

Amazon EMR は EC2 クラスタを管理し、Spark ジョブを投入する。Spark が Glue で表を解決し、S3 上の Manifest を計画に使って、Parquet の読み取り時に該当する DV を適用する。接続する別のエンジンがある場合は、使用する v3 機能ごとに対応を確認する。

- [Amazon EMR Release Guide — AWS runtime for Apache Spark 8.1.0](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-spark810-release.html)
- [AWS Prescriptive Guidance — Iceberg table format v3](https://docs.aws.amazon.com/prescriptive-guidance/latest/apache-iceberg-on-aws/table-spec-v3.html)
- [Amazon EMR Release Guide — Use an Iceberg cluster with Spark](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-iceberg-use-spark-cluster.html)
- [Apache Iceberg Specification](https://iceberg.apache.org/spec/)

自前例は Linux の Docker ホスト上に REST fixture と MinIO を置く概念例であり、fixture の SQLite は試行用で本番向けの永続構成ではない。v3 の Variant・DV・row lineage を生成・読み取りできる具体的クライアントと組合せは未検証。AWS 公式資料は EMR Spark 8.1.0 に Spark 4.1.1-amzn-0 と Iceberg 1.11.0-amzn-0 を掲載し、Spark の v3 対応を説明するが、この図の全機能の組合せは実行検証していない。AWS が EMR・EC2・Glue・S3 基盤を運用し、利用者がジョブ、クラスタ、データと権限を管理する。Athena の Iceberg v3 対応は公式資料上ないため利用しない。
