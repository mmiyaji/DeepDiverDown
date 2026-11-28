# Weaviate の概要（コレクション・シャード・索引・複製）

## 1. 概要

Weaviate はオブジェクトとそのベクトルを保存し、ベクトル検索とキーワード検索（BM25）を組み合わせたハイブリッド検索ができるデータベースである。Go で書かれ、Community Edition のライセンスは BSD-3-Clause。リポジトリの `wl/` フォルダーのファイルは商用ライセンスで、ライセンスキーが必要とされる。API は REST、gRPC、GraphQL。ベクトル化は OpenAI、Cohere、HuggingFace、Google などの統合モジュールか、利用者が用意したベクトルで行う。生成検索と再ランキング、RBAC、オブジェクトの TTL も記載がある。デプロイは Docker、Kubernetes（Helm）、Weaviate Cloud、AWS・GCP のマーケットプレイス。ネイティブの Windows は非対応（Docker か WSL を使う）。2026 年 11 月時点で確認した範囲であり、版の数値は資料中の例（Docker Compose の 1.36.0）以外は未確認。

- [Weaviate (GitHub)](https://github.com/weaviate/weaviate)
- [Weaviate deployment](https://docs.weaviate.io/deploy)
- [Weaviate vector quantization](https://docs.weaviate.io/weaviate/concepts/vector-quantization)（取得日 2026年11月28日）
- [Weaviate PQ compression](https://docs.weaviate.io/weaviate/configuration/compression/pq-compression)（取得日 2026年11月28日）
- [Weaviate BQ compression](https://docs.weaviate.io/weaviate/configuration/compression/bq-compression)（取得日 2026年11月28日）
- [Weaviate SQ compression](https://docs.weaviate.io/weaviate/configuration/compression/sq-compression)（取得日 2026年11月28日）
- [Weaviate RQ compression](https://docs.weaviate.io/weaviate/configuration/compression/rq-compression)（取得日 2026年11月28日）

## 2. 登録と検索の流れ

クライアントの要求を受けたノードは、データを持たないノードへ要求を内部で転送する。登録時はベクトル化モジュールが外部 API またはローカル推論コンテナでベクトルを作り、オブジェクトに付けて保存する。ベクトルを利用者が用意することもできる。ハイブリッド検索の結果の統合方法とフィルター付き検索の実装は取得した資料に記載がなく未確認。

## 3. データの構造

コレクションはスキーマを共有するオブジェクトの集合で、ベクトライザー、索引、複製の設定を単位ごとに持つ。オブジェクトはプロパティ、任意のベクトル、UUID を持つ JSON 文書である。1 つのコレクションに複数の名前付きベクトルを置け、それぞれ索引、圧縮、ベクトライザー、距離指標を変えられる。コレクション間の参照（cross-reference）は問い合わせを遅くしうるため、可能なら避けることが推奨されている。

データはシャードに分かれる。各シャードは次の 3 つを持つ。

- ベクトル索引（索引構造とベクトルキャッシュ）
- 転置索引（BM25 とフィルター用）
- オブジェクトストア（オブジェクトのデータ、メタデータ、ベクトル）

マルチテナントではテナントごとに 1 シャードを持ち、専用のベクトル索引で分離される。テナントの状態は ACTIVE、INACTIVE（ローカルディスク）、OFFLOADED（クラウドストレージ。v1.26 時点で S3 のみ）。各ストアの内部形式（LSM など）は取得した資料に記載がなく未確認。

- [Weaviate data structure](https://docs.weaviate.io/weaviate/concepts/data)

## 4. 複製とシャード

メタデータ（コレクション定義とテナントの状態）は v1.25 以降 Raft で確定する。リーダーが変更を扱い、少数のノードが落ちても整合する。v1.25 より前は同期の 2 相コミットで、1 ノードの停止で変更が止まった。メタデータは複製係数にかかわらず全ノードへ複製される。

データの複製はリーダーレスで、プライマリもセカンダリもない。複製係数はコレクションごとに 1 を超える値にし、クラスタのノード数と同じである必要はない。一貫性レベルは ONE、QUORUM（n/2+1）、ALL。書き込みの一貫性は v1.18 から選べ、読み取りは問い合わせごとに指定する。資料は、Weaviate が一般に整合性より可用性を優先すると述べる。ALL 以外の書き込みは利用者から見て非同期になるが、背景の伝播の仕組みと read repair の動作は未確認。

シャーディング（v1.8 から）はデータを分割して複数ノードへ置く。複製と組み合わせられ、例えば 3 レプリカ・3 シャードなら計 9 シャードを各ノードが 3 つずつ持つ。

- [Weaviate replication architecture](https://docs.weaviate.io/weaviate/concepts/replication-architecture)

## 5. ベクトル索引

- HNSW：多層グラフでクエリが速く、構築は遅い。CRUD に対応し、メモリ上に置くため使用量はベクトル数に比例する。`ef` で候補リストの大きさを決め、-1 で問い合わせの件数から自動計算する。削除したオブジェクトは非同期の整理までグラフに残る。
- flat：ディスク上の単層で、メモリは小さいが検索時間はオブジェクト数に比例する。小さなコレクションやマルチテナントのテナント単位に向く。
- dynamic（実験的、v1.25 以降）：flat で始め、オブジェクト数が閾値（既定 10,000）を超えると HNSW へ切り替える。`ASYNC_INDEXING=true` が必要で、切り替えは一方向。
- HFresh（v1.36 以降）：HNSW の重心索引とディスク上の投稿リストを持つクラスタ型。距離は `cosine` と `l2-squared` のみ。

量子化は 4 方式ある。PQ（直積量子化）はベクトルを区間に分け、区間ごとにコードブックの重心へ置き換える。既定の重心数は 256、訓練数は 1 シャードあたり 100,000 件（`trainingLimit`）で、HNSW のみ対応し、flat は非対応。SQ（スカラー量子化）は 32 ビットの浮動小数を 8 ビットの区間に写し、約 4 倍に圧縮する。訓練が必要で、既定の訓練数は 1 シャードあたり 100,000 件、HNSW のみ対応。BQ（二値量子化）は各次元を 1 ビットにし、32 倍に圧縮する。HNSW と flat に対応する。RQ（回転量子化）は擬似乱数の回転をかけてから量子化し、8 ビット（約 4 倍、再現率 98〜99%）、4 ビット（約 8 倍）、1 ビット（32 倍に近づく）を選べ、訓練は不要。8 ビットは HNSW が v1.32、flat が v1.35、1 ビットは HNSW が v1.33、flat が v1.35、4 ビットは HNSW のみで v1.40 から。SQ・BQ・RQ は圧縮後のベクトルで多めに候補を取り、非圧縮のベクトルで再採点する。BQ と SQ は v1.31 から既存コレクションでも有効にできる。いったん設定した量子化は無効にできない。PQ の訓練は、手動か、`ASYNC_INDEXING=true` での自動（AutoPQ）。PQ・BQ・SQ が導入された版番号は取得した資料に記載がなく未確認。

- [Weaviate vector index](https://docs.weaviate.io/weaviate/concepts/vector-index)

## 6. 運用の形態

自前運用は Docker Compose（開発・評価）か Kubernetes の Helm チャート（`values.yaml` で設定）。Weaviate Cloud は提供元が運用するマネージド版で、複製による高可用性とゼロダウンタイム更新が選択式。永続ボリュームの設定、S3・GCS・ファイルシステムへのバックアップ、認証と RBAC の詳細は、取得した資料に記載がなく未確認。

## 7. 実装例：自前の Kubernetes 上の 3 ノード

| 機能 | 具体的な担い手 |
| --- | --- |
| クライアント | 公式クライアントライブラリ（REST・gRPC） |
| API・コレクション・メタデータの合意・シャード・3 種類の保存先 | Weaviate ノード A |
| データ複製 | 別ノードのレプリカ（リーダーなし） |
| ベクトル化 | ローカル推論コンテナ（モデルは固定しない） |
| 保存 | ノードのディスク |

利用者が自前のサーバーで Kubernetes と Weaviate を運用する構成。公式資料に基づく代表例であり、導入事例や動作検証済みの構成ではない。図はノード 2 台に省略している。永続ボリュームの種類、複製係数と一貫性レベルの具体値、認証は未確認。マネージド版（Weaviate Cloud）の内部構成は公開資料で確認できておらず、図にしていない。
