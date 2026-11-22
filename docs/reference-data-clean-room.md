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
