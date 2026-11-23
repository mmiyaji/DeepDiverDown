# データウェアハウスの差分プライバシー

## 1. 対象

個人などの保護単位を指定し、集計結果の公開に伴うプライバシー損失を管理する構成例。元テーブルのアクセス制御、分析ルール、集計、予算管理、公開結果を区別する。

## 2. 機能配置と処理

管理者は対象データ、保護単位、貢献の上限、許容するプライバシー予算を定める。分析者は許可された入口から集計を要求する。実行側は保護単位ごとの貢献を制限し、ノイズを加えて集計し、小規模なグループの扱いを制御する。繰り返し実行による損失の累積を追跡し、予算を超える要求を拒否する。結果の誤差と利用目的を評価し、監査情報には機微な入力や結果を過剰に記録しない。

## 3. 設計上の注意

ε と δ は方式・保護単位・隣接関係と合わせて評価する。ε を小さくすると一般にノイズが増え、統計の有用性とのトレードオフがある。値やグループへの貢献の上限は感度と結果に影響する。複数の問い合わせや公開の合成、予算の管理範囲、利用者が元データへ直接アクセスする迂回経路を確認する。しきい値処理やマスキングだけを差分プライバシーと呼ばない。

[NIST SP 800-226](https://csrc.nist.gov/pubs/sp/800/226/final)、[BigQuery differential privacy](https://docs.cloud.google.com/bigquery/docs/differential-privacy)。

## 4. 実装例：BigQuery の分析ルール

BigQuery の保護対象テーブルに対してプライバシーポリシーを設定したビューを用意し、認可された分析者が `WITH DIFFERENTIAL_PRIVACY` の集計を実行する。分析ルールでクエリごとの条件と利用者の予算を制御し、元テーブルへの直接アクセスを別途制限する。クエリには保護単位、ε、δ、グループ貢献上限などを指定し、必要に応じて集計の値の貢献範囲も設定する。

BigQuery のパラメーター駆動の予算管理はプレビューであり、データクリーンルームにおける差分プライバシーの適用とは提供段階が異なる。分析ルールの更新で予算がリセットされる点を運用で考慮する。個々の値は実例・推奨値として固定せず、適用環境で決める。Google は実装上の限界により、出力データのプライバシー特性そのものを保証しないと説明している。

| 機能 | 担い手 |
|---|---|
| 元データ | アクセスを制限した BigQuery テーブル |
| 方針と予算 | プライバシーポリシー付き BigQuery ビューと分析ルール |
| 集計と出力 | 差分プライバシー付き GoogleSQL 集計と結果 |
| 監督 | 方針管理者と分析結果の評価担当者 |

[BigQuery 分析ルール](https://docs.cloud.google.com/bigquery/docs/analysis-rules)、[差分プライバシー集計関数](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/aggregate-dp-functions)、[BigQuery の利用と限界](https://docs.cloud.google.com/bigquery/docs/differential-privacy)。


## 5. 実装例：AWS Clean Rooms のユーザー単位の差分プライバシー

提供者アカウントの S3 データを AWS Clean Rooms コラボレーションへ関連付け、分析側に差分プライバシー付き集計結果だけを配信する。

| 機能 | 担い手 |
| --- | --- |
| 収集済みの元データ | 提供者の S3 と AWS Glue Data Catalog。AWS Clean Rooms に設定済みテーブルを関連付ける。 |
| 分析権限と保護単位 | コラボレーションのクエリ権限とカスタム分析ルール。保護単位となるユーザー識別列を設定する。 |
| 差分プライバシー集計 | Clean Rooms の SQL 実行基盤が対応する集計にノイズを加え、プライバシー予算を管理する。 |
| 結果の保存 | 結果受領メンバーの S3 バケット。受領用サービスロールで出力する。 |

この例は S3 にデータを置く SQL コラボレーションを前提とする。提供者の読み取り用サービスロールと受領者の出力用ロールを分け、分析者の元データへの直接アクセスを許可しない。保護は識別列が同一人物を一貫して表し、対応するクエリが予算内で実行される範囲に適用される。予算の増額や刷新、別コラボレーション、別経路での提供も含めて公開を管理する。同じ人のデータを繰り返し分析する場合は、月次刷新による累積開示を評価する。サービスが認める集計でも、結果の誤差や小集団での利用可否は別途検証する。

公式資料

- [AWS Clean Rooms Differential Privacy](https://docs.aws.amazon.com/clean-rooms/latest/userguide/differential-privacy.html)
- [差分プライバシー付きカスタム分析ルール](https://docs.aws.amazon.com/clean-rooms/latest/userguide/custom-diff-privacy.html)
- [Clean Rooms の予算とノイズ設定](https://docs.aws.amazon.com/clean-rooms/latest/userguide/dp-settings.html)
- [Clean Rooms のデータテーブルの準備](https://docs.aws.amazon.com/clean-rooms/latest/userguide/working-with-data-tables.html)
- [Clean Rooms のサービスロール](https://docs.aws.amazon.com/clean-rooms/latest/userguide/setting-up-roles.html)
- [Clean Rooms の結果受領設定](https://docs.aws.amazon.com/clean-rooms/latest/userguide/use-sql-editor.html)

### Execution, permissions and validation assumptions

BigQuery executes the protected SQL as a managed service; the analyst submits an authorized query, while the customer configures datasets, view access, analysis rules and IAM. Google-operated infrastructure is not directly controlled by the customer. The example combines documented features and has not been tested as a complete deployment. Its privacy unit, bounds, budget and access controls require validation against the actual data and use case.

For the Clean Rooms example, the provider configures a service role to read S3 and Glue metadata; the result recipient configures a separate service role to write to its S3 bucket. Glue and input S3 resources must be in the collaboration's AWS Region, and customer-managed KMS keys can require additional permissions. AWS operates the managed service and S3/Glue infrastructure; members control their roles, data, collaboration settings and analysis rules. This is a representative combination of official features, not a tested deployment; identities, membership, applicable DP SQL, output permissions and privacy-budget behavior must be checked in the intended environment.

[BigQuery access control](https://docs.cloud.google.com/bigquery/docs/access-control), [AWS Clean Rooms service roles](https://docs.aws.amazon.com/clean-rooms/latest/userguide/setting-up-roles.html).
