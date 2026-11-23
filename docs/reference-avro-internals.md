# Avro ファイルの内部：ヘッダー・ブロック・同期マーカー

## 1. 目的と前提

[物理ファイルフォーマット](reference-file-formats.md) の Avro（Object Container File）を 1 ファイルの単位までドリルダウンし、行指向の形式がどう分割・並列に読まれるかを追う。サイズや個数は説明用の例。出典 [Avro Specification - Object Container Files](https://avro.apache.org/docs/current/specification/#object-container-files)

## 2. ファイルのバイト配置

```text
┌ ヘッダー
│   ├ マジック "Obj" + 0x01（4 バイト）
│   ├ ファイルメタデータ（map）… avro.schema（JSON のスキーマ）、avro.codec（null／deflate／snappy／zstandard など）
│   └ 同期マーカー（16 バイトの乱数。ファイルごとに違う）
├ データブロック 1 … オブジェクト数（long）、バイト数（long）、シリアライズしたレコード（ブロック単位で圧縮）、同期マーカー
├ データブロック 2 … 同じ形
└ …
```

Parquet・ORC と違い、**説明（スキーマ）は先頭のヘッダーにあり、末尾にフッターはない**。書き手は先頭から順に書き、ブロックを追記していくだけでよい。このため、ストリーミングの取り込みやメッセージの保存のように、行を次々に追記する用途に向く。

## 3. 同期マーカーと分割読み

各ブロックの最後には、ヘッダーと同じ 16 バイトの**同期マーカー**が置かれる。並列に読むとき、各タスクはファイルを任意のバイト位置で区切られた範囲として受け取り、

1. まずヘッダーを読んでスキーマ・コーデック・同期マーカーを得る
2. 担当範囲の先頭から同期マーカーを探し、見つかった直後のブロック境界から読み始める
3. 担当範囲の終わりを越えた最初の同期マーカーまで読んで止まる

ので、ブロックが範囲の境界をまたいでも、二重に読んだり読み落としたりしない。圧縮はブロック単位なので、圧縮していても途中から解凍できる。

## 4. スキーマ解決

レコードは型情報を持たない詰めたバイナリで、読むには書き手のスキーマ（ヘッダーにある）が必要になる。読み手が別のスキーマを使う場合は、名前で列を対応させ、追加された列には既定値を、型の昇格（int → long など）を仕様に従って適用する（スキーマ解決）。出典 [Avro Schema Resolution](https://avro.apache.org/docs/current/specification/#schema-resolution)

## 5. 列指向との違い

列の統計や列ごとの配置が無いため、一部の列だけを読みたくても全列をデコードする必要があり、統計による読み飛ばしもできない。分析のための保存は Parquet・ORC に変換し、Avro は取り込み・メッセージ・メタデータ（Iceberg の Manifest など）に使う、という分担が一般的。

## 6. シナリオの見方

- `avro-scan`：ヘッダーから順にブロックを読む全件読み取り。
- `avro-split`：ファイルの途中から担当するタスクが、同期マーカーでブロック境界に揃える分割読み。

## 7. 実装例：Hadoop MapReduce の Avro 分割読み取り

HDFS 上の Avro Object Container File を AvroKeyInputFormat で二つの Map タスクに分担させる例。Split の開始点がブロック途中なら、同期マーカーで読み始めを合わせる。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 入力の前半を読むタスク | Map タスク A の Avro レコード読取 | 先頭側の Split を読み、ブロックの所有範囲で止める。 |
| 入力の後半を読むタスク | Map タスク B の Avro レコード読取 | 後半側の Split を受け取り、次の同期位置に合わせる。 |
| ヘッダー（スキーマ）、データブロック、同期マーカー | HDFS 上の Avro Object Container File | 同一ファイルのヘッダー、データブロック、同期マーカーを二つのタスクが読む。 |

実装で加わる部品を以下に示す。

- AvroKeyInputFormat のジョブ設定。入力パスと形式を Hadoop ジョブに登録し、Map タスク用に Split を用意する。

公式資料

- [Avro Specification - Object Container Files](https://avro.apache.org/docs/current/specification/#object-container-files)
- [Avro Schema Resolution](https://avro.apache.org/docs/current/specification/#schema-resolution)
- [AvroKeyInputFormat](https://avro.apache.org/docs/1.12.0/api/java/org/apache/avro/mapreduce/AvroKeyInputFormat.html)
- [Avro DataFileReader](https://avro.apache.org/docs/1.12.0/api/java/org/apache/avro/file/DataFileReader.html)

## 8. 実装例：AWS（EMR on EC2・HDFS）

Amazon EMR on EC2 に Hadoop クラスタを作成し、S3 に保存した Avro Object Container File をクラスタの HDFS にステージする。EMR のカスタム JAR ステップには使用する Hadoop リリースに合わせてビルドしたジョブを指定し、`AvroKeyInputFormat` と対応する Avro の依存関係をジョブに含める。

| 機能 | 担い手 |
|---|---|
| クラスタとステップの管理 | Amazon EMR |
| Map タスクの配置・実行 | EC2 上の Hadoop YARN |
| 入力原本とジョブの配布 | Amazon S3 上の Avro ファイルとジョブ JAR |
| 分割対象のファイル | HDFS 上の同一 Avro Object Container File |
| 分割の境界調整とデコード | Map タスク内の Avro RecordReader |

各 Map タスクは割り当てられた Split を処理する。後半のタスクは Avro の同期マーカーで境界を合わせる。タスクが二つあるのは図の例で、実際の Split 数はファイルと入力設定による。HDFS はクラスタ内の作業領域として使い、原本は S3 に保持する。

- [EMR クラスタのノードとステップ](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-overview.html)
- [EMR のカスタム JAR ステップ](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-launch-custom-jar-cli.html)
- [Apache Avro AvroKeyInputFormat](https://avro.apache.org/docs/1.12.0/api/java/org/apache/avro/mapreduce/AvroKeyInputFormat.html)

自前例は Linux の Hadoop ノード群で YARN と HDFS を運用し、利用者がジョブを投入する。例示の Map 出力は HDFS の別パスへ保存する。AWS 例は AWS が EMR・EC2・S3 基盤を運用し、利用者がクラスター、ジョブ、HDFS の作業データと権限を管理する。S3 からのステージングは別途行う前提で、具体的なコピー手順・ネットワークと依存バージョンの実動作は未検証。いずれも公式資料を組み合わせた代表例である。

- [Hadoop MapReduce Tutorial](https://hadoop.apache.org/docs/stable/hadoop-mapreduce-client/hadoop-mapreduce-client-core/MapReduceTutorial.html)
