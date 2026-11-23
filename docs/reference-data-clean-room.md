# データクリーンルームの基本構成

## 1. 共同分析の境界

媒体社と小売社が広告効果を集計する。参加者、クエリ実行者、結果受領者を設定し、元テーブルを相手へ配布せずに共同分析を行う。AWS Clean Rooms を実装例とする。

## 2. 入力と結合

媒体社は広告接触、小売社は受注のテーブルを関連付ける。共通識別子で照合する場合はその用意と利用許諾を確認する。

## 3. 分析ルールと出力制約

許可する結合列・集計関数・グループ化列を設定する。指定列の一意値が最小件数に届かない結果行を除く。反復クエリによる再識別リスクは別途評価する。

## 公式資料

- [AWS · AWS Clean Rooms](https://docs.aws.amazon.com/clean-rooms/latest/userguide/what-is.html)
- [AWS · 集計分析ルール](https://docs.aws.amazon.com/clean-rooms/latest/userguide/analysis-rules-aggregation.html)

## 4. 実装例：AWS Clean Rooms・Glue・S3

媒体社と小売社がそれぞれの AWS Glue テーブルを AWS Clean Rooms のコラボレーションに関連付ける例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| 媒体社の広告接触 | 媒体社の Glue テーブル（S3） | 広告接触ログを指す設定済みテーブル。 |
| 小売社の受注 | 小売社の Glue テーブル（S3） | 注文履歴を指す設定済みテーブル。 |
| 分析ルール・結果の出力制約 | AWS Clean Rooms の集計分析ルール | 許可する結合や集計と最小集計しきい値を設定する。 |
| 共同分析環境 | AWS Clean Rooms コラボレーション | 許可されたメンバーが制約内で共同クエリを実行する。 |
| 結果受領者 | 結果受領が許可されたメンバー | 自社の Amazon S3 に集計結果を受け取る。 |
| 実装で追加 | テーブル関連付け用 IAM ロール | AWS Clean Rooms が関連付けた入力テーブルへアクセスする権限を与える。 |
| 実装で追加 | 結果受領者の Amazon S3 | 結果設定で指定された S3 バケットに出力する。 |

各テーブルの連携用 IAM ロールには、対応する AWS Glue メタデータと S3 の入力への権限を付ける。集計分析ルールは結合列や集計関数に加え、公開される出力行が集約する一意値の下限を設定する。結果受領者は出力先の S3 を指定する。

[AWS · AWS Clean Rooms](https://docs.aws.amazon.com/clean-rooms/latest/userguide/what-is.html)、[AWS · 集計分析ルール](https://docs.aws.amazon.com/clean-rooms/latest/userguide/analysis-rules-aggregation.html)、[Associating tables to a collaboration](https://docs.aws.amazon.com/clean-rooms/latest/userguide/associate-configured-table.html)、[Running SQL queries](https://docs.aws.amazon.com/clean-rooms/latest/userguide/use-sql-editor.html)
