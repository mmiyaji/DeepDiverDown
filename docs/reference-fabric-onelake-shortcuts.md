# Microsoft Fabric：OneLake とショートカット

2026 年 11 月時点の公式資料に基づく。

## 1. ショートカットとは

ショートカットは OneLake 上のオブジェクトで、他の保存先を指す。フォルダとして現れ、シンボリックリンクに近い。ショートカットを消してもターゲットは残る。ターゲットの移動・改名・削除ではショートカットが壊れうる。

[OneLake shortcuts](https://learn.microsoft.com/en-us/fabric/onelake/onelake-shortcuts)

## 2. Tables と Files での置き方

Lakehouse の Tables では、直下の最上位にだけ置ける。ターゲットが Delta などの対応形式なら、Lakehouse がテーブルとして認識し、スキーマを自動で同期する。Files では任意の階層に置け、形式を問わず、テーブル検出は行われない。作成は Fabric のポータルと REST API で行う。

[OneLake shortcuts](https://learn.microsoft.com/en-us/fabric/onelake/onelake-shortcuts)

## 3. 内部ショートカットと読み手

内部ショートカットは、Lakehouse、Warehouse、KQL データベースなど OneLake 内の別の場所を指す。呼び出し元の ID で認可する。ただし Direct Lake on SQL や、T-SQL の委任 ID モードでは、呼び出し元ではなく項目の所有者の ID が渡る。Direct Lake on OneLake や T-SQL のユーザー ID モードを使うと避けられる。読み手は Spark、SQL 分析エンドポイント、Direct Lake、KQL で、OneLake API を通じて Fabric 外のサービスも使える。

[OneLake shortcuts](https://learn.microsoft.com/en-us/fabric/onelake/onelake-shortcuts)、[SQL analytics endpoint](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-sql-analytics-endpoint)

## 4. 外部ショートカットと接続

外部の種類は、S3、S3 互換、ADLS Gen2、Azure Blob Storage、Dataverse、Google Cloud Storage、Iceberg、OneDrive・SharePoint で、オンプレミスはデータゲートウェイ経由になる。ADLS と S3 は接続で認可する。接続の指定には、その接続への権限が要る。各種類の GA・Preview の区別は取得資料で未確認。

[OneLake shortcuts](https://learn.microsoft.com/en-us/fabric/onelake/onelake-shortcuts)

## 5. キャッシュと制限

キャッシュは S3、S3 互換、GCS、ゲートウェイ経由のショートカットが対象で、クラウド間のエグレス費用を減らす。保持期間は 1〜28 日、1 GB を超えるファイルは対象外。主な制限は、1 項目あたり 100,000 ショートカット、ユニーク接続 100、一つのパスに 10 ショートカット、ショートカット同士の連鎖は 5 まで。ショートカットの中のファイルを削除し、ターゲットに書き込み権限があれば、ターゲットのファイルも消える。

[OneLake shortcuts](https://learn.microsoft.com/en-us/fabric/onelake/onelake-shortcuts)

## 6. 実装例 ADLS と S3 を参照する Lakehouse

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 読み手 | Spark ノートブック、SQL 分析エンドポイント | 相対パスとテーブル名で読む |
| Lakehouse | Fabric Lakehouse | Tables と Files |
| Tables のショートカット | ADLS Gen2 の Delta を指す | テーブルとして認識 |
| Files のショートカット | S3 のバケットを指す | ファイルとして読む |
| 接続 | Fabric の接続 | ADLS・S3 の資格情報 |
| キャッシュ | ワークスペースの設定 | 保持期間 1〜28 日 |
| 外部ストレージ | Azure の ADLS Gen2、AWS の S3 | 利用者のアカウントに属する |

公式資料を組み合わせた代表構成であり、動作検証済みの導入事例ではない。Fabric ワークスペースは Fabric の枠、ADLS は Azure の枠、S3 は AWS の枠に置く。S3 のバケットは Fabric の一部ではなく、利用者の AWS アカウントのサービスである。
