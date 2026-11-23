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

この例では利用者が Python アプリと Neo4j を別ホストで運用し、DB データとバックアップ、認証、モデル接続を管理する。モデルの提供先は未選定で、クラウド境界は仮定しない。公式資料を組み合わせた未検証の代表例で、バージョンと永続化方法は導入時に確認する。

[Graphiti quickstart](https://github.com/getzep/graphiti/blob/main/examples/quickstart/README.md)、[Graphiti](https://github.com/getzep/graphiti)。

## 5. 実装例：AWS の EC2・Neo4j・EBS

同じ Amazon EC2 の Linux インスタンスに、Graphiti を組み込んだ Python アプリと Neo4j Community Edition のコンテナを置く。Graphiti の Neo4j quickstart と同様、抽出と埋め込みには外部の OpenAI API を使う。

| 機能配置 | 実装での担い手 |
|---|---|
| 利用アプリ・取り込み・検索 | EC2 上の Python アプリとプロセス内の Graphiti |
| 時間情報付きグラフ | Bolt で接続する Neo4j Community Edition |
| グラフの永続化 | Neo4j の `/data` に割り当てた Amazon EBS データボリューム |
| 抽出と埋め込み | AWS アカウント外の OpenAI API |
| 検索結果の利用 | 関連する事実を受け取る分析処理やエージェント |

AWS が EC2・EBS の基盤を提供し、利用者が OS、Graphiti、Neo4j、データと権限を管理する。OpenAI API は AWS アカウント外であり、利用者が API 資格情報と送信データを管理する。複数資料を組み合わせた未検証の例で、モデルと DB のバージョン、接続と復元を導入時に検証する。

Graphiti は Apache-2.0、Neo4j Community Edition は GPLv3 で提供される。Graphiti の対応条件に合う Neo4j 5.26 以降を選ぶ。AWS は仮想マシンとブロックストレージを提供し、ソフトウェア更新、監視、DB のバックアップと復旧は運用者が管理する。

- [Graphiti Neo4j quickstart](https://github.com/getzep/graphiti/blob/main/examples/quickstart/README.md)
- [Graphiti license and requirements](https://github.com/getzep/graphiti/blob/main/pyproject.toml)
- [Neo4j Docker volumes](https://neo4j.com/docs/operations-manual/current/docker/mounting-volumes/)
- [Neo4j licensing](https://neo4j.com/open-source-project/)
- [Amazon EBS persistent block storage](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/storage_ebs.html)
