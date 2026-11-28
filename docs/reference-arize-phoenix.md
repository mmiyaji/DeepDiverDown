# Arize Phoenix の概要（トレース収集・保存・評価・実験・プロンプト管理）

## 1. 概要

Phoenix は LLM アプリの実験、評価、障害調査のための OSS の可観測性基盤である。トレース、評価、データセット、実験、プロンプト管理、Playground を備える。ライセンスは Elastic License 2.0（ELv2）で、一部のコードは特許で保護されると GitHub の README に記載されている。自前運用に利用料や機能制限はなく、データは自分の環境に置け、エアギャップ環境でも動かせると公式は述べる。取得日は 2026年11月28日。

- [Phoenix (GitHub)](https://github.com/Arize-ai/phoenix)
- [Phoenix self-hosting](https://arize.com/docs/phoenix/self-hosting)

## 2. 計装

Phoenix は OpenTelemetry を土台にし、言語・フレームワークを問わないとされる。自動計装は OpenInference が担い、多数のフレームワークと LLM プロバイダー向けの統合が並ぶ。アプリ側で計装がスパンを作り、Phoenix へ送る。対応一覧と版は未確認。

- [Phoenix (GitHub)](https://github.com/Arize-ai/phoenix)

## 3. コレクターと画面

Phoenix は Web UI、トレースコレクター、SQL データベースから成るコンテナ化されたアプリである。`PHOENIX_PORT`（既定 6006）で画面と OTLP HTTP（`/v1/traces`）、`PHOENIX_GRPC_PORT`（既定 4317）で OTLP gRPC を受ける。`PHOENIX_ENABLE_PROMETHEUS` を有効にすると 9090 番で Prometheus 向けの指標を出す（既定は無効）。コレクター内部のキューや保存の保証は記載がなく未確認。

- [Phoenix architecture](https://arize.com/docs/phoenix/self-hosting/architecture)
- [Phoenix configuration](https://arize.com/docs/phoenix/self-hosting/configuration)

## 4. 保存

既定は SQLite で、`PHOENIX_SQL_DATABASE_URL` が未設定なら一時フォルダにファイルを作る。公式は SQLite をローカル開発・単独利用向け、PostgreSQL（14 以上）を本番・複数人向けとする。`PHOENIX_WORKING_DIR`（既定 `~/.phoenix/`）は保存・読み込み・書き出しの場所で、SQLite では永続ボリュームを推奨する。保存対象はプロジェクト、トレース、データセット、実験。PostgreSQL では `PHOENIX_SQL_DATABASE_SCHEMA` でスキーマを分けられ、読み取り専用の複製を `PHOENIX_SQL_DATABASE_READ_REPLICA_URL` で指定できる。保持期間は `PHOENIX_DEFAULT_RETENTION_POLICY_DAYS`（既定 0 で無期限）で、プロジェクトごとに画面から上書きできる。

スケールは、同じ PostgreSQL につないだ複数インスタンスをロードバランサーの後ろに置く形が示されている。1 インスタンスは 1 テナントで、チームの分離にはインスタンスを分ける。大量の取り込みや OLAP は Arize AX（別製品）に案内されており、本資料の範囲外。

- [Phoenix architecture](https://arize.com/docs/phoenix/self-hosting/architecture)
- [Phoenix configuration](https://arize.com/docs/phoenix/self-hosting/configuration)

## 5. 評価・データセット・実験・プロンプト

GitHub の README は次の機能を挙げる。評価は LLM を使った応答・検索の品質評価。データセットはバージョン付きの例の集合で、実験・評価・ファインチューニングに使う。実験はプロンプト・モデル・検索の変更を追跡して比べる。プロンプト管理はバージョン管理、タグ付け、テスト。Playground はモデル比較、パラメーター調整、記録済み LLM 呼び出しの再実行に使う。評価と Playground は外部の LLM を呼ぶ前提で、対応プロバイダーの一覧は未確認。組み込みの AI エージェント（PXI）とリモート MCP サーバーも README に挙がるが、詳細は未確認。

- [Phoenix (GitHub)](https://github.com/Arize-ai/phoenix)

## 6. 認証

認証は OAuth2、LDAP、ローカルアカウントに対応し、ロールベースのアクセス制御がある。`PHOENIX_HOST` の既定は `127.0.0.1`（Docker イメージと Helm チャートでは `::`）で、`PHOENIX_ENABLE_AUTH` が未設定のとき、ループバック以外のアドレスでは認証が自動で有効になる。初期管理者 `admin@localhost` の既定パスワードは `admin`（`PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD`）で、本番では変更が必要。`PHOENIX_ENABLE_AUTH` 自体の既定値は取得した資料に記載がなく未確認。

- [Phoenix configuration](https://arize.com/docs/phoenix/self-hosting/configuration)
- [Phoenix self-hosting](https://arize.com/docs/phoenix/self-hosting)

## 7. 実装例：自前のサーバー上の Phoenix コンテナと PostgreSQL

| 機能 | 具体的な担い手 |
| --- | --- |
| LLM アプリ・計装 | OpenInference 計装を組み込んだアプリ |
| コレクター・画面・認証・評価・実験・プロンプト | Phoenix サーバー（Docker Hub のコンテナ） |
| SQL データベース | PostgreSQL（14 以上） |
| LLM プロバイダー | 評価・Playground が呼ぶ外部のモデル |

利用者が自前のサーバーで Phoenix、PostgreSQL、OS を運用する構成。公式資料に基づく代表例であり、導入事例や動作検証済みの構成ではない。デプロイ手段には Docker、Compose、Helm、AWS CloudFormation、Railway・Render・Google Cloud Run・Azure のテンプレートも挙がる。公式のマネージド版は取得した資料で確認できず、実装例に含めていない。実運用の台数、TLS、バックアップ、版は未確認。
