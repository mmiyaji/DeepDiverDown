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
| 分析担当ロール | SALES_READER ロール | 分析用 Warehouse の使用と、公開ビューの参照を許可する。 |
| 注文のメールアドレス列 | ORDERS.CUSTOMER_EMAIL | メール列に分類タグを設定する。 |
| 注文分析ビュー | SALES.ORDERS_ANALYSIS | 注文分析に必要な列を公開する。 |
| 列アクセスの監査履歴 | ACCOUNT_USAGE.ACCESS_HISTORY | `SNOWFLAKE.GOVERNANCE_VIEWER` を付与した監査用アカウントロールで参照する。 |

この例は Snowflake Enterprise Edition 以上を前提とする。タグに関連付けるポリシーと列の型をそろえる。分析用と監査用にクエリを実行する Warehouse を用意し、利用者のロールには担当するデータへの権限と対応する Warehouse の使用権限を付与する。

- [Account Usage のデータベースロール](https://docs.snowflake.com/en/sql-reference/account-usage)

出典 [Snowflake Horizon Catalog](https://docs.snowflake.com/en/user-guide/snowflake-horizon)、[データガバナンス](https://docs.snowflake.com/en/guides-overview-govern)、[タグベースのマスキング](https://docs.snowflake.com/en/user-guide/tag-based-masking-policies)、[アクセス履歴](https://docs.snowflake.com/en/user-guide/access-history)、[Snowflake アクセス制御](https://docs.snowflake.com/en/user-guide/security-access-control-overview)

Snowflake が計算・保存・カタログの基盤を運用する。利用者は必要な権限を持つロールで分類設定、タグ、マスキングポリシー、Warehouse と監査権限を設定し、SQL や画面から結果を確認する。ロールはアカウント内の権限設定であり、利用者本人とは区別する。内部基盤への直接操作を意味しない。資料を組み合わせた例で、この設定と権限の実動作は未検証。[Snowflake architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts)
