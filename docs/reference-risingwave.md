# RisingWave の基本アーキテクチャ

docs.risingwave.com の公式ドキュメントを基準に、構成部品・データの流れ・実行場所を整理する。更新の仕組み、Hummock とコンパクション、Barrier と復旧は「仕組みの深掘り」の図で扱う。

## 1. RisingWave の位置づけ

RisingWave は、データベースやイベントストリームから継続的にデータを取り込み、SQL で増分処理して、新しい結果を低遅延で提供するシステムである。PostgreSQL のワイヤープロトコルに対応し、psql や各言語のドライバーで接続する。公式の紹介ページは Debezium・Kafka・Flink・サービング用 DB の組み合わせを 1 つで置き換えるものとして説明している（資料側の主張であり、本書では評価しない）。

マテリアライズドビューは入力の変化に合わせて自動で更新され、`REFRESH` に当たる操作はない。内部の状態とビューの結果はオブジェクトストレージに置く。

## 2. ノードの役割

資料は 4 種類のノードを挙げる。

- **Frontend（Serving Node）**：ステートレスな PostgreSQL 互換ノード。クライアント接続を受け、SQL を解析・バインド・最適化する。バッチクエリは自分で実行し、ストリーミングクエリの計画は Meta へ渡す。軽い問い合わせ（点参照など）は local、結合や集約を含む問い合わせは distributed モードで動く。
- **Compute（Streaming Node）**：ストリームグラフを実行し、集約や結合の状態を保つ。専用（Streaming のみ・Serving のみ）にも、両方を担う hybrid（既定）にもできる。
- **Meta**：全データベースオブジェクトのメタデータを管理し、ストリーミングジョブを Compute に配置する。Barrier と checkpoint を起動し、障害時の復旧を扱い、コンパクションタスクを生成する。
- **Compactor**：LSM ツリーのストレージをバックグラウンドで整理し、読み取りを速くして領域を回収する。

規模の目安として、資料は Compute 対 Compactor を 2 対 1（書き込みが多い処理は 1 対 8 の場合もある）、Compute 対 Meta を 4 対 1 とする。

## 3. Hummock・オブジェクトストレージ・meta store

- **Hummock**：Table・マテリアライズドビュー・ストリーム処理の状態を持つ、行ベースの LSM ツリーのストレージエンジン。永続コピーを S3・GCS・Azure Blob などのオブジェクトストレージに置き、Compute 側にホットなデータをキャッシュする。ストレージと計算が分かれているため、ストレージを増やさずに Compute を増減できる。
- **LSM ツリー**：書き込みはすべて追記で、削除は削除印（tombstone）で表す。新しいデータは L0 に入り、L1 以上でソートされる。詳細は「RisingWave：Hummock ストレージとコンパクション」で扱う。
- **オブジェクトストレージ**：S3、GCS、Azure Blob、MinIO など。OpenDAL で抽象化している。
- **meta store**：Meta がメタデータを保存する先で、PostgreSQL・MySQL・SQLite を選べる。Frontend はカタログを Meta から取得してローカルにキャッシュする。
- 大量の全表走査は列指向の形式より不得手とされ、そのための列指向ストレージとして Iceberg の選択肢が案内されている。

## 4. Source・Table・マテリアライズドビュー・Sink

| 対象 | RisingWave 内のデータ | 問い合わせ |
| --- | --- | --- |
| Source（`CREATE SOURCE`） | 持たない。外部システムへの接続の定義だけ | Kafka・S3・Iceberg は直接可。CDC は不可 |
| Table（`CREATE TABLE`、コネクタ付きも可） | 持つ。コネクタ付きではオフセット等も追跡する | 可 |
| マテリアライズドビュー | 結果を持つ | 可 |
| Sink（`CREATE SINK`） | 持たない。結果を外部へ継続的に配信する | 不可 |

- CDC（PostgreSQL・MySQL など）は、更新と削除を正しく反映するために Table で取り込む。
- Sink の入力は既存の Source・Table・マテリアライズドビューか、クエリである。資料は、マテリアライズドビューを Sink の上流にするのが通常で、Source を直接の上流にはできないと述べる。
- これらは Streaming Job と呼ばれる継続的な SQL 処理である。

## 5. データの流れ

1. クライアントが SQL を Frontend に送る。
2. バッチクエリは、Frontend が計画をフラグメントに分け、並列に実行して結果をまとめて返す。
3. ストリーミングクエリは、Frontend が計画して Meta へ渡し、Meta が Actor を Compute に割り当てる。履歴のデータをバックフィルして上流に追いついた後、増分処理に進む。
4. 更新はストリームグラフを流れ、マテリアライズドビューに反映される。`SELECT` は最新の結果を返す。
5. Meta は既定で 1000 ms ごとに Barrier を送る。全 Compute が状態を保存して Barrier を集め終えると、一貫した checkpoint になる。
6. 障害後は、Meta が最後の checkpoint から Actor を作り直す。Meta はコンパクションタスクを作り、Compactor に割り当てる。

## 6. 動く場所

- **Kubernetes**：RisingWave Operator がカスタムリソースを追加する（cert-manager が前提）。`spec.components` に meta・compute・compactor・frontend のノードグループを指定し、`spec.stateStore` にオブジェクトストレージ（S3・MinIO・GCS・Azure Blob・Alibaba OSS・HDFS など）を指定する。S3 では `useServiceAccount: true` でサービスアカウントの権限を使える。本番では CPU とメモリの requests と limits を同じにすることが推奨される。
- **Docker Compose**：既定は 1 プロセスのオールインワンで、Frontend・Meta・Compute・Compactor がスレッドとして同居する。`docker-compose-distributed.yml` は各コンポーネントを別プロセスにし、MinIO を state store にする。meta store は PostgreSQL が既定。
- **ハードウェア要件**：Compute は最小 2 コア・8 GiB（推奨 4 コア・16 GiB 以上）、Compactor・Meta・Frontend は最小 1 コア・4 GiB（推奨 2 コア・8 GiB 以上）。Meta は 2 台（主と副）を推奨。ストレージ性能は全体の性能に強く影響し、クラウドのオブジェクトストレージが推奨される。

## 7. 実装例：AWS の EKS・S3・RDS for PostgreSQL

EKS の EC2 マネージドノードグループに RisingWave Operator で Frontend・Meta・Compute・Compactor の Pod を配置する例。state store は S3（`spec.stateStore.s3` にバケットとリージョン、`useServiceAccount` でサービスアカウントの IAM ロール）、meta store は PostgreSQL（RDS for PostgreSQL を選んだ例）とする。Kafka と Sink の出力先は RisingWave の資料が提供元を指定しないため、実行場所を決めない外部システムとして描く。

| 機能 | 担い手 |
| --- | --- |
| SQL クライアント | psql など。公開方式は Frontend の Service の種類（ClusterIP・NodePort・LoadBalancer）で選ぶ |
| Frontend・Meta・Compute・Compactor | EKS の EC2 ノード上の各 Pod |
| Hummock・マテリアライズドビュー | Amazon S3 のバケット（RisingWave が dataDirectory 配下に書く） |
| meta store | RDS for PostgreSQL |
| Source・Sink | 外部の Kafka と出力先（実行場所は未選定） |
| AWS 権限 | サービスアカウントに対応する IAM ロール |

AWS が EKS 制御プレーンと EC2・S3・RDS の基盤を運用する。利用者は Kubernetes API、ノードグループ、RisingWave の配置・設定・更新、データ、権限を管理する。RDS を meta store にすること、Amazon MSK を Kafka に使うこと、必要な IAM 権限の一覧は RisingWave の資料に記載がなく未確認。図は公式資料を組み合わせた代表例で、実動作は未検証。

3D では RisingWave の Pod を実行ノードの上に配置する。EKS の Kubernetes API、IAM、S3、RDS は同じ AWS アカウント内の別の領域に置く。AWS アカウントの枠はリソースの論理的な所属を示す。図中の VPC は EKS ワーカーの範囲で、RDS の VPC 配置は未確認。

## 8. 実装例：自社データセンターの Docker Compose（分散構成）

自社のサーバーで `docker-compose-distributed.yml` を使う例。Frontend・Meta・Compute・Compactor を別々のコンテナで実行する。同じ Compose 構成に PostgreSQL と MinIO のコンテナが含まれる。

| 機能 | 担い手 |
| --- | --- |
| Frontend・Meta・Compute・Compactor | Docker ホスト上の各コンテナ |
| Hummock | MinIO コンテナ（S3 互換） |
| meta store | PostgreSQL コンテナ |
| Source・Sink | 外部の Kafka と出力先（実行場所は未選定） |

図では外部の Apache Kafka を入力とする。配布されている Compose ファイルには Kafka 互換の Redpanda が含まれる。

利用者がサーバー、Docker、PostgreSQL、MinIO を運用する。公式ガイドは Docker Compose による起動手順を示す。本番運用でのホスト台数、コンテナのホスト間配置、冗長化は未確認である。

- [RisingWave · Docker Compose](https://docs.risingwave.com/deploy/risingwave-docker-compose)
- [RisingWave · docker-compose-distributed.yml](https://github.com/risingwavelabs/risingwave/blob/main/docker/docker-compose-distributed.yml)

## 公式資料

- [RisingWave · Architecture](https://docs.risingwave.com/get-started/architecture)
- [RisingWave · What is RisingWave](https://docs.risingwave.com/get-started/intro)
- [RisingWave · Source, Table, MV, and Sink](https://docs.risingwave.com/get-started/source-table-mv-sink)
- [RisingWave · Key concepts](https://docs.risingwave.com/reference/key-concepts)
- [RisingWave · Storage overview](https://docs.risingwave.com/store/overview)
- [RisingWave · Deploy on Kubernetes](https://docs.risingwave.com/deploy/risingwave-kubernetes)
- [RisingWave · Docker Compose](https://docs.risingwave.com/deploy/risingwave-docker-compose)
- [RisingWave · Hardware requirements](https://docs.risingwave.com/deploy/hardware-requirements)
- [Amazon EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [IAM roles for service accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
- [Amazon RDS for PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
