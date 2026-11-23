# DWH の Slowly Changing Dimensions：Type 1 と Type 2

## 1. 題材

顧客 C42 は 1月20日に東地区から西地区へ移転した。営業には現在の地区が必要で、過去の地域別売上には注文当時の地区が必要な場合がある。日時は説明用。

## 2. Type 1 の上書き

業務キーの同じディメンション行を更新する。歴史を残さない属性の訂正で使える。既存ファクトを現在の地区で再集計すれば、移転前の注文も現在の地区に属して見える。

## 3. Type 2 の履歴

旧行の終了時刻を設定し、新しい代理キーで新行を追加する。有効範囲はこの例では開始を含み終了を含まない。事実発生時刻で対応する代理キーを解決してファクトに持たせ、当時の地区を再現する。期間の重複と空白に注意する。

## 4. 遅延したファクト

1月17日の注文が移転後に届いても、業務時刻に該当する旧キーを引く。逆に履歴の更新自体が遅延した場合は、その期間のファクトを補正するかの判断と既存レポートへの影響確認が要る。

## 図で確認するシナリオ

- **移転日に Type 1 と Type 2 を比較** — 顧客 C42 が東から西へ移転する。 → Type 1 は上書きし、以前の売上も現在の西として見える。 → Type 2 は旧行を閉じ、新しい代理キーを西に割り当てる。
- **遅延注文を正しい履歴の行に紐付ける** — 1月17日発生の注文が移転後に届く。 → イベント時刻で旧行の代理キーを引く。 → 遅延注文は発生当時の東地区の売上に入る。

## 公式資料

- [Kimball Group の Slowly Changing Dimension 技法](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)
- [Power BI の SCD ガイダンス](https://learn.microsoft.com/en-us/power-bi/guidance/star-schema)
