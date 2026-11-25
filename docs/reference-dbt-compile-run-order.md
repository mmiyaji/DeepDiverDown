# dbt：解析・コンパイルと実行順序

## 1. 対象

dbt Core が `dbt run` でプロジェクトを解析し、依存順にモデルを SQL へコンパイルして、ウェアハウスへ送るまでを扱う。dbt は SQL を生成して送る側で、行の読み書きや結合、集計はウェアハウスが実行する。dbt のプロセスはデータの本体を処理しない。

## 2. 解析と manifest

dbt はモデルの SQL、YAML の source・テスト・設定を読み、Jinja の `ref()` と `source()` から参照関係を集める。結果は `target/manifest.json` に、ノードと依存関係を含む成果物として書き出される。ref はモデル同士、source は dbt の外でロードされた表への参照である。

## 3. 実行順

manifest の参照から有向グラフ（DAG）を作り、選択したノードを依存順に並べる。依存が済んだモデルは `threads` の数まで並行して実行する。あるモデルが失敗すると、それに依存する下流のモデルは実行されない。

## 4. materialization ごとの SQL

コンパイルでは Jinja を展開し、`ref` を実際のスキーマ付きの名前に置き換える。モデルの SQL は SELECT 文であり、materialization がそれを包む文を決める。

| materialization | dbt が送る文（概要） |
| --- | --- |
| view | SELECT を持つ `CREATE VIEW` を作成または置換する。 |
| table | SELECT の結果で表を作成して置き換える。 |

具体的な DDL の形（一時表を経由する置き換え方など）はアダプターで異なる。incremental と snapshot は別の図で扱う。

## 5. ウェアハウス側の処理

アダプターが接続を開き、組み立てた文を送る。ウェアハウスが上流の表を読み、結合や集計を実行し、view や table を作る。dbt に戻るのは成功・失敗、影響行数などの実行結果である。`dbt compile` はコンパイルまでを行い、ウェアハウスへモデルの作成文を送らない。

## 6. シナリオ

`dbt run` は解析、グラフ作成、実行順の決定、モデルごとのコンパイルと送信、結果の受け取りの順に進む。

## 7. 実装例：自前 CI の dbt Core と PostgreSQL

運用者がセルフホストの CI ランナーに dbt Core と dbt-postgres を入れ、`profiles.yml` で PostgreSQL への接続先を指定する。Git から取得したプロジェクトを解析し、manifest をランナーの `target` に書き出す。PostgreSQL サーバーは別の自前サーバーで、送られた SQL を実行する。

| 機能 | 担い手 |
| --- | --- |
| モデル SQL と YAML | Git から取得したプロジェクト |
| 解析、依存グラフ、実行順、コンパイル | CI ランナー上の dbt Core |
| manifest.json | ランナー上の target ディレクトリ |
| アダプターと接続 | dbt-postgres |
| ウェアハウスの SQL 実行 | PostgreSQL サーバー |
| source と上流モデルの表、view・table のモデル | PostgreSQL のスキーマ |

CI の提供製品、ホストの設置先、バージョンと接続経路は固定していない。公式資料を組み合わせた例であり、動作は未検証。

## 8. 未確認

実環境の実行時間、`threads` の効果、ウェアハウス側の負荷とコストは未確認である。materialization ごとの具体的な DDL はアダプターごとに異なり、PostgreSQL での実際の文は確かめていない。

## 公式資料

- [About dbt compile command](https://docs.getdbt.com/reference/commands/compile)
- [Manifest JSON file](https://docs.getdbt.com/reference/artifacts/manifest-json)
- [Materializations](https://docs.getdbt.com/docs/build/materializations)
- [ref function](https://docs.getdbt.com/reference/dbt-jinja-functions/ref)
- [Connect Postgres to dbt](https://docs.getdbt.com/docs/local/connect-data-platform/postgres-setup)
