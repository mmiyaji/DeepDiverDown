# Langfuse による AI アプリの可観測性

## 1. 対象

LLM とエージェントの実行記録を収集し、保存・評価・調査する。

## 2. 機能配置と処理

アプリはモデル呼び出しやツール利用の記録を送信する。Web が受け取り、非同期 worker が処理し、観測データと設定等をそれぞれ保存する。運用者は画面で調査と評価を行う。

## 3. 設計上の注意

入力・出力に機微情報が含まれ得る。データ保存期間、権限、記録量、個別のストレージの障害とアップグレードを確認する。

## 4. 実装例

Langfuse の自己ホスト構成。Web と Worker、ClickHouse、PostgreSQL、Redis / Valkey と S3 互換の blob ストレージを組み合わせる。配置先のクラウドは固定しない。

| 機能 | 担い手 |
|---|---|
| AI アプリ | 計装した AI アプリ |
| 記録の受付・画面 | Langfuse Web |
| 非同期処理 | Langfuse Worker |
| 観測データ | ClickHouse |
| 運用・評価担当者 | 運用・評価担当者 |
| 処理待ち | Redis / Valkey |
| 設定と管理データ | PostgreSQL |
| イベントと添付の保管 | S3 互換 blob ストレージ |

[Langfuse architecture](https://langfuse.com/handbook/product-engineering/architecture)、[Self-hosting infrastructure](https://langfuse.com/self-hosting/configuration/scaling)。
