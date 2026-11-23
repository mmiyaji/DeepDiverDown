# Snowflake Time Travel とゼロコピークローン

## 1. 障害例

注文テーブルの一部の金額が一括更新で書き換わった。このシナリオでは元テーブルを直ちに巻き戻さず、誤更新前の状態を別名で比較し、影響行だけを業務確認の上で復元する。時刻は架空。

## 2. 過去の参照と複製

保持期間内で AT／BEFORE を使って過去状態を参照できる。対応オブジェクトをクローンすると当初は変更されていない物理データを共有できる。クローン後の変更で新たに保持するデータが増えることがある。

## 3. 復旧と保持期間

DROP した対応オブジェクトの復元には保持期間内の UNDROP を使う。保持期間は設定・エディション・テーブル種別に依存する。Time Travel を過ぎたデータの Fail-safe は適用条件があり、利用者が SQL で任意に読める復旧手段は提供しない。

## 図で確認するシナリオ

- **誤更新直前を照合して修復** — 現在値と誤更新のクエリIDを確認する。 → 保持期間内の誤更新直前から別名クローンを作る。 → 事故後の正しい変更も残し、特定した影響行だけを修復する。
- **保持期間を超えた場合** — 対象オブジェクトの種別と保持期間を調べる。 → SQL での過去参照が可能か確認し、Fail-safe が適用される場合はサービス側へ対応を相談する。

## 公式資料

- [Time Travel](https://docs.snowflake.com/en/user-guide/data-time-travel)
- [Fail-safe](https://docs.snowflake.com/en/user-guide/data-failsafe)
- [クローンの考慮点](https://docs.snowflake.com/en/user-guide/object-clone)

## 4. 実装例 Snowflake Enterprise の誤更新調査

永続テーブルの保持期間を事前に設定し、誤更新の直前から検証用クローンを作る例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 復旧担当 | データ復旧担当ロール | 誤更新のクエリ ID と利用可能な履歴を確認する。 |
| 本番の注文テーブル・保持期間内の履歴 | Snowflake 永続テーブル ORDERS と Time Travel | DATA_RETENTION_TIME_IN_DAYS を例として 7 日に設定する。 |
| 復旧確認用クローン | ORDERS_RECOVERY クローン | クエリ ID を使い、BEFORE STATEMENT で誤更新直前の状態を複製する。 |
| 差分検証・修復 | 検証用ウェアハウスの SQL | 検証済みの影響行を現行表へ反映する。 |
| サービス事業者による回復期間 | Snowflake Fail-safe | Time Travel 後に該当する永続データを Snowflake が回復するための期間。 |

検証用クローンで差分と対象キーを確認してから、本番の影響行を修復する。Fail-safe は利用者が SQL で照会できる履歴とは別に、適用条件を満たすデータの回復を Snowflake が支援する仕組み。

検証ロールに元表の参照、復旧用スキーマでのクローン作成、検証用 Warehouse の使用を許可する。本番表への書き込みは修復担当のロールに限定する。この例では独立した復旧用スキーマにクローンを作り、そのスキーマの将来の権限付与も確認する。

- [CREATE CLONE のアクセス制御](https://docs.snowflake.com/en/sql-reference/sql/create-clone)

出典 [Time Travel](https://docs.snowflake.com/en/user-guide/data-time-travel)、[Fail-safe](https://docs.snowflake.com/en/user-guide/data-failsafe)、[クローンの考慮点](https://docs.snowflake.com/en/user-guide/object-clone)、[Snowflake パラメーター](https://docs.snowflake.com/en/sql-reference/parameters#data-retention-time-in-days)、[QUERY_HISTORY ビュー](https://docs.snowflake.com/en/sql-reference/account-usage/query_history)

Snowflake が計算・保存基盤と履歴の保持を運用する。利用者は権限に応じて保持期間、クローン、Warehouse と修復 SQL を操作できるが、Fail-safe のデータを直接照会・復旧できず、条件に応じて Snowflake に回復を依頼する。ロールはアカウント内の権限設定で、担当者とは区別する。7 日の保持と修復手順は例であり、この構成の実動作は未検証。[Snowflake architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts)
