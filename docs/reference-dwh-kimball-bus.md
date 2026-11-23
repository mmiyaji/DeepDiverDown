# Kimball バスとファクトコンステレーション

## 1. 業務プロセスの粒度

注文のファクトは1受注明細。返品ファクトは1返品明細。どちらも同じ商品分類を使うが、注文日と返品受付日は異なる役割の日付である。

## 2. バス・マトリクス

行に業務プロセス、列にディメンションを置き、利用関係と共有範囲を明示する。共通ディメンションではキーや階層の値を揃え、各チームが一貫した意味で集計軸を使えるようにする。

## 3. ドリルアクロス

ファクトを直接明細同士で結合せず、双方を共通の集計キーで独立に集約し、結果をそのキーで突き合わせる方式を扱う。日・カテゴリ・通貨のキーで日次の売上額と返品額を表示する。

## 4. 利用上の注意

任意の月の売上と同月に受け付けた返品は、元の売上注文の月が異なることがある。受注月コホート別の返品率を求めるなら、元明細との対応を持つ別の設計と指標定義が必要。

## 図で確認するシナリオ

- **ファクトが共有するディメンションを確認** — 注文プロセスの集計軸を特定する。 → 返品プロセスの日付の役割と共有商品を確認する。
- **日次売上と同日の返品受付額を並べる** — 受注明細から日次売上を別に計算する。 → 返品明細から同日の返品受付額を別に計算する。 → 共通集計キーで突き合わせる。元の受注月に対する返品率とは定義が異なる。

## 公式資料

- [Kimball Group の Conformed Dimensions／Drilling Across／Bus Matrix](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)

## 5. 実装例 BigQuery の受注・返品横断集計

受注と返品をそれぞれ別ファクトに持ち、日付と商品を両方から参照する BigQuery での実装例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 共通日付ディメンション | common.dim_calendar | 同じ日付表を注文日と返品受付日の別名で読む。 |
| 共通商品ディメンション | common.dim_product | 商品キーとカテゴリ定義を受注・返品で共有する。 |
| 受注明細ファクト | sales.fact_order_line | 受注明細ごとの売上金額を保持する。 |
| 返品明細ファクト | returns.fact_return_line | 返品明細ごとの返金金額を保持する。 |
| 日・カテゴリ・通貨別の売上・日・カテゴリ・通貨別の返品 | 独立した日次集計 SQL ビュー | 売上と返品を別々のビューで日付・カテゴリ・通貨にそろえる。 |
| 売上と返品の横並び表示 | 受注・返品の比較ビュー | 共通キーで日次結果を横に並べる。 |

BigQuery の主キーと外部キーを定義する場合は、データの整合性をロード処理や照合クエリで確かめる。横断の比較ビューでは受注と返品を先に集計し、明細同士の多対多結合を避ける。

出典 [Kimball Group の Conformed Dimensions／Drilling Across／Bus Matrix](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)、[BigQuery 論理ビュー](https://docs.cloud.google.com/bigquery/docs/views-intro)、[BigQuery の主キーと外部キー](https://docs.cloud.google.com/bigquery/docs/primary-foreign-keys)
