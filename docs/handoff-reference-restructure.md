# 引き継ぎ：リファレンスの作り直し（feature/design-tune）

最初にこの文書、[整理の型](reference-structure.md)、[モデル作成ルール](../AGENTS.md) を読む。ルールの本体は reference-structure.md にあり、ここには決定の経緯と作業の約束だけを書く。

## ブランチと公開

- 作業ブランチは `feature/design-tune`（origin/main の c3b7b7b を起点とする作業）。既定ブランチへ直接コミットしない。push・マージ・公開はユーザーの許可を得てから。
- コミットの種類は add / update / fix / refactor。Co-Authored-By は付けない。日本語で簡潔に答える。
- 確認用サーバー：`python -m http.server 8131 --bind 0.0.0.0`（D:\git\DeepDiverDown）。URL は http://192.168.11.34:8131/index.html 。ユーザーは iPad の Chrome でも見る（Safari と同じエンジン。CSS の新機能は効かないことがある）。

## 決まったこと（画面）

- ヘッダーは「一覧 ▾」と「⋯」メニューだけ。1279px 以下は一覧・詳細を引き出しにし、図の上に浮かぶボタン（一覧・全画面・詳細）で出し入れする。図の見出しとツールバーは 1 段。
- サイドバーは左端に分野のアイコン列、右に「分類 → 製品 → 図」のツリー。製品の中は「概要」と、学ぶ順序の番号（registry の `step`）。製品に当たらない図は「仕組みとパターン」。
- 分類名を押すと分類ページ（`#/c/分野/分類`）：説明文、製品カード（縮小図・概要 2 行・図の数）、「違い」の比較表。ヘッダーの題名も分類名になる。
- 製品は、図のある分類すべてに出る（`also` で追加も可、同じ分野のみ）。
- データ基盤は 5 分野（データ処理・データ保存・分析基盤・DWH・メタデータ・ガバナンス・AI・新技術）に分けた。

## 作り直しの進み具合

| 分類 | 状態 |
| --- | --- |
| バッチ・SQL エンジン | Spark・Trino・DuckDB・ClickHouse の図と比較表を点検。`docs/category-batch-sql.md` |
| ストリーム処理 | Kafka・Flink・RisingWave・Apicurio Registry・Spark の図と比較表を点検。`docs/category-stream.md` |
| 取り込み | Debezium・Airbyte・Fivetran・PostgreSQL の概要と詳細図を整理。比較表は `docs/category-ingestion.md` |
| 変換とオーケストレーション | dbt・Apache Airflow・AWS Glue・Azure Data Factory・Google Cloud Dataflow の概要と仕組み図（各 2 つ）を整理。比較表は `docs/category-transform.md` |
| テーブル形式とカタログ | Apache Iceberg・Delta Lake・Apache Hudi・Apache Paimon（各 3 図）と Iceberg REST Catalog の概要図を整理。比較表は `docs/category-table-catalog.md` |
| ファイル形式 | Parquet・ORC・Avro・Arrow IPC・Vortex・Lance の概要図（Vortex・Lance・Arrow IPC は仕組み図も）。比較表は `docs/category-file-formats.md`。ファイル形式は 1 ファイルの中身、テーブル形式は複数ファイルの管理で分ける |
| クラウド分析基盤 | Snowflake・Databricks（概要＋仕組み各 5〜7 図に統合）、BigQuery・Amazon Redshift・Microsoft Fabric（概要＋仕組み各 3 図）を整理。比較表は `docs/category-cloud-analytics.md`。Athena・Dremio・Starburst・MotherDuck・Oracle・Teradata・Synapse は比較表の注記のみ |
| ほかの分類 | 未着手の図がある。古い図は `js/products.js` で製品を推定している |

バッチ・SQL とストリーム処理の対象はデスクトップの 2D・3D を確認した。3D の初期表示では重なりを避けるため一部ラベルが非表示になる。物理 iPad の Safari と、すべてのカメラ角度は未確認。取り込み分類は追加図の 2D・3D と選択を確認し、変更したモデルの提供元境界点検を通過した。モデル点検には台数未記載の警告が残る。

## 作業の約束（トークンを節約する）

- 必要に応じて作業を分担し、変更箇所の重複を避ける。
- 1 製品あたり概要 1 つ＋仕組み 2〜3 つまで。
- エージェントの作業用ファイルは `scratchpad/<製品名>/` に分け、共有フォルダで上書きし合わない。
- 複数人で作業する場合は registry や共通コードの編集担当を決め、最後に `node tools/build-index.mjs` を実行する。
- 完了条件：`node tools/gates.mjs <id>`（台数の警告以外は合格）、`node tools/audit-provider-boundaries.mjs <id>`（問題なし）、`npm test`（全件合格）、分類ページで確認。
- 比較表は取りまとめ役が書き、`js/categories.js` の `CATEGORY_DOCS` に登録する。書き方は reference-structure.md の「比較表」と「文章の書き方」に従う（特徴の行、太字は違いの語だけ、AI っぽい文を避ける）。
- ファイル編集は CRLF に注意。node スクリプトで編集するときは `\r\n` を考慮し、正規表現の `\` がシェルで消えないよう、スクリプトは Write で作ってから実行する。
