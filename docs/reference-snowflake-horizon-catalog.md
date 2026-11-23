# Snowflake Horizon Catalog の分類・保護・監査

## 1. 用途と境界

Horizon Catalog は資産の発見、分類、ガバナンス、追跡を組み合わせる。このモデルは Snowflake 内の注文テーブルを対象にし、外部エンジンへのポリシー伝播を一律には仮定しない。

## 2. 分類とタグ

注文テーブルの customer_email を分類対象にする。分類結果は管理者が確認し、タグの割り当てと、データ型に合うマスキングポリシーの関連付けを設計する。分類だけで値が自動的に非表示になるわけではない。

## 3. 問い合わせ時の保護

権限のあるロールだけが対象のオブジェクトにアクセスできる。その上で、列をどう見せるかはマスキングポリシーが判定する。見せる行を制御する要件には別の行アクセスポリシーを使う。

## 4. 監査とリネージ

ACCESS_HISTORY で直接・間接に参照されたオブジェクトや列などを確認する。利用権限、エディション、処理経路によって参照可能な情報と捕捉範囲が異なる。影響調査では変換先と利用記録を照合する。

## 図で確認するシナリオ

- **メールアドレスの分類とマスキング** — 対象列の分類結果を確認する。 → 保護対象のタグとポリシーを関連付ける。 → SELECT 権限のある分析担当にも、設定によりマスク済みの値を返す。
- **機微列の変更影響を調べる** — 機微列を使用する下流ビューを確認する。 → アクセス履歴で実際の利用者と参照された列を照合する。

## 公式資料

- [Snowflake Horizon Catalog](https://docs.snowflake.com/en/user-guide/snowflake-horizon)
- [データガバナンス](https://docs.snowflake.com/en/guides-overview-govern)
- [タグベースのマスキング](https://docs.snowflake.com/en/user-guide/tag-based-masking-policies)
- [アクセス履歴](https://docs.snowflake.com/en/user-guide/access-history)

## 5. 実装例 Snowflake での列分類とタグマスク

受注メール列に分類タグとマスキングポリシーを適用し、分析権限と監査権限を分離する例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| データ管理者 | 分類設定用ロール | 分類プロファイルと結果を管理する。 |
| 機微データ分類 | Sensitive Data Classification | 機微情報候補の分類結果を確認する。 |
| 列の分類ラベル・列の値を保護するポリシー | 分類タグとマスキングポリシー | 文字列用ポリシーをタグに関連付ける。 |
| 分析担当ロール | SALES_READER ロール | 許可された分析ビューだけを参照する。 |
| 注文のメールアドレス列 | ORDERS.CUSTOMER_EMAIL | メール列に分類タグを設定する。 |
| 注文分析ビュー | SALES.ORDERS_ANALYSIS | 注文分析に必要な列を公開する。 |
| 列アクセスの監査履歴 | ACCOUNT_USAGE.ACCESS_HISTORY | アクセスした資産と列を、対応するクエリで確認する。 |

タグに関連付けるポリシーと列の型をそろえ、分析ロールと監査ロールの権限を個別に付与する。分類、タグベースのマスキング、アクセス履歴を使えるエディションと権限はそれぞれ公式資料を確認する。

出典 [Snowflake Horizon Catalog](https://docs.snowflake.com/en/user-guide/snowflake-horizon)、[データガバナンス](https://docs.snowflake.com/en/guides-overview-govern)、[タグベースのマスキング](https://docs.snowflake.com/en/user-guide/tag-based-masking-policies)、[アクセス履歴](https://docs.snowflake.com/en/user-guide/access-history)、[Snowflake アクセス制御](https://docs.snowflake.com/en/user-guide/security-access-control-overview)
