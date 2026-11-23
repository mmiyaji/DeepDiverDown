# Data Vault の履歴管理とマート設計

## 1. モデルの範囲

注文と顧客のデータを使い、Data Vault 2.0 の Raw Vault、Business Vault、Information Mart の役割を示す。例は物理実装や製品に依存しない。

出典 [Data Vault 2.0 Introduction](https://datavaultalliance.com/engineering/data-vault-2-0-an-introduction/)、[Data Vault Alliance: Centralized Architecture vs Decentralized Architecture](https://datavaultalliance.com/strategy-operating/centralized-vs-decentralized-architecture/)

## 2. ステージングと取込メタデータ

ソースから注文番号、顧客番号、状態コード、業務上の変更時刻を取り込む。ステージングで取込時刻と出所を付け、後段で入力を追跡できるようにする。

出典 [Data Vault Alliance: Building a Real-Time Data Vault](https://datavaultalliance.com/engineering/building-a-real-time-data-vault-in-snowflake/)

## 3. Hub と Link

注文 Hub は注文番号を、顧客 Hub は顧客番号を、それぞれの業務キーとして一意に持つ。取り込み元が増える場合も、同じ意味と粒度のキーかを確認してから統合する。注文・顧客 Link は両 Hub のキーで表す関連を保持する。

出典 [Data Vault Alliance: Data Vault, Data Mesh, and Polysemes](https://datavaultalliance.com/architecture-data/data-vault-data-mesh-and-polysemes/)、[Data Vault Alliance: Building a Real-Time Data Vault](https://datavaultalliance.com/engineering/building-a-real-time-data-vault-in-snowflake/)

## 4. Satellite の履歴

注文 Satellite は注文 Hub のキーに対して属性履歴を保持する。例では注文 O-101 の状態が P から S に変わると、S を新しい行で記録する。取込時刻はデータを受け取った時刻を示すため、遅れて届いた状態を業務上いつの状態として扱うかは、ソースの変更時刻などとあわせて判断する。

出典 [Data Vault Alliance: Data Vault, Data Mesh, and Polysemes](https://datavaultalliance.com/architecture-data/data-vault-data-mesh-and-polysemes/)、[Data Vault Alliance: Building a Real-Time Data Vault](https://datavaultalliance.com/engineering/building-a-real-time-data-vault-in-snowflake/)

## 5. Business Vault の派生

例では最初に出荷コード S を「出荷処理済み」としていた。返品済み R も出荷処理を経た注文に含めるという定義変更を Business Vault の計算に反映する。Raw Vault に保持したソース状態を使って新しいルールで再計算できる。履歴からどの状態を採用するかは、マートの基準時刻と業務ルールで決まる。

出典 [Data Vault Alliance: Building a Real-Time Data Vault](https://datavaultalliance.com/engineering/building-a-real-time-data-vault-in-snowflake/)、[Data Vault Alliance: Centralized Architecture vs Decentralized Architecture](https://datavaultalliance.com/strategy-operating/centralized-vs-decentralized-architecture/)

## 6. Information Mart の粒度

例では注文1件を1行とし、選んだ基準時刻の出荷処理済み区分と顧客を提供する。Business Vault の派生値に Raw Vault の関連を組み合わせる。利用側の注文数や状態別の集計は、このマートの粒度に基づく。

出典 [Data Vault 2.0 Introduction](https://datavaultalliance.com/engineering/data-vault-2-0-an-introduction/)、[Data Vault Alliance: Centralized Architecture vs Decentralized Architecture](https://datavaultalliance.com/strategy-operating/centralized-vs-decentralized-architecture/)

## 7. 実装例 Snowflake の Raw Vault と出荷状態マート

S3 の注文変更ファイルを Snowpipe でロードし、ステージング、Raw Vault、Business Vault、配信マートを Snowflake の別スキーマに置く実装例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| ファイル取込 | Amazon S3・Snowflake 管理の SQS・Snowpipe | S3 の作成通知を受けた Snowpipe が外部ステージからファイルを読み込む。 |
| 注文・顧客データ | LANDING.ORDERS 入力行 | 取込可能になった注文変更を保持する。 |
| ステージング | STAGING.ORDERS_LOAD ビュー | 業務キーを整形し、取込時刻と出所を付けて後段に渡す。 |
| 注文 Hub | RAW.HUB_ORDER | 注文業務キーを一意に登録する。 |
| 顧客 Hub | RAW.HUB_CUSTOMER | 顧客業務キーを一意に登録する。 |
| 注文・顧客 Link | RAW.LINK_ORDER_CUSTOMER | 注文と顧客のキーの組を保持する。 |
| 注文 Satellite | RAW.SAT_ORDER_STATE | 状態が変わった行を履歴として追記する。 |
| Business Vault | BUSINESS.ORDER_SHIPMENT_STATUS ビュー | 出荷処理済みを示す区分を計算する。 |
| 注文 Information Mart | MART.ORDER_STATUS テーブル | 分析基準時点を決めて注文ごとに展開する。 |

Snowpipe の外部ステージにはストレージ統合を使い、AWS 側の IAM ロールに対象の S3 プレフィックスだけを許可する。Snowflake Task グラフは専用 Virtual Warehouse で動かし、各ロードとマート更新の依存順序を設定する。パイプ所有、変換、マート参照の Snowflake ロールを分ける。Hub と Link の再処理はロード SQL で重複を避ける。Satellite は元の値と取得時刻を保存し、出荷処理済み区分の変更時には Business Vault の計算結果とマートを更新する。

取り込み経路の公式資料 [Snowpipe による Amazon S3 自動取り込み](https://docs.snowflake.com/en/user-guide/data-load-snowpipe-auto-s3)

出典 [Data Vault 2.0 Introduction](https://datavaultalliance.com/engineering/data-vault-2-0-an-introduction/)、[Data Vault Alliance: Data Vault, Data Mesh, and Polysemes](https://datavaultalliance.com/architecture-data/data-vault-data-mesh-and-polysemes/)、[Data Vault Alliance: Building a Real-Time Data Vault](https://datavaultalliance.com/engineering/building-a-real-time-data-vault-in-snowflake/)、[Data Vault Alliance: Centralized Architecture vs Decentralized Architecture](https://datavaultalliance.com/strategy-operating/centralized-vs-decentralized-architecture/)、[Snowflake MERGE](https://docs.snowflake.com/en/sql-reference/sql/merge)、[Snowflake task graph](https://docs.snowflake.com/en/user-guide/tasks-graphs)

顧客 AWS の S3 と IAM ロール、Snowflake が管理する AWS 通知キュー、Snowflake アカウント内のステージ・Task・Warehouse・データを区別する。利用者はステージ、ストレージ統合、IAM 信頼、SQL と Warehouse 設定を管理し、Snowflake 内部の計算・保存基盤や通知キューを直接管理しない。資料を組み合わせた例で、このロードと Vault SQL の実動作は未検証。[Snowflake S3 integration](https://docs.snowflake.com/en/user-guide/data-load-s3-config-storage-integration)、[Snowflake architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts)
