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
