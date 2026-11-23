# Graphiti の時間を扱う知識グラフ

## 1. 対象

エピソードから実体と関係を抽出し、時間情報付きグラフを更新・検索する。

## 2. 機能配置と処理

Graphiti はエピソードを取り込み、実体や関係を抽出・照合して時間情報を伴うグラフを更新する。検索では意味・キーワードなどを利用できる。

## 3. 設計上の注意

抽出結果はモデルや入力に依存する。時間の扱い、出典、認証、更新と削除を設計する。

## 4. 実装例

Graphiti の Python クライアントから Neo4j に接続し、エピソードを取り込み検索する公式 quickstart の例。LLM と埋め込みの提供先は別途設定する。

| 機能 | 担い手 |
|---|---|
| 利用アプリ | Python 利用アプリ |
| エピソードの取り込み | Graphiti エピソード取り込み |
| 時間情報付きグラフ | Neo4j グラフ |
| グラフの検索 | Graphiti 検索 |
| 検索結果の利用 | 分析・エージェント |
| 抽出・埋め込みモデル | 設定された LLM・埋め込み |

[Graphiti quickstart](https://github.com/getzep/graphiti/blob/main/examples/quickstart/README.md)、[Graphiti](https://github.com/getzep/graphiti)。
