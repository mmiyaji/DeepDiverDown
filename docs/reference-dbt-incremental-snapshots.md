# dbt：増分モデルとスナップショット

## 1. 対象

増分モデル（`materialized='incremental'`）が前回以降の行だけを既存表へ取り込む流れと、snapshot が変更を検出して履歴行を持つ流れを扱う。どちらも dbt が組み立てた SQL をウェアハウスが実行する。差分の判定、行の比較、書き込みは dbt のプロセスではなくウェアハウスの処理である。

## 2. 増分モデルの設定

モデルは SELECT 文に `{% if is_incremental() %}` の分岐を持ち、差分の条件（例：更新日時が既存表の最大値より新しい行）を書く。主な設定は次のとおり。

- `unique_key`：既存行と突き合わせる列。指定すると、一致した行を更新または置換する。
- `incremental_strategy`：`append`、`merge`、`delete+insert`、`insert_overwrite` などの戦略。使える戦略と既定値はアダプターで異なる。

## 3. 増分モデルの実行

`is_incremental()` は、対象の表が既にあり、モデルが incremental で、`--full-refresh` を指定していないときに真になる。初回や `--full-refresh` では分岐を除いた全件の SELECT で表を作る。2 回目以降は差分用の分岐を含む SELECT を、戦略に合う文（例：`MERGE`、または `DELETE` と `INSERT`）で包んで送る。ウェアハウスが上流の行を読み、`unique_key` で既存行と照合して書き込む。`unique_key` を指定しない場合の戦略（append など）では、重複行を取り除く処理は含まれない。

## 4. snapshot の定義

snapshot は、変更される元の表の行を、時点ごとの版として別の表に残す。定義には `unique_key` と、変更検出の `strategy` を指定する。

| strategy | 変更の検出 |
| --- | --- |
| timestamp | `updated_at` の列が前回の版より新しい行を変更とみなす。 |
| check | `check_cols` に指定した列（`all` も指定できる）の値が前回の版と異なる行を変更とみなす。 |

## 5. snapshot の実行

`dbt snapshot` は、現在の元の表の行と snapshot の表の現在の版を比べる文を組み立てて送る。ウェアハウスが差分を判定し、変更のあった行の旧版の `dbt_valid_to` を埋めて閉じ、新しい版を追加する。snapshot の表には `dbt_valid_from`、`dbt_valid_to` などのメタデータ列が付く。現在の版は `dbt_valid_to` が空である。元の表から削除された行の扱いは設定とバージョンに依存し、未確認である。

## 6. シナリオ

増分モデルは、既存表があるときに差分の分岐を使い、戦略に合う文を 1 回送る。snapshot は、変更検出の文を送り、ウェアハウスが履歴を更新する。

## 7. 実装例：自前 CI の dbt Core と PostgreSQL

セルフホストの CI ランナーで dbt Core と dbt-postgres が増分モデルと snapshot の文を組み立て、別の自前サーバーの PostgreSQL へ送る。

| 機能 | 担い手 |
| --- | --- |
| 増分モデルの SQL、snapshot の定義 | Git から取得したプロジェクトのファイル |
| 増分用・snapshot 用 SQL の生成 | CI ランナー上の dbt Core と dbt-postgres |
| 差分の判定と書き込み | PostgreSQL サーバー |
| 上流の表、増分モデルの表、snapshot の表 | PostgreSQL のスキーマ |

CI の提供製品、ホストの設置先、バージョンと接続経路は固定していない。公式資料を組み合わせた例であり、動作は未検証。

## 8. 未確認

差分の行数、戦略ごとの実行時間、遅れて届く行の扱いは未確認である。PostgreSQL で使える戦略と既定値、削除行の扱いは、使う dbt とアダプターのバージョンの資料で確かめる必要がある。

## 公式資料

- [Incremental models](https://docs.getdbt.com/docs/build/incremental-models)
- [About incremental strategy](https://docs.getdbt.com/docs/build/incremental-strategy)
- [Snapshots](https://docs.getdbt.com/docs/build/snapshots)
- [Connect Postgres to dbt](https://docs.getdbt.com/docs/local/connect-data-platform/postgres-setup)
