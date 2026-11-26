# Amazon Redshift Serverless：RPU とスケーリング

## 1. 範囲
Redshift Serverless の計算容量（RPU）、ベース容量、価格性能ターゲット、AI 駆動のスケーリングを扱う。2026 年 11 月時点の公式資料に基づく。

## 2. RPU とベース容量
容量は Redshift Processing Unit（RPU）で測り、1 RPU は 16 GB のメモリを持つ。ベース容量は既定 128 RPU で、4 RPU、または 8 以上の 8 RPU 刻みで 512 RPU まで設定できる。米国東部（バージニア北部・オハイオ）、米国西部（オレゴン）、欧州（アイルランド・フランクフルト）では 1024 RPU まで設定でき、512 を超える範囲は 32 RPU 刻み。4 RPU は 32 TB までのマネージドストレージ向けで、128 TB を超えるデータには 32 RPU 以上が必要とされる。ベース容量の変更は、実行中のクエリの一部を取り消すことがある。

出典 [Compute capacity for Amazon Redshift Serverless](https://docs.aws.amazon.com/redshift/latest/mgmt/serverless-capacity.html)

## 3. AI 駆動のスケーリングと最適化
価格性能ターゲットは、コスト優先、バランス、性能優先のスライダーで、ワークグループごとに設定する。新規ワークグループでは既定で有効でバランスに設定される。サービスはワークロードの履歴から学び、クエリの複雑さとデータ量に応じて RPU を調整する。最大容量と最大 RPU 時間は、ターゲットにかかわらず常に守られる。ターゲットを変えても効果はすぐには出ず、1〜3 日の観察が勧められている。8〜512 RPU のワークロードでの利用が勧められている。使われた RPU 数は SYS_SERVERLESS_USAGE と CloudWatch の ComputeCapacity で確認する。

課金の単位、最小時間、料金は今回取得した資料では確認していない（未確認）。性能・コストに関する数値は AWS の説明であり、実環境では未検証。

出典 [Compute capacity for Amazon Redshift Serverless](https://docs.aws.amazon.com/redshift/latest/mgmt/serverless-capacity.html)

## 4. 実装例 Redshift Serverless のワークグループ

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| ワークグループ | Serverless ワークグループ | エンドポイント、ベース容量、最大容量 |
| コンピュート | RPU | 内部構成は非公開 |
| 価格性能ターゲット | ワークグループ設定 | コンソールで設定 |
| スケーリング | AI 駆動のスケーリングと最適化 | 上限内で RPU を増減 |
| データ | ネームスペースと RMS | データベース、ユーザー、権限 |
| 使用量 | SYS_SERVERLESS_USAGE | 時間帯ごとの RPU |

AWS が計算基盤とストレージ基盤を運用し、利用者は容量、ターゲット、データ、権限を設定する。公式資料に基づく代表構成であり、実環境の性能は未検証。

出典 [Compute capacity for Amazon Redshift Serverless](https://docs.aws.amazon.com/redshift/latest/mgmt/serverless-capacity.html)
