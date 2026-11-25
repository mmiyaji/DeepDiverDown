# Airbyte：Connector Builder の宣言・試し読み・公開

## 1. HTTP API の取得ルールを宣言する

[Airbyte の基本アーキテクチャ](reference-airbyte.md) の入力アダプターを Connector Builder で作る。Builder の編集画面は、認証方式、API のパスとリクエスト、レコードの抽出、ページング、カーソルを YAML に保存する。API キーは入力項目として宣言し、値は Source の設定で渡す。

## 2. 試し読みでページとレコードを確認する

ワークスペースの Builder プロジェクトで試し読みを起動する。テスト用の入力値で API にアクセスし、送ったリクエスト、API の応答、抽出レコード、型を確認する。ページ送りや時刻条件に対応する項目は API の仕様に合わせる。

## 3. 公開した定義で同期する

宣言をワークスペース内に公開すると、その定義を選んで Source を作成できる。公開した定義と接続先固有の設定を分ける。Source で実行時の資格情報を指定し、Connection で Destination と対象ストリーム、実行頻度を設定する。

注文の更新時刻で絞り込む例では、同期ジョブが前回の確定済みカーソルを使って API に問い合わせる。受け取ったレコードを Destination がコミットしたあと、確定した State を保存する。削除の取得と更新時刻の粒度は API の仕様に従う。

## 4. 実装例：自前 Kubernetes の Connector Builder と PostgreSQL

自前 Linux Kubernetes の Airbyte に宣言を登録し、外部の注文 API を HTTPS で読む。ここでは `updated_at` の範囲とページ指定を受け付ける API を想定する。分析 PostgreSQL と Airbyte 設定 DB はクラスターの外側に置く想定である。

| 機能 | 実装での担い手 |
| --- | --- |
| コネクターの作成者 | Airbyte ワークスペースで Builder を操作する利用者 |
| 宣言と試し読み | Connector Builder のプロジェクトと Test 操作 |
| HTTP API | 更新日時とページで取得範囲を指定する注文 API |
| 公開した定義 | ワークスペース内の公開済み Source 定義 |
| 定期同期 | カスタム Source を使う Airbyte Connection と同期ワークロード |
| レコードの書き込みと保存 | Airbyte Postgres Destination と分析用 PostgreSQL サーバー |
| 確定済みカーソル | Airbyte 設定 DB の同期 State |

利用者がワークスペースの操作権限、注文 API の認証情報、PostgreSQL の DB ユーザーと TLS を管理する。Destination 用のユーザーは対象 DB でスキーマやテーブルを作り、行を書き込める必要がある。Test に入力する値は公開する YAML に含めない。注文 API の実装、Airbyte と Helm チャートの組み合わせ、想定したデプロイでの動作は未検証である。

- [Connector Builder](https://docs.airbyte.com/platform/connector-development/connector-builder-ui/overview)
- [Connector Builder tutorial](https://docs.airbyte.com/platform/connector-development/connector-builder-ui/tutorial)
- [Incremental Sync](https://docs.airbyte.com/platform/connector-development/connector-builder-ui/incremental-sync)
- [Airbyte Protocol](https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol)
- [Airbyte プラットフォーム構成](https://docs.airbyte.com/platform/understanding-airbyte/high-level-view)
- [Airbyte 設定 DB](https://docs.airbyte.com/platform/understanding-airbyte/database-data-catalog/config-database-connections)
- [Postgres Destination](https://docs.airbyte.com/integrations/destinations/postgres)
