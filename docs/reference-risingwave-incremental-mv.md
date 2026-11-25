# RisingWave：マテリアライズドビューの増分更新

docs.risingwave.com の公式ドキュメントを基準に、`CREATE MATERIALIZED VIEW` が Actor になり、入力の変化に応じて結果を更新し続ける流れを追う。前提は「RisingWave の基本アーキテクチャ」（Frontend・Meta・Compute の役割）。

## 1. 対象と前提

- 対象は、マテリアライズドビューの作成から、バックフィル、増分更新、時間による状態の整理まで。
- Hummock への保存とコンパクションは次の図、Barrier と復旧はその次の図で扱う。
- 資料はビューの内部の差分表現を詳述していない。本書は資料にある範囲だけを書く。

## 2. マテリアライズドビューと状態の置き場所

- マテリアライズドビューは、ビュー式の結果を保存したもの。関連するイベントが届くと RisingWave が更新し、問い合わせは事前計算された結果を返す。
- 資料は「上流のデータが変わると、影響を受ける結果だけを再計算する」と説明する。`REFRESH MATERIALIZED VIEW` は存在しない。
- Source はデータを持たない。Table とマテリアライズドビューは RisingWave 内に保存され、問い合わせられる。Sink はデータを持たず、外部へ配信する。
- `CREATE SOURCE` は結合・集約・ウィンドウなど状態を持つ演算に制限があり（upsert Source では使えない）、Table では完全に使える。

## 3. 計画・Fragment・Actor

- Frontend が問い合わせを計画し、フラグメント化した計画を Meta へ渡す。Meta が Actor を Streaming Node に割り当てる。
- **Fragment**：ストリーミング計画の一部。SQL の演算子の連なりで、並列の Actor が実行する。`ALTER FRAGMENT` で並列度を調整できる。
- **Actor**：計算を分散するための軽量スレッド。複数の CPU コアで同時に動く。
- ビューや Table、Sink には並列度を設定できる。

## 4. バックフィル

- `CREATE MATERIALIZED VIEW` は、まず参照先から履歴のデータをバックフィルし、その後に増分処理へ進む。かかる時間はデータ量による。
- スナップショットバックフィルが既定で有効で、バックフィルの段階とストリーム処理が資源を奪い合わないようにする。`SET streaming_use_snapshot_backfill=false;` で無効にできる。
- 文はバックフィルが終わるまで返らない。`SET BACKGROUND_DDL=true;` でバックグラウンドにできる。

## 5. 演算子の状態と読み取り

- ハッシュ集約・結合の状態はメモリにキャッシュとして置き、キャッシュにないものは Hummock から読む。
- ハッシュ集約は点参照（Get）、ハッシュ結合は範囲走査（Iter）を使う。削除印や古い版が滞留すると Iter が影響を受ける（次の図で扱う）。
- 資料はマテリアライズドビューを別のビューの上に重ねる場合の挙動を明記していない（未確認）。

## 6. 時間による状態の整理

- **Watermark**：観測した最大のイベント時刻の推定。`WATERMARK FOR 列 AS 式` で指定する。Watermark より前のイベントは遅延として扱い、そのウィンドウでは処理しない。ウィンドウは Watermark がウィンドウの終端に達するまで結果を出さない（`EMIT ON WINDOW CLOSE`）。
- **`WITH TTL`**：Watermark 以前の行を期限切れとして Table の状態を整理する。下流のビューにすでに計算された結果は消えない。
- **Temporal Filter**：`NOW()` を含む WHERE・HAVING の条件。範囲外の行は保存から削除され、下流へリトラクションが送られる。`DATE_TRUNC` の段階的な境界は、期限切れが一度に起き負荷が急増しやすい。連続した範囲（`NOW() - INTERVAL '1 hour'`）なら分散できる。

## 7. 実装例：AWS の EKS・S3

「RisingWave の基本アーキテクチャ」と同じ AWS 構成。Frontend Pod が計画し、Meta Pod が Actor を割り当て、Compute Pod がバックフィル・Actor・時間による状態の整理を実行する。状態と Table・ビューの行は S3 の Hummock に置く。

| 機能 | 担い手 |
| --- | --- |
| SQL クライアント | psql など |
| 計画とフラグメント化 | Frontend Pod |
| Actor の割り当て | Meta Pod |
| バックフィル・Actor・Watermark / Temporal Filter | Compute Pod |
| 演算子の状態・ビュー・上流の Table | Amazon S3 上の Hummock |
| メタデータ | RDS for PostgreSQL（実装で加わる部品） |

役割の分担と管理主体は基本アーキテクチャの実装例と同じ。上流の外部 Source は図に含めない。図は公式資料を組み合わせた代表例で実動作は未検証。バージョン互換性と IAM 権限の詳細は未確認。

## 公式資料

- [RisingWave · CREATE MATERIALIZED VIEW](https://docs.risingwave.com/sql/commands/sql-create-mv)
- [RisingWave · Key concepts](https://docs.risingwave.com/reference/key-concepts)
- [RisingWave · Architecture](https://docs.risingwave.com/get-started/architecture)
- [RisingWave · Source, Table, MV, and Sink](https://docs.risingwave.com/get-started/source-table-mv-sink)
- [RisingWave · CREATE SOURCE vs CREATE TABLE](https://docs.risingwave.com/ingestion/create-source-vs-create-table)
- [RisingWave · Watermarks](https://docs.risingwave.com/processing/watermarks)
- [RisingWave · Temporal filters](https://docs.risingwave.com/processing/sql/temporal-filters)
- [RisingWave · Specific bottlenecks](https://docs.risingwave.com/performance/specific-bottlenecks)
