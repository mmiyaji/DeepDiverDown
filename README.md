# DeepDiverDown

設計書を「構造化モデル」に落とし、そこから 3D（フロア式アイソメ）図解・動き・指摘を生成して、
人間が設計上の問題点を把握しやすくするための実験プロジェクト。

## 起動
```
python -m http.server 8124 --bind 0.0.0.0   # → http://localhost:8124/
```

## パイプライン
```
docs/*.md（設計書）
   │  prompts/extract-model.md を使って LLM で抽出 → 人がレビュー
   ▼
models/<name>.model.js（構造化モデル：唯一の正）
   │                         ┌ models/<name>.actual.js（実環境 / IaC から取得した構成）
   ▼                         ▼
web（3D 図解） ─ 構造 / シナリオ / 障害 / 指摘 / メトリクス / 差分
```

## 7つの機能と対応
| # | アイディア | 実装 |
|---|---|---|
| 1 | 設計書 → モデル → 図 | `prompts/extract-model.md`、各ノードの `src` で設計書の節に紐付け |
| 2 | ユースケースを動きで | `scenarios` をステップ再生 |
| 3 | 障害シナリオ | ノードをクリックで停止 → 同期依存で影響範囲を伝播 |
| 4 | 問題点の自動検出 | `js/lint.js`（SPOF / タイムアウト未設定 / 同期チェーン / 循環 / 共有DB） |
| 5 | 数値の重ね合わせ | `metrics`（p95・コスト・RPS）を高さと色に |
| 6 | 設計と実環境の差分 | `*.actual.js` と比較して欠落 / 余剰 / 台数差を表示 |
| 7 | 階層をフロアで | `tier`（edge / app / data）ごとに床を積み上げ |

## モデル仕様
`docs/model-schema.md` を参照。
