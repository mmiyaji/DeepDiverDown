# OSS の新しいデータ・AI 技術の違い

ここでは LLM アプリの可観測性を比べる（同じ分類の他の図は表に入れない）。

| 観点 | Langfuse | Arize Phoenix |
| --- | --- | --- |
| 特徴 | LLM アプリの **トレース・評価・プロンプト管理** を扱う可観測性基盤 | **OpenTelemetry/OpenInference 計装** でトレースを集め、評価・実験・プロンプト管理までを 1 つの Web アプリで提供する |
| データモデル・実行モデル | SDK や OpenTelemetry のイベントを Web が受け、Worker が非同期に処理する。トレース・観測・スコアは列指向で保持する | プロジェクト・トレース・スパン・データセット・実験を SQL に保存する。1 サーバープロセスがコレクター、画面、評価、実験、プロンプト管理を担う |
| 一貫性・耐久性の仕組み | Web が S3 にイベントを保存し、Redis のキューへ参照を登録する。Worker が S3 から読んで ClickHouse へ書く | SQLite（既定）か PostgreSQL 14 以上。保持期間は既定で無期限 |
| 拡張のしかた | SDK、OpenTelemetry、API で記録を送る | 同じ PostgreSQL に複数インスタンスをロードバランサーの後ろに置く。1 インスタンス 1 テナント。大量取り込みは別製品 Arize AX に案内されている |
| 運用の形態 | 自己ホスト（Web、Worker、ClickHouse、PostgreSQL、Redis / Valkey、S3 互換ストレージ）。AWS の EKS / Fargate 構成例もある | Docker・Helm・CloudFormation などで自前運用。1 コンテナで 6006 番（画面・OTLP HTTP）と 4317 番（OTLP gRPC） |
| 得意な用途 | AI アプリのトレース調査と評価 | LLM アプリのトレース調査、LLM による評価、データセットを使った実験、プロンプトの版管理 |
| 注意点 | 構成部品が多い。ClickHouse と Langfuse の更新・復旧・監視は運用者の責任 | 認証の既定値と取り込み内部の保証は未確認。初期管理者パスワードの既定は admin |
| ライセンス | コアは MIT。一部のガバナンス機能は商用ライセンス | Elastic License 2.0（OSI のオープンソースではない） |

内容は 2026 年 11 月時点の公式資料に基づく。確認できなかった点は「未確認」と書く。

## 選び方

- Web と Worker を分けて非同期に処理し、列指向でトレースを保持する → **Langfuse**
- ClickHouse などを含む自己ホスト構成を運用できる → **Langfuse**
- 1 つの Web アプリで、トレースから実験・プロンプト管理までそろえる → **Arize Phoenix**
- SQLite か PostgreSQL だけで、小さく始める → **Arize Phoenix**

## 公式資料

- [Langfuse architecture](https://langfuse.com/handbook/product-engineering/architecture)
- [Langfuse Self-hosting infrastructure](https://langfuse.com/self-hosting/configuration/scaling)
- [Phoenix (GitHub)](https://github.com/Arize-ai/phoenix)
- [Phoenix self-hosting](https://arize.com/docs/phoenix/self-hosting)
