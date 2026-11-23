# DWH のスノーフレークスキーマとスタースキーマの比較

## 1. 比較の前提

同じ注文・商品・カテゴリを題材にする。スノーフレークスキーマはディメンションの階層を正規化するモデリング形態であり、DWH 製品の Snowflake に依存しない。1行が1注文明細という粒度は両案で共通。

## 2. スター案

商品ディメンションの各行にカテゴリ名を持たせる。売上のカテゴリ集計が一段の結合で読める。カテゴリ名を更新する設計では、同じカテゴリを持つ複数の商品行へ反映する必要がある。

## 3. スノーフレーク案

商品はカテゴリのキーを持ち、カテゴリ名は別テーブルで管理する。この例では一つの商品は一つのカテゴリに所属する。カテゴリ名の更新先を集約できる一方、カテゴリ売上の集計で商品、カテゴリへと結合が増える。

## 4. 判断と履歴

利用者の使いやすさ、変更経路、実行計画を測って決める。カテゴリの変更で過去の集計値がどう見えるかは履歴設計で決まり、正規化するだけでは当時のカテゴリは保たれない。

## 図で確認するシナリオ

- **カテゴリ売上の結合経路を比較** — スター案では商品ディメンションにカテゴリ属性がある。 → 階層分離案ではカテゴリキーの結合が加わる。 → 粒度とフィルターを揃えた結果で整合性と運用負荷を比較する。
- **カテゴリ名称の変更と履歴** — スター案では同じカテゴリに属する商品行へ名称を反映する。 → 階層分離案ではカテゴリ表の名称を更新する。 → 当時の名称を残す必要があれば、どちらの案でも履歴ポリシーを設計する。

## 公式資料

- [Snowflaked Dimensions](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/snowflake-dimension/)
- [Power BI のスタースキーマ設計](https://learn.microsoft.com/en-us/power-bi/guidance/star-schema)

## 5. 実装例 PostgreSQL の商品階層比較

同じ受注明細から平坦な商品ディメンションとカテゴリを分けたディメンションを別スキーマに作り、同じ問いで比較する例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 商品＋カテゴリ | star.dim_product | 商品キーとカテゴリ名・属性を同じ行に保持する。 |
| 明細ファクト（スター） | star.fact_order_line | 明細の粒度を固定して商品キーを参照する。 |
| カテゴリ別売上（スター） | star.sales_by_category ビュー | ファクトから商品表に結合して集計する。 |
| カテゴリ | hierarchy.dim_category | カテゴリキーとカテゴリの説明属性を持つ。 |
| 商品・カテゴリキー | hierarchy.dim_product | カテゴリキーを外部キーとして持つ。 |
| 明細ファクト（階層分離） | hierarchy.fact_order_line | スター側と同じ受注明細粒度を持つ。 |
| カテゴリ別売上（階層分離） | hierarchy.sales_by_category ビュー | 商品からカテゴリ表をたどって集計する。 |
| 履歴と結合の比較 | 二つの SQL 結果と実行計画 | 同じ期間で売上を集計し、結果と結合経路を比較する。 |
| 保存と SQL 実行 | Amazon RDS for PostgreSQL、Amazon EC2 | テーブルとビューは RDS に置き、EC2 上の `psql` から接続する。 |

同じデータと条件で `EXPLAIN` の実行計画と金額を確認する。カテゴリ移動が過去の売上にも効くかは、履歴の持ち方と有効時刻の方針で決める。

この比較では、同じ AWS アカウントの VPC に非公開の Amazon RDS for PostgreSQL と Amazon EC2 の検証ホストを置く。RDS の同じデータベースに `star` と `hierarchy` を用意し、EC2 上の `psql` から同じ入力をロードする。ロード後に両方のテーブルの統計情報を更新し、同じ SQL 条件で結果と実行計画を比較する。接続元のセキュリティグループから PostgreSQL ポートだけを許可し、TLS で接続する。

- [RDS for PostgreSQL への接続](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ConnectToPostgreSQLInstance.html)
- [同じ VPC の EC2 から RDS へ接続](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/tutorial-connect-ec2-instance-to-rds-database.html)

出典 [Snowflaked Dimensions](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/snowflake-dimension/)、[Power BI のスタースキーマ設計](https://learn.microsoft.com/en-us/power-bi/guidance/star-schema)、[PostgreSQL CREATE TABLE](https://www.postgresql.org/docs/current/sql-createtable.html)、[PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html)

AWS は EC2 と RDS の基盤を運用し、利用者は EC2 のゲスト OS と psql、RDS の DB・テーブル・権限を管理する。利用者は SQL と EXPLAIN で比較できるが、RDS の内部ホストを直接操作しない。比較入力と SQL の組み合わせは実動作未検証。[AWS shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
