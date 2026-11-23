# Snowflake のクラウドデータ基盤アーキテクチャ

## 1. 範囲
Snowflake のストレージ、仮想ウェアハウス、クラウドサービスを分離し、取り込みとBIクエリを別計算資源で実行する例を示す。

出典 [Snowflake key concepts and architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts)

## 2. ストレージ
永続データはクラウドストレージに保持され、仮想ウェアハウスの計算資源とは独立してスケールする。

## 3. 仮想ウェアハウス
仮想ウェアハウスは SQL のロードやクエリを実行する計算クラスターである。複数ウェアハウスを用途別に使える。

## 4. クラウドサービス
認証、メタデータ、最適化、調整などのサービス層が利用要求を調整する。基盤の管理や更新はSnowflakeが担う。

出典 [Snowflake key concepts and architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts)

## 5. シナリオ
ロードと分析を用途別の仮想ウェアハウスに分離する。AWS・Azure・Google Cloud の構成、エディション、権限などは要件ごとに確認する。詳細図では用途別の処理を比較できる。

| 図の部品 | 詳細リファレンス | 観察するもの |
|---|---|---|
| Load warehouse | [取り込みと増分処理](reference-snowflake-ingestion-cdc.md) | Snowpipe、Snowpipe Streaming、Streams／Tasks、Dynamic Tables |
| BI warehouse | [クエリ性能とウェアハウス](reference-snowflake-query-performance.md) | 同時実行、マイクロパーティション、結果の再利用 |
| Horizon Catalog | [分類・保護・監査](reference-snowflake-horizon-catalog.md) | 分類、タグとマスキング、アクセス履歴、リネージ |
| Cloud storage | [Time Travel とクローン](reference-snowflake-time-travel.md) | 履歴、誤更新の復旧、Fail-safe の境界 |
| Secure Data Sharing | [共有の公開と失効](reference-snowflake-secure-sharing.md) | 提供側のビュー、受領側の利用、失効 |

## 6. 参考資料
- [Snowflake key concepts and architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts)

## 7. 社内の利用とアカウント間共有

Horizon Catalog の機能で社内利用者に対する分類やマスキングを検討し、外部に提供する集合は共有用ビューで明示する。同一リージョンの直接共有の例では、受領側が Share から読み取り専用データベースを作り、共有対象を自分の計算資源で参照する。 [Horizon Catalog](https://docs.snowflake.com/en/user-guide/snowflake-horizon) · [Secure Data Sharing](https://docs.snowflake.com/en/user-guide/data-sharing-intro)

## 8. 実装例 Snowflake と Amazon S3

注文ファイルを Amazon S3 に置き、Snowflake の別々の仮想ウェアハウスで取込と BI を実行する例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| Source | Amazon S3 注文ファイル | CSV を入力バケットに着地させる。 |
| 認証・メタデータ調整・データカタログと統制 | Snowflake Cloud Services と Horizon Catalog | 認証・調整と資産調査の入口を同じ Snowflake アカウントに置く。 |
| バッチ取込用の計算資源 | LOAD_WH | 仮想ウェアハウスで COPY INTO を実行する。 |
| 永続テーブル保存 | Snowflake ORDERS テーブル | 注文を内部管理テーブルに格納する。 |
| BI 用の SQL 計算資源 | BI_WH | BI クエリに別の仮想ウェアハウスを使う。 |
| BI users | BI クライアント | BI_WH を指定して SQL を実行する。 |
| 読み取り専用データ共有 | Snowflake Direct Share | 許可した公開ビューを共有オブジェクトとして指定する。 |
| データ受領者 | 同一リージョンの受領アカウント | 共有から読み取り専用データベースを作る。 |

外部ステージには S3 の許可パスを指定する。`LOAD_WH` と `BI_WH` は同じテーブルデータを使える。取込と BI の処理能力は別々に設定し、受領側クエリの計算資源は受領側が手配する。

出典 [Snowflake key concepts and architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts)、[Secure Data Sharing](https://docs.snowflake.com/en/user-guide/data-sharing-intro)、[Snowflake S3 ストレージ統合](https://docs.snowflake.com/en/user-guide/data-load-s3-config-storage-integration)
