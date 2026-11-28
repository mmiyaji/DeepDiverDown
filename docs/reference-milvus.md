# Milvus の概要（層構成・セグメント・インデックス・整合性・デプロイ）

## 1. 概要

Milvus はベクトルを保存して類似検索を行うオープンソースのデータベースである。リポジトリの README は Apache 2.0 ライセンスで配布され、LF AI & Data Foundation 配下のプロジェクトで、Zilliz が主な貢献者と記す。デプロイの形は 3 つあり、Milvus Lite（pip で入れてファイルから動かす）、Standalone（1 台）、Distributed（Kubernetes 前提の分散構成）である。Zilliz Cloud（Serverless・Dedicated・BYOC）は別のマネージドサービスで、この資料の対象外とする。2026 年 11 月時点の公式資料に基づく。

- [Milvus repository](https://github.com/milvus-io/milvus)
- [Milvus release notes](https://milvus.io/docs/release_notes.md)（取得日 2026年11月28日。コーディネーターと Streaming Service の記述の確認）
- [Milvus architecture overview（v2.5.x）](https://milvus.io/docs/v2.5.x/architecture_overview.md)（取得日 2026年11月28日。層の名前のみで個別の部品名なし）
- [Milvus Main Components（v2.5.x）](https://milvus.io/docs/v2.5.x/main_components.md)（取得日 2026年11月28日。旧構成のコーディネーターとワーカーの名前の確認）

## 2. 四つの層

アーキテクチャはアクセス層、コーディネーター、ワーカーノード、ストレージ層の 4 層で、データプレーンと制御プレーンを分け、層ごとにスケールと復旧ができる。

- アクセス層：ステートレスな Proxy がクライアントの接続先になり、要求の検証と中間結果の集約を行う。
- コーディネーター：クラスタで有効なものは 1 つ。DDL・DCL・TSO、ストリーミングの割り当て、クエリのトポロジーとビュー、セグメント管理を担う。
- ワーカーノード：ステートレスで、コーディネーターの指示に従う。ストリーミングノードはシャード単位で WAL 上の一貫性と復旧を受け持ち、growing データへの検索に答え、growing を sealed に変換する。クエリノードはオブジェクトストレージから履歴データを読み込んで検索に答える。データノードは compaction とインデックス構築を行う。
- ストレージ層：メタストレージ（資料に載る実装は etcd）、メッセージ（WAL）ストレージ（Woodpecker、Pulsar、Kafka）、オブジェクトストレージ（MinIO、AWS S3、Azure Blob Storage）。Woodpecker はローカルディスクを使わず、オブジェクトストレージへ直接書く設計と説明されている。

現行の概要ページはコーディネーターを 1 つの役割として書く。v2.5.x 版の Main Components ページは Root coord・Query coord・Data coord の 3 つのコーディネーターと、Query node・Index node・Data node を挙げ、Mix coord とストリーミングノードの記載はない。リリースノートの 3.0.x の修正項目には MixCoord と Streaming Service の名が出る。旧来の 3 つの呼び名と現行の 1 つの役割は、版によって構成が違うことまでを確認した。切り替わった版の番号と、旧 3 コーディネーターの役割が現行のどこへ移ったかは未確認。

- [Milvus architecture overview](https://milvus.io/docs/architecture_overview.md)

## 3. セグメント

データはセグメント単位で扱われる。書き込み直後のデータは growing セグメントで、ストリーミングノードが保持し、リアルタイムに検索できる。容量に達すると sealed セグメントになり、compaction とインデックス構築を経てオブジェクトストレージに置かれ、クエリノードが読み込んで検索に使う。Proxy は各ノードの部分結果を集約する。Proxy から書き込みがストリーミングノードへ渡る経路と、変換後の保存の担い手は、概要ページの記述だけでは細部を確認できず未確認。Milvus 2.6.4 以降は、クエリノードがメタデータだけを先に読み込み、フィールドデータやインデックスを必要時に取得する階層型ストレージが使える。キャッシュにない読み取りは遅延が増える。

- [Milvus architecture overview](https://milvus.io/docs/architecture_overview.md)

## 4. インデックス

メモリ上のインデックスとして、浮動小数点ベクトルに FLAT、IVF_FLAT、IVF_PQ、IVF_SQ8、HNSW 系、SCANN、バイナリに BIN_FLAT と BIN_IVF_FLAT、スパースに SPARSE_INVERTED_INDEX がある。距離は浮動小数点が L2 と内積、バイナリが JACCARD と HAMMING、スパースが内積と BM25。ベクトルフィールドごとにインデックスは 1 種類で、変更すると古いものは削除される。取得したページは非推奨と表示され、最新の説明は別ページを参照とされていた。DiskANN などディスク上のインデックスと、データノードでの構築手順は未確認。

- [Milvus in-memory index](https://milvus.io/docs/index.md)

## 5. 整合性レベル

Strong、Bounded staleness（既定）、Session、Eventually の 4 段階がある。内部では GuaranteeTs を使い、クエリノードが検索を実行してよい時点を決める。Strong は最新のシステム時刻まで待つ。Bounded は少し古い時刻でよく、Session は自分の最新の書き込みの時刻を使い、Eventually は確認を省く。TSO の仕組みと WAL による耐久性の詳細は、このページに記載がなく未確認。

- [Milvus consistency level](https://milvus.io/docs/consistency.md)

## 6. デプロイ

Milvus Operator は Kubernetes 上にコンポーネントと依存（etcd、MinIO）を配置し、メッセージキューは Woodpecker が既定になる。サンプル `milvus_cluster_woodpecker.yaml` はストリーミングノードと Mix Coordinator を含み、Standalone には `milvus_default.yaml` を使う。Pulsar、Kafka、RocksMQ も選べる。前提は Kubernetes クラスタと StorageClass。リソースの種類は `Milvus`（`milvus.io/v1alpha1`）で、`kubectl get milvus` で状態を確認する。

- [Install Milvus cluster with Milvus Operator](https://milvus.io/docs/install_cluster-milvusoperator.md)

## 7. 実装例：自前の Kubernetes 上のクラスタ（Milvus Operator）

| 機能 | 具体的な担い手 |
| --- | --- |
| クライアント | pymilvus などの SDK |
| Proxy | Milvus Proxy の Pod |
| コーディネーター | Mix Coordinator の Pod |
| ストリーミング・growing セグメント | Streaming Node の Pod |
| 履歴データの検索 | Query Node の Pod |
| compaction・索引構築 | Data Node の Pod |
| メタストレージ | etcd |
| WAL | Woodpecker（オブジェクトストレージへ書く） |
| オブジェクトストレージ | MinIO |

利用者が自前の Kubernetes クラスタで Milvus と依存を運用する構成。Operator のサンプルと概要ページを組み合わせた代表例であり、導入事例や動作検証済みの構成ではない。Woodpecker から MinIO への保存は「オブジェクトストレージへ直接書く」という説明に基づく。Pod の台数、ネットワーク、認証、TLS は未確認。Zilliz Cloud など商用のマネージド版は実装例に含めない。
