# Databricks OpenSharing（Delta Sharing）の接続と失効

## 1. 共有のモデル

提供者は Unity Catalog で share を定義し、受領者に読み取りを許可する。注文集計のみを共有対象とする例。旧称 Delta Sharing としての資料とも対応する。

## 2. Databricks-to-Databricks

双方が Unity Catalog 対応のワークスペースで利用する経路。受領側の識別情報を使い、共有から受領側で利用するカタログを構成する。利用可能な資産種別は経路で異なる。

## 3. Databricks-to-Open

外部の対応クライアントは OpenSharing のプロトコルで共有を読む。認証方式は提供者の構成に依存し、発行した資格情報の管理が必要になる。

## 4. 共有の停止

受領者のアクセスを取り消し、以降の共有データ取得を止める。すでに受領者が保存した取得結果に対する管理も契約と運用に含める。

## 図で確認するシナリオ

- **Databricks 内と外部クライアントで読み方を比較** — 共有対象と受領者を指定する。 → Unity Catalog 対応の受領側から共有用カタログを経由して参照する。 → 外部クライアントは構成された認証方式でプロトコルに接続する。
- **受領者へのアクセスを取り消す** — 現在の公開対象と受領者を確認する。 → 受領者が今後取得できる範囲を取り消す。取得済みデータは契約上の手続きで扱う。

## 公式資料

- [OpenSharing の概念](https://docs.databricks.com/aws/en/opensharing)
- [OpenSharing の SQL リファレンス](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-sharing)

## 5. 実装例 OpenSharing の受領者別公開

同じ集計表を、別 Databricks アカウントと外部ツールに向けた二つの受領者設定で公開する例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 提供側管理者 | 提供側 Unity Catalog 管理者 | 集計表と提供相手を決める。 |
| 注文集計テーブル | sales.orders_summary | 提供側の Databricks が管理する Delta テーブル。実体は提供者の Amazon S3 に置く。 |
| 公開資産と受領者の定義・失効 | OpenSharing の SHARE・RECIPIENT・権限 | 受領者を経路別に登録して、Share へのアクセスを付与・取り消しする。 |
| 受領側のデータカタログ | 受領者の Unity Catalog 共有カタログ | Databricks-to-Databricks の提供者と Share を指定して作る。 |
| 受領側のクエリ実行 | 受領者の Databricks SQL Warehouse | 受領側で共有カタログを読む。 |
| 外部クライアント向け共有接続口 | オープン共有の Delta Sharing 接続口 | 外部ツール向けの共有プロトコルを提供する。 |
| 外部分析クライアント | Python の Delta Sharing クライアント | 受領者向けの資格情報ファイルを使い、期限付きでファイルを読み取る。 |

Databricks-to-Databricks と外部クライアントで受領者設定を分ける。取り消しの対象は共有を経由する将来の利用で、すでに受領者が書き出した複製は各受領者が管理する。

Databricks 受領側は共有 ID でメタストアを特定し、受領側の権限を与えられた利用者が共有カタログと SQL Warehouse を使う。この例の外部受領者には、有効化リンクから取得する bearer トークン方式を使う。提供元の S3 に恒久的な IAM 権限を与えず、共有側が発行する期限付きのアクセスで対象ファイルを参照させる。

- [Databricks-to-Open の認証とデータ取得](https://docs.databricks.com/aws/en/opensharing/share-data-open)
- [Bearer トークン方式の受領者](https://docs.databricks.com/aws/en/opensharing/create-recipient-token)

出典 [OpenSharing の概念](https://docs.databricks.com/aws/en/opensharing)、[OpenSharing の SQL リファレンス](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-sharing)、[OpenSharing 受領者の作成](https://docs.databricks.com/aws/en/opensharing/create-recipient)、[OpenSharing Share の作成](https://docs.databricks.com/aws/en/opensharing/create-share)

提供側と受領側の Databricks アカウント、提供者の AWS S3、外部受領者は別の領域とする。受領側の SQL Warehouse はサーバーレスを選択し Databricks 管理の計算プレーンで実行する。提供者は共有対象・受領者・権限を設定し、外部受領者は bearer 資格情報で接続するが、Databricks 内部基盤は直接操作しない。公式資料を組み合わせた例であり、この構成の実動作は未検証。[Databricks architecture](https://docs.databricks.com/aws/en/security/network/deployment-architecture/)、[Managed storage](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)
