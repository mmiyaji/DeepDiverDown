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

媒体社と小売社が別々の AWS アカウントから S3 のデータを関連付け、Clean Rooms の SQL で広告効果を集計する。例では小売社のメンバーがクエリを実行し、結果を受け取る。

| 機能 | 担い手 |
| --- | --- |
| 媒体社の広告接触、小売社の受注 | 各社の S3 に行データを保存し、各社の Glue Data Catalog で定義する。 |
| 共同分析と出力制約 | AWS Clean Rooms の設定済みテーブル、集計分析ルール、コラボレーション。 |
| 結果提供 | 小売社にクエリと結果受領を許可し、集計を小売社の S3 に出力する。 |

関連付けごとに、Clean Rooms がその提供者の Glue と S3 を読み取るためのサービスロールを用意する。結果出力用ロールの権限は小売社の出力先に限定する。分析者が両社の入力バケットを直接読める権限は付与しない。最小集計しきい値は指定列の一意値数に適用される。反復照会による開示の評価は別途行う。

公式資料

- [AWS Clean Rooms の概要](https://docs.aws.amazon.com/clean-rooms/latest/userguide/what-is.html)
- [集計分析ルール](https://docs.aws.amazon.com/clean-rooms/latest/userguide/analysis-rules-aggregation.html)
- [関連付けと入力サービスロール](https://docs.aws.amazon.com/clean-rooms/latest/userguide/associate-configured-table.html)
- [結果設定とクエリの実行](https://docs.aws.amazon.com/clean-rooms/latest/userguide/use-sql-editor.html)
- [Clean Rooms のサービスロール](https://docs.aws.amazon.com/clean-rooms/latest/userguide/setting-up-roles.html)

媒体社と小売社はそれぞれ自社の S3、Glue 定義と IAM ロールを管理する。Clean Rooms の共同分析と SQL 実行は AWS の管理サービスとして示し、内部実行ノードやサービスアカウントの構成は推測しない。参加者はコラボレーション、関連付け、分析ルール、クエリと結果出力先を権限に応じて設定できる。結果書き込み用ロールは入力ロールと区別する。資料を組み合わせた構成で、この集計・権限・識別子の実動作は未検証。[AWS shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
