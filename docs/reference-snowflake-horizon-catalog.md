# Snowflake Horizon Catalog の分類・保護・監査

## 1. 用途と境界

Horizon Catalog は資産の発見、分類、ガバナンス、追跡を組み合わせる。このモデルは Snowflake 内の注文テーブルを対象にし、外部エンジンへのポリシー伝播を一律には仮定しない。

## 2. 分類とタグ

注文テーブルの customer_email を分類対象にする。分類結果は管理者が確認し、タグの割り当てと、データ型に合うマスキングポリシーの関連付けを設計する。分類だけで値が自動的に非表示になるわけではない。

## 3. 問い合わせ時の保護

権限のあるロールだけが対象のオブジェクトにアクセスできる。その上で、列をどう見せるかはマスキングポリシーが判定する。見せる行を制御する要件には別の行アクセスポリシーを使う。

## 4. 監査とリネージ

ACCESS_HISTORY で直接・間接に参照されたオブジェクトや列などを確認する。利用権限、エディション、処理経路によって参照可能な情報と捕捉範囲が異なる。影響調査では変換先と利用記録を照合する。

## 5. 外部エンジンからの読み取り（Iceberg REST）

外部エンジンは Horizon Iceberg REST カタログ API（`https://<account_identifier>.snowflakecomputing.com/polaris/api/catalog`）で、Snowflake 管理 Iceberg テーブルを読み書きする。Horizon Catalog は Apache Polaris を組み込んで互換性を持つ。ヘッダー `X-Iceberg-Access-Delegation: vended-credentials` を指定すると、Snowflake が表ごとの一時的なストレージ認証情報を返す。認証方式は External OAuth、キーペア（JWT）、Programmatic Access Token、Workload Identity Federation が公式資料に挙がる。読み取りには表の `SELECT` とデータベース・スキーマの `USAGE`、書き込みには DML 権限が必要で、表の所有ロールは外部ボリュームの `USAGE` を保つ。

2026 年 11 月時点の公式資料では、Snowflake 管理 Iceberg v2 と v3 の読み取りと書き込みが GA と記載されている。制約は次のとおり。外部エンジンからの CTAS、equality delete、Iceberg の tag・branch、スナップショットのロールバック、v2 から v3 へのアップグレード、dynamic table や共有表への書き込みは使えない。変換した表では vended credentials が使えない。S3 互換の非 AWS ストレージは未対応と記載されている。API 呼び出しは 100 万件あたり 0.5 クレジットの Cloud Services 課金が 2026 年後半に始まる予定で、変更されうる。外部エンジンへのマスキングなどのポリシー伝播は未確認である。

2026 年 10 月の Snowflake 技術記事は、S3 互換ストレージ上の管理 Iceberg テーブルを外部エンジンへ公開する構想を private preview として紹介している。ストレージの内部識別を `s3://` 形式のパスへ解決し、古いメタデータでは一度だけメタデータ更新が必要になる場合があるとする。現行ドキュメントの「未対応」と状況が食い違うため、提供範囲は利用前に確認する（未確認）。S3 互換ストレージを AWS S3 サービスと混同しない。

## 図で確認するシナリオ

- **分類・保護・監査と外部エンジンからの読み取り** — 対象列の分類結果を確認する。 → 保護対象のタグとポリシーを関連付ける。 → SELECT 権限のある分析担当にも、設定によりマスク済みの値を返す。 → 下流ビューを確認し、アクセス履歴で実際の利用者と照合する。 → 外部エンジンは REST カタログで権限を確認し、一時認証情報でメタデータとデータを読む。

## 公式資料

- [Snowflake Horizon Catalog](https://docs.snowflake.com/en/user-guide/snowflake-horizon)
- [データガバナンス](https://docs.snowflake.com/en/guides-overview-govern)
- [タグベースのマスキング](https://docs.snowflake.com/en/user-guide/tag-based-masking-policies)
- [アクセス履歴](https://docs.snowflake.com/en/user-guide/access-history)
- [Horizon Catalog の Iceberg REST と外部エンジン](https://docs.snowflake.com/en/user-guide/tables-iceberg-access-using-external-query-engine-snowflake-horizon)
- [S3 互換ストレージと Horizon Catalog](https://www.snowflake.com/en/blog/engineering/s3-compatible-storage-iceberg-horizon-catalog/)

## 6. 実装例 Snowflake での列分類とタグマスクと外部エンジンの読み取り

受注メール列に分類タグとマスキングポリシーを適用し、分析権限と監査権限を分離する例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| データ管理者 | 分類設定用ロール | 分類プロファイルと結果を管理する。 |
| 機微データ分類 | Sensitive Data Classification | 機微情報候補の分類結果を確認する。 |
| 列の分類ラベル・列の値を保護するポリシー | 分類タグとマスキングポリシー | 文字列用ポリシーをタグに関連付ける。 |
| 分析担当ロール | SALES_READER ロール | 分析用 Warehouse の使用と、公開ビューの参照を許可する。 |
| 注文のメールアドレス列 | ORDERS.CUSTOMER_EMAIL | メール列に分類タグを設定する。 |
| 注文分析ビュー | SALES.ORDERS_ANALYSIS | 注文分析に必要な列を公開する。 |
| 外部エンジン・Iceberg REST カタログ API・管理 Iceberg テーブル | Spark などの外部エンジン、Horizon Iceberg REST カタログ API、ORDERS_ICE | 外部エンジンがカタログで権限を確認し、一時認証情報で表を読む。 |
| 列アクセスの監査履歴 | ACCOUNT_USAGE.ACCESS_HISTORY | `SNOWFLAKE.GOVERNANCE_VIEWER` を付与した監査用アカウントロールで参照する。 |

この例は Snowflake Enterprise Edition 以上を前提とする。タグに関連付けるポリシーと列の型をそろえる。分析用と監査用にクエリを実行する Warehouse を用意し、利用者のロールには担当するデータへの権限と対応する Warehouse の使用権限を付与する。

- [Account Usage のデータベースロール](https://docs.snowflake.com/en/sql-reference/account-usage)

出典 [Snowflake Horizon Catalog](https://docs.snowflake.com/en/user-guide/snowflake-horizon)、[データガバナンス](https://docs.snowflake.com/en/guides-overview-govern)、[タグベースのマスキング](https://docs.snowflake.com/en/user-guide/tag-based-masking-policies)、[アクセス履歴](https://docs.snowflake.com/en/user-guide/access-history)、[Snowflake アクセス制御](https://docs.snowflake.com/en/user-guide/security-access-control-overview)

Snowflake が計算・保存・カタログの基盤を運用する。利用者は必要な権限を持つロールで分類設定、タグ、マスキングポリシー、Warehouse と監査権限を設定し、SQL や画面から結果を確認する。ロールはアカウント内の権限設定であり、利用者本人とは区別する。内部基盤への直接操作を意味しない。資料を組み合わせた例で、この設定と権限の実動作は未検証。[Snowflake architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts)
