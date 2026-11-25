# AWS Glue：Data Catalog とクローラー

## 1. 対象

クローラーがデータを走査してスキーマを推論し、Data Catalog にテーブルとパーティションを登録するまでと、登録した定義を Athena・EMR・Glue ジョブが参照する関係を扱う。ジョブの実行は別の図（AWS Glue：ジョブの実行とワーカー）で扱う。

## 2. クローラーの実行

1 回の実行で複数のデータストアを走査できる。実行後にテーブルを作成または更新する。再実行では新規・変更されたファイルやテーブルを探し、前回以降に見つかったテーブルとパーティションを出力する。出典 [Using crawlers to populate the Data Catalog](https://docs.aws.amazon.com/glue/latest/dg/add-crawler.html)

## 3. 分類とスキーマ推論

クローラーは指定した順にカスタム分類器を試し、最初に形式を認識した分類器でスキーマを作る。どれも一致しなければ JSON などの組み込み分類器を試す。その後データストアに接続してスキーマを作る。圧縮ファイルは、形式を調べるためにクローラーがダウンロードする。出典 [Using crawlers to populate the Data Catalog](https://docs.aws.amazon.com/glue/latest/dg/add-crawler.html)

## 4. テーブルとパーティション

テーブル定義は、クローラー定義で指定したデータベースに書かれる。指定しなければ default データベースに入る。各テーブルは、最初に認識した分類器が付ける classification を持つ。テーブル名は S3 プレフィックスやフォルダー名から作り、重複するとハッシュの接尾辞が付く。

Include path が指すフォルダー階層で、複数のフォルダーのスキーマがおおむね似ていれば、クローラーは別テーブルではなくパーティションを作る。例として `sales/year=2019/month=Jan/day=1` の階層は、キー year・month・day を持つ 1 つのテーブルになる。別テーブルにしたい場合は、各テーブルのルートフォルダーを別のデータストアとして指定する。出典 [Using crawlers to populate the Data Catalog](https://docs.aws.amazon.com/glue/latest/dg/add-crawler.html)

## 5. 参照するエンジン

ETL ジョブは Data Catalog のテーブルをソースとターゲットに使う。ジョブブックマークの資料は、Data Catalog のテーブルとクローラーを使うとパーティションの追加を追跡でき、プッシュダウン述語で対象パーティションを選べると説明する。[ジョブブックマーク](https://docs.aws.amazon.com/glue/latest/dg/monitor-continuations.html)

Athena ではテーブルが S3 プレフィックスに対応し、同じプレフィックスにスキーマの異なるオブジェクトがあると別テーブルとして認識されない。クローラーが 1 つのプレフィックスから複数テーブルを作ると、クエリ結果が空になることがある。回避策は、スキーマごとに Include path を分けることである。出典 [Using crawlers to populate the Data Catalog](https://docs.aws.amazon.com/glue/latest/dg/add-crawler.html)EMR からの参照方式はこの資料では確認していない。

## 6. シナリオ

`crawl-and-query` を順に選ぶ。クローラーが対象を走査し、分類器がスキーマを返し、テーブルとパーティションが登録される。その後 Athena、EMR、Glue ジョブが同じ定義を参照する。

## 7. 前提と範囲

Data Catalog は実データを持たず、テーブル・ジョブ・接続などの技術メタデータを管理する。実データは元のデータストアに残る。出典 [AWS Glue components](https://docs.aws.amazon.com/glue/latest/dg/components-overview.html)

## 8. 実装例：AWS Glue クローラーで S3 の CSV を登録

S3 の raw プレフィックスを Glue Crawler で走査し、Data Catalog にテーブルとパーティションを登録する代表例である。公式資料を組み合わせた構成で、実動作は未検証である。

| 機能 | 担い手 |
| --- | --- |
| クローラーの起動 | Glue クローラーのスケジュールまたは手動実行 |
| クロール対象のデータ | Amazon S3 の raw プレフィックス |
| クローラー、分類器 | Glue Crawler と組み込み・カスタム分類器 |
| テーブル定義、パーティション | Glue Data Catalog |
| SQL クエリエンジン | Amazon Athena |
| Spark・Hive クラスター | Amazon EMR |
| ETL ジョブ | Glue Spark ETL ジョブ |

実装で加わる部品は IAM ロールである。AWS はクローラーとカタログのサービスを運用し、利用者はクローラーの対象・ポリシー、カスタム分類器、定義、権限、データを管理する。

## 9. 未確認

EMR から Data Catalog を参照する設定と権限、スキーマ変更時の更新・削除ポリシー、クロールの所要時間、実環境の動作は未確認である。

## 公式資料

- [Using crawlers to populate the Data Catalog](https://docs.aws.amazon.com/glue/latest/dg/add-crawler.html)
- [AWS Glue components](https://docs.aws.amazon.com/glue/latest/dg/components-overview.html)
- [Crawler prerequisites](https://docs.aws.amazon.com/glue/latest/dg/crawler-prereqs.html)
- [Tracking processed data using job bookmarks](https://docs.aws.amazon.com/glue/latest/dg/monitor-continuations.html)
- [AWS 共有責任](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
