# GraphRAG：グラフを利用した検索拡張生成

## 1. 対象と動向
文書から抽出した実体と関係を検索の手がかりにする RAG の構成。Gartner の 2026 年の公開発表では、複雑な問いを扱う動向として GraphRAG を挙げている。動向の参照は公開発表であり、有料レポート全文を読んだものではない。

## 2. 機能配置と処理
文書を分割し、実体・関係を抽出してグラフを構築する。グラフのまとまりごとの要約を作り、検索時には質問に応じてグラフや要約と元文書の情報を取り出す。生成モデルは取得した文脈を基に回答する。個別の実体についての探索と文書全体の要約を使う探索は区別する。

## 3. 設計上の注意
抽出・要約・回答には誤りがあり、GraphRAG 自体は正確性やアクセス制御を保証しない。元文書の参照元、権限、更新・削除の反映、コストを管理し、通常の検索方式と比較して評価する。グラフ抽出に LLM を利用する場合は投入情報とモデルへのアクセスにも注意する。

## 4. 実装例：Microsoft GraphRAG の Local Search
Microsoft GraphRAG の索引処理はテキストから実体と関係を抽出し、コミュニティの要約を生成し、既定では Parquet と設定されたベクトルストアに索引を出力する。Local Search は実体周辺の情報と関連するテキストを文脈に組み立て回答する。図のモデルは Local Search を選んだ例で、Global Search はコミュニティ報告を使う別の方式。ホスティング先のクラウドやモデル提供者は指定しない。

| 機能 | 担い手 |
|---|---|
| 文書と索引作成 | 文書群、GraphRAG 索引パイプライン |
| グラフと要約 | Parquet の索引と設定済みベクトルストア |
| 検索と生成 | GraphRAG Local Search と設定された生成モデル |
| 利用 | 質問者 |

[Gartner 2026 発表](https://www.gartner.com/en/newsroom/press-releases/2026-06-16-gartner-identifies-the-top-trends-for-data-and-analytics)、[GraphRAG 索引](https://microsoft.github.io/graphrag/index/overview/)、[GraphRAG 概要](https://microsoft.github.io/graphrag/)。

## 5. 実装例：Azure（GraphRAG on VM・Blob・Cosmos DB）

運用者が Azure の Linux VM に Python と Microsoft GraphRAG を導入し、CLI の `index` と `query --method local` を実行する。実行環境と GraphRAG のバージョンは VM の運用者が管理する。

| 機能 | 担い手 |
|---|---|
| 索引の入力 | Azure Blob Storage の入力コンテナー |
| 文書の分割、実体・関係の抽出、索引作成 | VM 上の GraphRAG の索引処理 |
| グラフと要約、ベクトル索引 | Azure Blob Storage に出力する Parquet と Azure Cosmos DB for NoSQL のベクトルストア |
| 検索と回答 | VM 上の GraphRAG Local Search |
| チャットと埋め込み | Azure OpenAI に個別にデプロイしたチャットモデルと埋め込みモデル |

GraphRAG の入力と出力に Blob Storage を、ベクトルストアに `cosmosdb` を選ぶ。チャットと埋め込みのデプロイ名を指定し、ベクトル索引の次元を埋め込みモデルの出力に合わせる。Local Search は Parquet とベクトル索引を読み、質問に関連する文脈をモデルに渡す。

- [Azure 仮想マシン](https://learn.microsoft.com/azure/virtual-machines/overview)
- [GraphRAG 詳細設定](https://microsoft.github.io/graphrag/config/yaml/)
- [GraphRAG を始める](https://microsoft.github.io/graphrag/get_started/)
- [GraphRAG Local Search](https://microsoft.github.io/graphrag/query/local_search/)
- [Azure Cosmos DB for NoSQL のベクトル検索](https://learn.microsoft.com/en-us/azure/cosmos-db/vector-search)

利用者は実行ホスト、GraphRAG の設定、入力文書、索引、資格情報とモデルの選択を管理する。汎用例のモデルと索引ストアの提供者・配置は未指定であり、別環境の可能性がある。Azure 例では Azure が VM の基盤と各マネージドサービスの基盤を運用し、利用者が VM の OS・アプリ、アクセス権、データ、モデルのデプロイとサービス設定を管理する。サービス内部のホストへの直接操作は前提としない。資料を組み合わせた代表例であり、特定のバージョン、認証経路、ネットワーク設定を含む通しの動作は未検証。
