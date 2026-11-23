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

## 5. 実装例 PostgreSQL の顧客属性履歴

顧客の現在値と履歴を別テーブルで保持し、遅れて届いた注文を発生日時点の顧客属性に結び付ける実装例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 顧客 C42 の移転 | landing.customer_changes | 顧客の業務キーと新しい地区、変更発生時刻を受け取る。 |
| 履歴を反映する変換 | 顧客履歴更新トランザクション | 旧履歴の終了と新規履歴の追加を更新処理の同じトランザクションで行う。 |
| Type 1 現在行 | dim_customer_current | 顧客業務キーを主キーとし、現在地区だけを上書きする。 |
| Type 2 の有効期間 | dim_customer_history | 版ごとの代理キーと半開区間の有効期間を持つ。 |
| 遅れて届いた注文明細 | landing.order_line_updates | 注文明細の注文日と顧客業務キーを保持する。 |
| 明細ファクト | fact_order_line | 注文発生時刻の有効期間を照合し、該当する顧客の代理キーを外部キーに持つ。 |
| 地域別売上 | 地域別売上 SQL ビュー | 現在地区の見方と注文時点の地区の見方を別々に用意する。 |

区間は開始を含み終了を含まない形で統一する。後着の顧客履歴が過去を変更する場合は、その有効期間に入るファクトの参照キーも再確認する。

出典 [Kimball Group の Slowly Changing Dimension 技法](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)、[Power BI の SCD ガイダンス](https://learn.microsoft.com/en-us/power-bi/guidance/star-schema)、[PostgreSQL CREATE TABLE](https://www.postgresql.org/docs/current/sql-createtable.html)
