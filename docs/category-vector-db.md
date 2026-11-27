# ベクトルデータベースの違い

自前運用型（OSS・ソース公開）

| 観点 | Qdrant | Milvus | Weaviate |
| --- | --- | --- | --- |
| 特徴 | **属性条件つきの類似検索**。ベクトルと属性をコレクションに保存する | **層を分けた分散構成**。アクセス層・コーディネーター・ワーカー・ストレージの 4 層で、層ごとに拡張・復旧できる | **ベクトル検索と BM25 のハイブリッド検索**。Go 製で、REST・gRPC・GraphQL を持つ |
| データモデル・実行モデル | コレクションにベクトルと属性を登録する。データと索引は **セグメント** に整理される | データは **セグメント** 単位。書き込み直後は growing、容量に達すると sealed になる。ベクトルフィールドごとに索引は 1 種類 | コレクションはスキーマを共有するオブジェクトの集合。1 コレクションに **名前付きベクトルを複数** 置ける。データはシャードに分かれ、シャードごとにベクトル索引・転置索引・オブジェクトストアを持つ |
| 索引と検索の方式 | 近傍探索と属性条件を組み合わせる。索引の種類は未確認 | FLAT、IVF 系、HNSW 系、SCANN、バイナリ用、スパース用（`SPARSE_INVERTED_INDEX`）。距離は L2・内積・JACCARD・HAMMING・BM25。ディスク上の索引は未確認 | **HNSW**、flat、dynamic（実験的）、HFresh（v1.36 以降）。量子化の詳細は未確認 |
| 一貫性・耐久性 | 未確認 | 4 段階（Strong、Bounded staleness、Session、Eventually）。既定は **Bounded staleness**。WAL は Woodpecker・Pulsar・Kafka。耐久性の詳細は未確認 | データ複製は **リーダーレス**。一貫性は ONE・QUORUM・ALL。メタデータは v1.25 以降 **Raft**。可用性を整合性より優先する |
| 拡張のしかた | 複製とシャードを運用要件に合わせる。手順は未確認 | ワーカーノードがステートレスで、層ごとにスケールする。台数の目安は未確認 | シャーディング（v1.8 から）と複製を組み合わせる。複製係数はノード数と同じでなくてよい |
| 運用の形態 | 自己運用。例は EKS 上の **Helm チャート** + EBS。マネージド版は未確認 | Milvus Lite、Standalone、Distributed（Kubernetes 前提）。分散は **Milvus Operator** で配置する。Zilliz Cloud は別サービスで対象外 | Docker Compose、Kubernetes（Helm）、Weaviate Cloud、AWS・GCP のマーケットプレイス。ネイティブの Windows は非対応 |
| 得意な用途 | 属性で絞りながら近傍を探す検索 | 履歴データと直近の書き込みを分けて検索する構成 | キーワード検索とベクトル検索を併用する検索。テナントごとにシャードを分けるマルチテナント |
| 注意点 | 資料の記述が少なく、索引・一貫性・複製の動作は **未確認** | 依存に etcd と オブジェクトストレージが要る。コーディネーターの旧来の呼び名と版差は **未確認** | cross-reference は問い合わせを遅くしうる。read repair の動作は **未確認**。`wl/` フォルダーは商用ライセンス |
| ライセンス | Apache-2.0 | Apache 2.0 | BSD-3-Clause（Community Edition）。`wl/` は商用 |

内容は 2026 年 11 月時点の公式資料に基づく。確認できなかった点は「未確認」と書く。

## 選び方

- 属性条件つきの類似検索を、自前で運用する → **Qdrant**
- Kubernetes 上で層ごとに拡張する分散構成にする → **Milvus**
- 1 台から始め、同じ API のまま広げる → **Milvus**（Lite・Standalone・Distributed）
- BM25 とベクトル検索を併用する → **Weaviate**
- テナントごとにデータを分ける → **Weaviate**

## 公式資料

- [Qdrant architecture](https://qdrant.tech/documentation/overview/)
- [Qdrant GitHub](https://github.com/qdrant/qdrant)
- [Qdrant installation and storage requirements](https://qdrant.tech/documentation/install/)
- [Milvus repository](https://github.com/milvus-io/milvus)
- [Milvus architecture overview](https://milvus.io/docs/architecture_overview.md)
- [Milvus in-memory index](https://milvus.io/docs/index.md)
- [Milvus consistency level](https://milvus.io/docs/consistency.md)
- [Install Milvus cluster with Milvus Operator](https://milvus.io/docs/install_cluster-milvusoperator.md)
- [Weaviate (GitHub)](https://github.com/weaviate/weaviate)
- [Weaviate deployment](https://docs.weaviate.io/deploy)
- [Weaviate data structure](https://docs.weaviate.io/weaviate/concepts/data)
- [Weaviate replication architecture](https://docs.weaviate.io/weaviate/concepts/replication-architecture)
- [Weaviate vector index](https://docs.weaviate.io/weaviate/concepts/vector-index)
