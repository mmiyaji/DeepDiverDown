# 引き継ぎ：リファレンスの作り直し（feature/design-tune）

最初にこの文書、[整理の型](reference-structure.md)、[モデル作成ルール](../AGENTS.md) を読む。ルールの本体は reference-structure.md にあり、ここには決定の経緯と作業の約束だけを書く。

## ブランチと公開

- 作業ブランチは `feature/design-tune`（Cloudflare 公開版 = origin/main の 961d156 から作成）。既定ブランチへ直接コミットしない。push・マージ・公開はユーザーの許可を得てから。
- コミットの種類は add / update / fix / refactor。Co-Authored-By は付けない。日本語で簡潔に答える。
- 改善案は番号付きで出し、ユーザーに選んでもらってから実装する。
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
| バッチ・SQL エンジン（Spark・Trino・DuckDB・ClickHouse） | 済。比較表 docs/category-batch-sql.md |
| ストリーム処理（Kafka・Flink・RisingWave・Apicurio Registry、Spark の streaming 3 つ） | 済。比較表 docs/category-stream.md |
| ほかの分類 | 未着手。古い図は推定（js/products.js）で製品に振り分けて表示している |

未確認のまま残っている点：新しい図の 2D・3D の配置と見た目（画面の撮影ができず確認していない）。ユーザーに見てもらうか、Browser の操作で確認する。

## 作業の約束（トークンを節約する）

- 取りまとめ役は Sonnet。調査・作図は Sonnet のエージェント、枠の追加のような機械的修正は Haiku。1 エージェント 1 製品。
- 1 製品あたり概要 1 つ＋仕組み 2〜3 つまで。
- エージェントの作業用ファイルは `scratchpad/<製品名>/` に分け、共有フォルダで上書きし合わない。
- エージェントには registry.json・js/・css/・tests/ を触らせない。登録内容は JSON で受け取り、取りまとめ役が反映して `node tools/build-index.mjs`。
- 完了条件：`node tools/gates.mjs <id>`（台数の警告以外は合格）、`node tools/audit-provider-boundaries.mjs <id>`（問題なし）、`npm test`（全件合格）、分類ページで確認。
- 比較表は取りまとめ役が書き、`js/categories.js` の `CATEGORY_DOCS` に登録する。書き方は reference-structure.md の「比較表」と「文章の書き方」に従う（特徴の行、太字は違いの語だけ、AI っぽい文を避ける）。
- ファイル編集は CRLF に注意。node スクリプトで編集するときは `\r\n` を考慮し、正規表現の `\` がシェルで消えないよう、スクリプトは Write で作ってから実行する。
