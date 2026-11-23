# Hindsight のエージェント記憶

## 1. 対象

retain・recall・reflect を使い、エージェントの記憶を保持し検索する。

## 2. 機能配置と処理

エージェントが retain で記憶を渡し、事実の抽出と記憶の保存を行う。recall は関連する記憶を検索し、reflect は記憶に基づき回答を組み立てる。

## 3. 設計上の注意

抽出の誤り、アクセス範囲、個人情報、削除、保存量やモデル利用コストに注意する。reflect と recall は異なる処理である。

## 4. 実装例

自己ホストした Hindsight API と外部 PostgreSQL、設定したモデルを組み合わせる例。Enterprise 専用の Memlake や Cloud 機能は前提にしない。

| 機能 | 担い手 |
|---|---|
| エージェント | 利用するエージェント |
| 記憶の取り込み | Hindsight retain |
| 記憶の保存 | PostgreSQL 記憶データ |
| 記憶の検索 | Hindsight recall |
| 記憶を基にした回答 | Hindsight reflect |
| 抽出・回答用モデル | 設定された LLM |

[Hindsight](https://github.com/vectorize-io/hindsight)、[Recall and reflect](https://hindsight.vectorize.io/blog/2026/07/24/recall-vs-reflect)。
