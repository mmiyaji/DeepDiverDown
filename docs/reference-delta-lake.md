# Delta Lake の基本アーキテクチャ

## 1. データファイルとトランザクションログ

Delta table はデータファイルと、表の変更を記録する `_delta_log` を組み合わせる。読み手はディレクトリ全体を表の状態だとみなさず、ログを再生して状態を組み立てる。出典 [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)

## 2. 書き込みとコミット

ライターはまず新しいデータファイルを書き、その後ログに add/remove などのアクションを含む新しいバージョンを原子的にコミットする。ログの各 JSON ファイルが表の1バージョンに対応する。出典 [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)

## 3. MVCC と一貫したスナップショット

Delta は MVCC で複数バージョンを保持し、読み手はトランザクションログから対象バージョンのデータファイルを選ぶ。これにより、読み取り中に別のコミットがあっても一貫したスナップショットを得る。出典 [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)

## 4. Checkpoint

Checkpoint は指定バージョンまでの有効なアクションをまとめる。読み手は最新の完全な Checkpoint と、その後の JSON ログを使って、長いログ全体を毎回再生せずに表の状態を復元できる。出典 [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)

## 5. 時点読み取り

過去のバージョンを選ぶと、その時点のスナップショットを再構成できる。古いログやデータの削除は保持期間と vacuum の運用に依存するため、このモデルでは固定しない。出典 [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)

## 6. シナリオの見方

「注文をコミットして読む」では、データファイルを書き、JSON ログへコミットし、Checkpoint と後続ログからスナップショットを復元して読む。`commit-read` のリンクを順番に選択すると流れを追える。

## 7. 実装例：Spark・Delta Lake・Amazon S3

Delta の `S3DynamoDBLogStore` を構成し、協調する複数の Spark クラスターから同じ S3 のテーブルを更新する例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| Writer / Engine | Delta Lake を導入した Apache Spark | データファイルを生成し、LogStore でコミットを公開する。 |
| Data Files | S3 の Delta データファイル | Parquet のデータ本体を保持する。 |
| Delta JSON Log・Checkpoint | S3 の `_delta_log`（コミット・チェックポイント） | テーブルの履歴と、復元を短縮するチェックポイントを保持する。 |
| Consistent Snapshot・Reader / Query Engine | Apache Spark（ログ再生と読み取り） | 有効ファイル集合を復元し、対象のデータを読む。 |
| 実装で追加 | DynamoDB の書き込み調停用テーブル | 複数クラスター間で新規ログファイル作成を調停する。 |

全書き込み元を同じ LogStore、DynamoDB テーブル、リージョン設定に揃える。単一クラスターでの通常の S3 読み書きとも区別する。チェックポイントのファイル形式は Delta プロトコルで選択可能な形式に依存する。

[Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)、[Delta Lake Storage configuration: Amazon S3](https://docs.delta.io/delta-storage/)、[Delta Lake Quick Start](https://docs.delta.io/quick-start/)

利用者が用意したホスト上の Spark Standalone master / worker を使う複数クラスタの構成例。2組の master と worker がそれぞれ書き込みアプリケーションのリソースを割り当て、両 writer が同じ DynamoDB テーブルでコミットを調停する。ホストの設置先は固定しない。Spark とホストは利用者が管理し、S3 と DynamoDB の基盤は AWS が運用し、データと権限は利用者が管理する。公式資料を組み合わせた構成で、実動作は未検証。複数クラスタ書き込みは実験的機能である。

[Apache Spark Standalone Mode](https://spark.apache.org/docs/latest/spark-standalone.html)、[AWS Shared Responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)

## 8. 実装例：AWS の EMR on EC2・Glue Data Catalog・S3

Amazon EMR が EC2 クラスタを管理し、YARN 上の Spark で Delta Lake の書き込みと読み取りを実行する。書き込み元を一つの Spark Driver に限定する例で、複数クラスターからの同時書き込みは §7 の構成で扱う。

| 機能配置 | AWS での担い手 |
|---|---|
| データ書き込みとコミット | EMR の Spark と Delta Lake の拡張・LogStore |
| データファイル | Amazon S3 のテーブルプレフィックスにある Parquet |
| トランザクションログ・Checkpoint | 同じ S3 プレフィックスの `_delta_log` 内の JSON コミットと Parquet チェックポイント |
| スナップショット復元・読み取り | EMR の Spark と Delta Lake が対象バージョンの有効ファイルを再構成し、データを読む |

Delta Lake 対応の EMR リリースで `delta.enabled` を有効にし、Spark の Hive metastore に Glue Data Catalog を設定する。Glue に登録するのは、テーブル名で引ける S3 の保存先などのテーブル情報である。Delta のバージョンと有効ファイルは S3 上のトランザクションログで管理する。クラスタの IAM ロールに、必要な S3 と Glue の操作を許可する。

- [Amazon EMR Release Guide — Use a Delta Lake cluster with Spark and AWS Glue](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/Deltacluster-spark-glue.html)
- [Amazon EMR Release Guide — Use a Delta Lake cluster with Spark](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/Deltausing-cluster-spark.html)
- [Delta Lake — Storage configuration](https://docs.delta.io/delta-storage/)
- [Amazon EMR Management Guide — Understanding Amazon EMR clusters](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-overview.html)

運用分担は AWS の共有責任モデルに従う。EMR、Glue、S3 のサービス基盤は AWS が運用し、利用者はクラスタやジョブの設定、ゲスト OS、データ、暗号化、権限を管理する。EMR クラスタの EC2 ノード上のソフトウェアには SSH やアプリケーションのインターフェースからアクセスできる。サービス基盤そのものへの直接操作を意味しない。この構成は公式資料を組み合わせた例であり、実環境での動作検証は行っていない。

- [AWS — Shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
