# Iceberg v3 Variant：半構造化データの保存と読み取り

## 1. 対象
Iceberg format version 3 の `variant` 型を、列の論理スキーマ、各行の値、Parquet の物理配置とファイル統計に分けて理解する。表の仕様バージョンと Iceberg ライブラリ・Spark などの製品バージョンは別である。

## 2. 型と物理配置
表のスキーマは列 `payload` を `variant` として宣言し、列には Iceberg の field ID が付く。Variant 内のオブジェクトは名前と値の組、配列は異なる型を持つ値の並びを表し、行ごとに形が異なってよい。内部フィールドの追加・削除は Iceberg の列スキーマ変更とは別である。date、timestamp、decimal、binary 等も表現できる。

Parquet の非 shredded 表現では `payload` は `metadata` と `value` を持つ。ここでの `metadata` は Variant 値のフィールド名辞書であり、表の `metadata.json` や Parquet フッターではない。オブジェクト内の field ID は辞書へのインデックスであり、Iceberg の列 field ID とは別物。`value` は型付きの値や構造、オフセットを保持する。Avro と ORC も `metadata` と `value` の非 shredded 表現を持つ。

## 3. Shredding と統計
Parquet の shredding は、よく利用する Variant 内のフィールドを `typed_value` の型付き列に分離する物理最適化である。対応しない値や残りの値は非型付き表現と併用し、reader は利用可能な各部分を組み合わせて Variant を復元する。異なるデータファイルに異なる物理配置が共存しても、論理列の Iceberg field ID は同じ。writer はファイルごとに型付きの配置を推定できる。

Manifest のファイル統計には Variant 列の値数・null 数が含まれ得る。内部パスの上下限は任意で、正規化した JSON パスに対応する Variant として記録される。パスの上下限がありエンジンが対応する場合、条件に合わないファイルを計画段階で除外できる。統計がない場合、除外を保証せず、データを読んで条件を評価する。Parquet の列統計・ページスキップと Iceberg Manifest のファイル単位の除外は別の層である。

## 4. 利用と互換性
Variant 列はパーティションのソース列や identifier field に使えず、型の昇格対象にもできず、既定値は null。JSON 文字列や固定 struct と同一ではない。欠けたフィールド・型不一致・null の挙動は利用するエンジンの関数と設定も確認する。Iceberg v3 表を使えることだけで、すべてのエンジンが Variant や shredded Variant を読み書きできるわけではない。

Apache Iceberg の 2026 年の解説は、Spark 4.0 での読み取りは Iceberg 1.10.0、Spark 4.0/4.1 の shredded 書き込みは 1.11.0 と説明する。Flink については同資料の記述時点で非 shredded 対応と将来の shredded 書き込みを区別している。採用時は製品・バージョンごとに再確認する。

## 5. 実装例：Spark SQL 4.1・Iceberg 1.11・Parquet
Spark 4.1 と対応する Iceberg 1.11 runtime を組み合わせ、format version 3 の表を作成する例。実行には互換 runtime、カタログ、ストレージの設定が必要。`write.parquet.shred-variants` は任意の書き込み設定で、各データファイルが推定する配置や統計の有無は同じとは限らない。

```sql
CREATE TABLE events (id BIGINT, payload VARIANT)
USING iceberg
TBLPROPERTIES ('format-version' = '3', 'write.parquet.shred-variants' = 'true');
INSERT INTO events VALUES
  (1, parse_json('{"event":"login","country":"JP"}')),
  (2, parse_json('{"event":"purchase","amount":99}'));
SELECT id, variant_get(payload, '$.event', 'string') AS event FROM events;
```

| 機能 | 担い手 |
|---|---|
| 値の生成・検索 | Spark SQL の `parse_json` / `variant_get` |
| 表スキーマと列 ID | Iceberg table metadata |
| 行の物理表現 | Parquet Variant の `metadata` / `value` / 任意の `typed_value` |
| ファイルと任意の統計 | Iceberg Manifest |

[Iceberg Variant 解説](https://iceberg.apache.org/blog/variant-in-apache-iceberg/)、[Iceberg 仕様](https://iceberg.apache.org/spec/)、[Iceberg 書き込み設定](https://iceberg.apache.org/docs/latest/configuration/)。

## 6. 実装例：AWS（EMR Serverless・Glue・S3）

EMR Serverless の `emr-spark-8.2.0` を使う。このリリースの Spark は `4.1.3-amzn-0`、Iceberg は `1.11.0-amzn-0`。AWS の対応表では、shredding 付きの Variant は Amazon EMR 8.1.0 以降でサポートされる。

| 機能 | 担い手 |
| --- | --- |
| Spark ジョブとワーカーの管理 | Amazon EMR Serverless |
| SQL、表の定義、スキャン計画 | EMR Serverless の Spark Driver |
| Parquet の Variant の書き込みと読み取り | EMR Serverless の Spark Executor |
| 現在の Iceberg メタデータ位置 | AWS Glue Data Catalog |
| スキーマ・マニフェスト・Variant の Parquet | Amazon S3 |

ジョブの `spark.jars` に `/usr/share/aws/iceberg/lib/iceberg-spark4-runtime.jar` を指定し、Spark セッションには `type=glue` の Iceberg カタログを設定する。表は `format-version=3` を指定し、この例では `write.parquet.shred-variants=true` を使う。Parquet の `typed_value` の配置と使用できる統計は、実際のファイルに依存する。

- [EMR Serverless emr-spark-8.2.0](https://docs.aws.amazon.com/emr/latest/EMR-Serverless-UserGuide/release-version-emr-spark-8.2.0.html)
- [Amazon EMR Spark の Iceberg 対応](https://docs.aws.amazon.com/prescriptive-guidance/latest/apache-iceberg-on-aws/working-with-iceberg-in-amazon-emr-spark.html)
- [Apache Iceberg の Variant](https://iceberg.apache.org/blog/variant-in-apache-iceberg/)

自前例は Linux の Spark Standalone と HDFS の Hadoop カタログを仮定する。AWS 例の emr-spark-8.2.0 の公式掲載値は Spark 4.1.3-amzn-0 と Iceberg 1.11.0-amzn-0。AWS が Serverless、Glue、S3 の基盤を運用し、利用者がジョブ、SQL、カタログ、データと権限を管理する。ワーカー内部ホストは直接操作しない。両例は資料を組み合わせた代表構成で、Variant の shred・統計・パス述語の詳細な対応と実際の書き読みは未検証。

- [Spark Standalone Mode](https://spark.apache.org/docs/latest/spark-standalone.html)
- [Iceberg Spark Configuration](https://iceberg.apache.org/docs/latest/spark-configuration/)
