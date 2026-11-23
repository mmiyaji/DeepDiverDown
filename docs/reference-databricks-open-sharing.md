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
