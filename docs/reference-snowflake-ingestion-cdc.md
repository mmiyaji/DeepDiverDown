# Snowflake の取り込みと増分処理

## 1. 用途と構成

注文イベントを RAW_ORDERS に集約し、更新を反映した注文テーブルと分析用テーブルへ流す。上流の取り込み方式と、下流で変換を起動する方式は独立に選べる。

## 2. ファイルのロード

外部ステージに到着したファイルをクラウドのイベント通知で検知する構成では、Snowpipe が定義済みの COPY INTO でロードする。ファイルが単位なので、バックフィルや日付単位の受け渡しにも使える。

## 3. 行ストリーム

Snowpipe Streaming の高性能アーキテクチャでは、クライアントがチャネルからパイプを通して対象テーブルへ行を送る。コミットされたオフセットトークンと送信元側の進捗を対応付け、再開位置を管理する。

## 4. Streams と Tasks

Stream はテーブルの変更に対する読み取り位置を管理する。Task が Stream の差分を DML で消費し、MERGE などの更新をコミットすると位置が進む。Stream の内容を SELECT して確認しただけでは位置は進まない。

## 5. Dynamic Tables

SELECT を定義し、ベーステーブルに対する目標遅延を設定する。Snowflake が依存関係を追い、サポートされる計画では増分リフレッシュを選べる。目標遅延は目標値であり、処理が長い場合は超過しうる。タスクの副作用・厳密な起動順・細かい MERGE 制御が要る場合は Streams／Tasks と比較する。

## 図で確認するシナリオ

- **ファイルを取り込んで現在状態を更新** — 日次ファイルの到着通知を受け、Snowpipe が RAW にロードする。 → Task が未消費の Stream の差分を読む。 → MERGE をコミットし、現在状態と Stream の消費位置を進める。
- **連続取り込みから定義済み集計へ** — 送信元はチャネルに注文イベントを行単位で送る。 → RAW へのコミットと送信元の再開位置を対応付ける。 → 依存テーブルをもとに目標遅延を意識して集計を更新する。 → BI は直近のリフレッシュ結果を参照する。

## 公式資料

- [Snowpipe](https://docs.snowflake.com/en/user-guide/data-load-snowpipe-intro)
- [Snowpipe Streaming](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/data-load-snowpipe-streaming-overview)
- [Streams and Tasks](https://docs.snowflake.com/en/user-guide/data-pipelines-intro)
- [Dynamic Tables の選択ガイド](https://docs.snowflake.com/en/user-guide/dynamic-tables/decision-guide)

## 6. 実装例 Snowflake のファイルと行ストリーム取込

外部ステージ経由のファイル取込と SDK による行取込を、別々の入力経路として使う例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 到着した注文ファイル | Amazon S3 注文ファイル | 注文ファイルを S3 バケットに置く。 |
| 実装で追加 | Snowflake 外部ステージ | Snowflake 側に S3 バケットを参照するステージを定義する。 |
| 通知駆動のファイル取込 | Snowpipe AUTO_INGEST | S3 オブジェクト通知を受けて COPY を行う。 |
| 注文イベント送信元 | 注文イベント送信アプリ | Snowpipe Streaming SDK でイベントを送る。 |
| 連続行取込 | Snowpipe Streaming のチャネル | 行をチャネルで取り込み、SDK の進捗管理を行う。 |
| 注文変更の受入表・未処理変更と読取位置 | RAW_ORDERS と Stream | 同じ Snowflake スキーマで受入表と未消費の変更範囲を管理する。 |
| 変更適用ジョブ | Task の MERGE | 注文キーとソース順序を使って、対象表に変更を反映する。 |
| 注文の現在状態表 | ORDERS_CURRENT | 検証済みの受注の現在状態を持つ。 |
| 鮮度目標付き注文集計 | 日別集計 Dynamic Table | 目標遅延を設定してクエリ結果を更新する。 |
| BI | BI 用 SQL クライアント | 注文日別の集計を利用する。 |

2 経路は用途で選び、同じイベントが両方に入るなら変更適用時に一意に処理する。Dynamic Table の目標遅延は更新計画の指標で、個々の変更がその時間内に反映される保証とはならない。

出典 [Snowpipe](https://docs.snowflake.com/en/user-guide/data-load-snowpipe-intro)、[Snowpipe Streaming](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/data-load-snowpipe-streaming-overview)、[Streams and Tasks](https://docs.snowflake.com/en/user-guide/data-pipelines-intro)、[Dynamic Tables の選択ガイド](https://docs.snowflake.com/en/user-guide/dynamic-tables/decision-guide)、[Snowpipe の S3 自動取込](https://docs.snowflake.com/en/user-guide/data-load-snowpipe-auto-s3)
