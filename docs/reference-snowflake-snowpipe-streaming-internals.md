# Snowpipe Streaming：バッファからテーブルへの取り込み

## 1. 対象と前提

高性能アーキテクチャで受信、バッファ、サーバーレスジョブ、pre-clustering を追う。2025年の記事を基にした論理図。 公式資料を組み合わせた説明用のモデルで、実機の配置や導入事例ではない。

## 2. 構成と役割

- **イベント送信**：アプリケーションは SDK または REST から行を送信する。
- **認証と振り分け**：Ingress は認証した要求を受け、Assigner のルーティングに従って Buffering Tier に振り分ける。
- **負荷に応じた割当**：Assigner は Buffering Tier の負荷情報を基に割当を調整する。
- **一時バッファ**：Buffering Service は暗号化された行または blob 参照を保持し、負荷情報を提供する。
- **取り込み定義**：PIPE は対象テーブルと取り込み時の処理を指定する。
- **取り込みジョブ**：Snowpipe がサーバーレスのジョブをスケジュールし、チャネルのスループットに応じて処理を分担する。
- **取り込み時の配置**：設定した場合、ミニバッチを作り、クラスタリングキーに沿って書き込み前に配置を調整する。
- **分析対象の表**：Snowflake テーブルまたは Snowflake 管理 Iceberg テーブルへ書き込み、クエリ可能にする。
- **読み取り**：テーブルに反映されたデータを SQL で読み取る。

## 3. 処理の流れ

1. SDK または REST から行を受信して認証し、バッファに振り分ける。
2. 負荷を観測し、Assigner が振り分け先を調整する。
3. PIPE の定義に基づき、サーバーレスジョブがバッファから取得する。
4. 設定時は取り込み前に配置を調整して表へ反映し、SQL から読む。

2025 年の技術ブログでは SDK の Rust コアが Rowset Mode と File Mode の転送を使い分け、前者は Ingress で暗号化し、後者は内部ステージ上の blob と参照を利用する。Assigner はバッファの使用状況を受け取りルーティングを調整する。pre-clustering のミニバッチはチャネル名を使い、書き込み前の配置を整える。クラスタリングの設定と対応条件は現行ガイドを確認する。

## 4. 留意点

pre-clustering は任意であり、すべての取り込みが必ずこの経路を通るわけではない。行の受付確認、耐久化、テーブルでの可視化は別の段階。チャネル方式による保証の違いは現行ドキュメントを確認する。Buffering Tier の具体的な運用場所や耐久化方式は図で推測しない。

## 5. 実装例

アプリが SDK で送信し、Snowflake が公開した高性能取り込みアーキテクチャを介して管理 Iceberg テーブルに書き込み、SQL で読む。pre-clustering は対応する設定を有効にした場合の経路。公式記事と現行ガイドを組み合わせた概念例である。

| 機能 | 担い手 |
| --- | --- |
| イベント送信 | SDK / REST の送信元 |
| 認証と振り分け | Snowflake Ingress |
| 負荷に応じた割当 | Assigner |
| 一時バッファ | Buffering Tier |
| 取り込み定義 | Snowpipe の PIPE |
| 取り込みジョブ | Snowpipe serverless jobs |
| 取り込み時の配置 | pre-clustering（任意） |
| 分析対象の表 | Snowflake / 管理 Iceberg テーブル |
| 読み取り | SQL クエリ |

## 公式資料

- [次世代 Snowpipe Streaming の内部構造](https://www.snowflake.com/en/blog/engineering/next-gen-snowpipe-streaming-architecture/)
- [Snowpipe Streaming の現行仕様](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/data-load-snowpipe-streaming-overview)
- [Kafka から Iceberg へ](https://www.snowflake.com/en/blog/engineering/kafka-topics-iceberg-tables-snowflake/)
- [取り込み設計と性能](https://www.snowflake.com/en/blog/engineering/efficient-snowflake-ingestion-query-ready/)
