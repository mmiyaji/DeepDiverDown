# データウェアハウスの合成データ

## 1. 対象

機微な注文データから、開発や分析の検証に使う合成データを生成し、品質と開示リスクを評価してから利用者に提供する構成例。個人情報を含む元データ、学習済みモデル、評価結果、公開候補を同じ安全性として扱わない。

## 2. 機能配置と処理

許可された実行環境が元テーブルを読み、データ型・列の制約を確認して生成器を学習する。生成した候補は非公開の検証領域に置き、元データと比較して分布・相関・業務上の制約を評価する。別途、実データとの近接性や推測・再識別の可能性を評価し、担当者が用途と残存リスクを審査した後に公開先へ渡す。評価用に参照した元データや学習済みモデルを無条件に公開しない。

## 3. プライバシーと品質の限界

合成データは実在の行をそのまま出力しないことを目指すが、それだけでは再識別や学習データの記憶を防ぐ保証にはならない。差分プライバシーを満たす生成方式と、そうでない方式を区別する。差分プライバシーを使う場合も、保護対象、隣接関係、予算、前処理と複数回の公開を含めた保証範囲を確認する。品質指標や近接性指標は有用な検査だが、単独で安全性の証明にはならない。少数集団や希少事象の表現、生成結果の偏りと下流分析の誤差も評価する。

[NIST SP 800-226](https://csrc.nist.gov/pubs/sp/800/226/final)、[NIST の差分プライバシーを用いた合成データ](https://www.nist.gov/blogs/cybersecurity-insights/differentially-private-synthetic-data)、[NIST SP 800-188](https://csrc.nist.gov/pubs/sp/800/188/final)。

## 4. 実装例：BigQuery と Cloud Run Jobs 上の SDV

Google Cloud の BigQuery に元テーブルと公開用テーブルを分け、権限を持つ Cloud Run Jobs の Python コンテナーで SDV Community の `GaussianCopulaSynthesizer` を学習・サンプリングする例。生成器は BigQuery 自体の機能ではなく外部の Python プロセスである。SDMetrics などで品質・プライバシー指標を確認し、人が公開を承認する。具体的な認証、アクセス制御、評価基準、ネットワークは環境ごとに設計する。この生成方式に差分プライバシー保証は仮定しない。

| 機能 | 担い手 |
|---|---|
| 制限された元データ | BigQuery の注文テーブル |
| メタデータ確認と生成 | Python の SDV Metadata・GaussianCopulaSynthesizer |
| 検証 | SDMetrics と公開審査担当者 |
| 提供と利用 | 承認後の BigQuery 合成テーブルと開発者 |

[SDV Community](https://docs.sdv.dev/sdv/explore/sdv-community)、[SDMetrics](https://docs.sdv.dev/sdmetrics)、[SDMetrics Privacy](https://docs.sdv.dev/sdmetrics/data-metrics/privacy)、[BigQuery のアクセス制御](https://docs.cloud.google.com/bigquery/docs/access-control)。


### 実行環境と権限

Cloud Run Jobs で SDV と SDMetrics を含む Python コンテナーをバッチ実行する構成例。元テーブルと候補は公開用とは別の BigQuery データセットに置き、ジョブのサービスアカウントに元データの読み取り、候補データセットへの書き込みなど必要最小限の権限を付ける。公開用データセットへのコピーは審査後に別途実施する。コンテナーの作成、BigQuery クライアント、ジョブ起動、評価の閾値と公開操作は利用者が実装・管理する。Cloud Run は SDV や匿名化を自動提供しない。

| 追加する役割 | 担い手 |
| --- | --- |
| 生成・評価のバッチ実行 | Cloud Run Jobs 上の Python コンテナー |
| 非公開の生成候補 | アクセスを制限した BigQuery データセット |
| API 利用時の認証 | Cloud Run Job のサービスアカウント |

[Cloud Run Jobs](https://docs.cloud.google.com/run/docs/create-jobs)、[Cloud Run jobs のサービス ID](https://docs.cloud.google.com/run/docs/configuring/jobs/service-identity)、[BigQuery 認証](https://docs.cloud.google.com/bigquery/docs/authentication)。
