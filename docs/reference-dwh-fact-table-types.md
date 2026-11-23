# DWH のファクトテーブル：トランザクション・定期・累積スナップショット

## 1. 一つの出荷工程を三つの粒度で見る

架空の倉庫 W1 で、注文 42 の明細 1 を受け付け、梱包して出荷する。分割出荷と取消はなく、時刻はすべて JST。営業日はこの例では暦日で、日末に締める。日時、件数、経過時間は説明用で、実環境のデータは使っていない。

粒度は「1 行が業務上何を表すか」という定義。明細の工程イベント、倉庫の営業日、受注から出荷までの明細という三つの問いから、それぞれに対応するファクトを作る。

## 2. トランザクションファクトは工程ごとに追記する

粒度は、注文の 1 明細に発生した 1 工程イベント。注文番号と明細番号だけで識別すると同じ明細の工程を区別できないため、この例ではイベント ID を持つ。日時や工程のディメンションキーを付け、明細の個数をその工程で測った数量として記録する。この例では同じ 3 個が受注、梱包、出荷を順に通る。次の三つのイベントで 3 行作られる。

| イベント | 明細 | 工程 | 日時（JST） | 工程の数量 |
| --- | --- | --- | --- | ---: |
| E1 | 42-1 | 受注受付 | 2026-11-18 09:00 | 3 |
| E2 | 42-1 | 梱包完了 | 2026-11-18 14:30 | 3 |
| E3 | 42-1 | 出荷 | 2026-11-20 10:00 | 3 |

11 月 19 日は測定した工程がないので、新しいイベント行は発生しない。出荷した個数は、出荷イベントの数量を集計する。この例で日次スナップショットが数える明細件数とは数える対象が異なる。

## 3. 定期スナップショットは倉庫の営業日ごとに記録する

粒度は 1 倉庫・1 営業日。別々に定義した二つの尺度を持つ。出荷数は当日の出荷明細数であり、日末の未出荷は締め時点で未出荷の明細数。

| 営業日 | 倉庫 | 当日の出荷 | 日末の未出荷 |
| --- | --- | ---: | ---: |
| 2026-11-18 | W1 | 0 | 1 |
| 2026-11-19 | W1 | 0 | 1 |
| 2026-11-20 | W1 | 1 | 0 |

11 月 19 日にも W1 の行を入れ、出荷がなかった日とデータ欠落を区別する。期間中の出荷は 1 件。期間末の未出荷は最終日の 0 件。日末未出荷を 3 日分足すと同じ明細を重複して数えるため、残高を求めるときは報告時点を指定する。

## 4. 累積スナップショットは同じ明細行を更新する

粒度は出荷工程を通る 1 注文明細。受注受付で初期行を作り、梱包完了と出荷で同じ行を更新する。各工程の日付を日付ディメンションへの外部キーとして扱い、必要なら別に正確なタイムスタンプも持つ。工程未到達は適切な未到達キーやタイムスタンプの空値で表現する。

| 更新直後 | 受注日時 | 梱包日時 | 出荷日時 |
| --- | --- | --- | --- |
| 受注受付 | 11/18 09:00 | 未到達 | 未到達 |
| 梱包完了 | 11/18 09:00 | 11/18 14:30 | 未到達 |
| 出荷 | 11/18 09:00 | 11/18 14:30 | 11/20 10:00 |

上の表は同じ行の変化を示す説明図。最終状態のテーブルに残る明細行は 1 行で、受注から出荷までの経過時間は 49 時間。工程の再実施や特定日の過去の状態を追う用途には、個々のイベントや日次スナップショットも使う。

## 5. 問いからテーブルを選ぶ

| 問い | 粒度 | テーブル |
| --- | --- | --- |
| 梱包は何時に完了したか | 注文明細 × 工程イベント | トランザクション |
| 当日の出荷と日末の未出荷は何件か | 倉庫 × 営業日 | 定期スナップショット |
| 受注から出荷まで何時間かかったか | 注文明細 | 累積スナップショット |

同じ明細を複数のテーブルで表す場合、行を直接結合する前に粒度を確認する。この例では 3 行のイベントを明細行と結合すると明細側の経過時間が 3 回現れる。分析に必要な粒度で個別に集計してから結果を照合する。

## 6. 数値尺度のないファクト

ファクトレスファクトは、数量や所要時間がなくても業務上の関係や発生を記録する。たとえば注文の明細に対する検品を、明細・検品担当者・日付の外部キーで 1 行として記録できる。行を数えれば検品の件数が分かる。これは行に数値の測定値を持つかどうかという性質で、イベント、期間、工程全体という粒度の分類と区別する。

## 7. 公式資料

- [Kimball Group Transaction Fact Tables](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/transaction-fact-table/)
- [Kimball Group Periodic Snapshot Fact Tables](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/periodic-snapshot-fact-table/)
- [Kimball Group Accumulating Snapshot Fact Tables](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/accumulating-snapshot-fact-table/)
- [Kimball Group Factless Fact Tables](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/factless-fact-table/)
- [Kimball Group Additive, Semi-Additive, and Non-Additive Facts](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/additive-semi-additive-non-additive-fact/)

## 8. 実装例 BigQuery の出荷工程ファクト

出荷の工程イベントから、異なる粒度でトランザクション・日次・進捗・発生有無の表を作る実装例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 出荷工程のイベント | landing.shipping_events | 発生時刻と一意なイベント識別子を保持する。 |
| イベント取り込み | BigQuery の増分ロード SQL | 一意なイベントを追記し、工程が進んだ注文を特定する。 |
| 倉庫別の日次締め | 同じ GoogleSQL スクリプトの日次締め処理 | 倉庫と営業日の組ごとに出荷数と残数を計算する。 |
| 分析者 | 集計・工程分析用 SQL ビュー | 指標に対応する粒度の表をクエリする。 |
| トランザクションファクト | warehouse.fact_shipping_event | 発生日で区切る 1 工程イベントごとの表。 |
| 定期スナップショット | warehouse.fact_warehouse_day | 1 倉庫・営業日ごとに出荷数と残数を保持する。 |
| 累積スナップショット | warehouse.fact_order_line_progress | 1 受注明細の工程時刻を MERGE 相当の DML で更新する。 |
| 数値尺度のないファクト | warehouse.fact_coverage | 実施した明細と工程のキーの組み合わせを保持する。 |

出荷量は日別で加算できる。日末の未出荷残を日付方向に足すと期間末の残数にならないため、その指標は日次表の時点を指定して読む。

出荷システムが出力した CSV は Cloud Storage に置き、同じロケーションの BigQuery ロードジョブで `landing.shipping_events` に取り込む。BigQuery Data Transfer Service のスケジュールされたクエリを専用のサービスアカウントで起動する。GoogleSQL のスクリプトは、処理対象のロード済みバッチを読み、イベント ID を重複排除してトランザクション・進捗・発生有無の表を更新した後、倉庫と営業日のカレンダーを使って日次締めを行う。

営業日の境界は倉庫のタイムゾーンで求め、スケジュールの起動時刻と区別する。後着イベントは影響する営業日を指定して日次表を再計算する。分析者は BigQuery Studio から各粒度のビューを問い、運用者はジョブ履歴と対象営業日を照合する。

- [Cloud Storage からの CSV ロード](https://docs.cloud.google.com/bigquery/docs/loading-data-cloud-storage-csv)
- [BigQuery のスケジュールされたクエリ](https://docs.cloud.google.com/bigquery/docs/scheduling-queries)
- [BigQuery の JOBS ビュー](https://docs.cloud.google.com/bigquery/docs/information-schema-jobs)

出典 [Kimball Group Transaction Fact Tables](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/transaction-fact-table/)、[Kimball Group Periodic Snapshot Fact Tables](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/periodic-snapshot-fact-table/)、[Kimball Group Accumulating Snapshot Fact Tables](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/accumulating-snapshot-fact-table/)、[Kimball Group Factless Fact Tables](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/factless-fact-table/)、[Kimball Group Additive, Semi-Additive, and Non-Additive Facts](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/additive-semi-additive-non-additive-fact/)、[BigQuery パーティション表](https://docs.cloud.google.com/bigquery/docs/creating-partitioned-tables)、[BigQuery スケジュールされたクエリ](https://docs.cloud.google.com/bigquery/docs/scheduling-queries)、[BigQuery DML](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/dml-syntax)

BigQuery と Cloud Storage の基盤は Google が運用し、利用者はデータ、GoogleSQL、スケジュール、サービスアカウントと権限を設定する。各ファクトとビューは論理データであり個別サービスではない。内部の計算ノードを直接操作しない。資料を組み合わせた例で、ロード・日次締めと SQL の結果は実動作未検証。[BigQuery overview](https://docs.cloud.google.com/bigquery/docs/introduction)
