# Trino の分散クエリアーキテクチャ

## 1. Coordinator と Worker

Coordinator が SQL を解析して分散クエリ計画を作る。計画は Stage に分かれ、Worker 上の Task がそれぞれの Stage の処理を実行する。図はスキャンと集約の役割を分けて示す。

## 2. カタログと Connector

Trino のカタログは Connector と接続情報をまとめた設定である。Iceberg Connector は Iceberg のカタログやテーブルメタデータを参照し、Coordinator は処理対象の Split を Task に割り当てる。

## 3. 並列読み取りから結果へ

Worker は Connector を介して対象ファイルを読み、部分集計を作る。Exchange で中間データを次の Stage に渡し、Coordinator が実行結果を取得してクライアントに返す。

## 公式資料

- [Trino · Concepts](https://trino.io/docs/current/overview/concepts.html)
- [Trino · Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)

## 4. 実装例：EKS 上の Trino・Glue Catalog・S3

EKS の EC2 マネージドノードグループに Trino Helm チャートを配置し、Coordinator と Worker を別 Pod で実行する例。Iceberg Connector は Glue Data Catalog でテーブルのメタデータ位置を解決し、Coordinator と Worker は必要なメタデータやデータファイルを Amazon S3 から読み取る。クライアントは Kubernetes Service など、別途設定した接続経路を通じて Coordinator に SQL を送る。

| 機能 | 担い手 |
| --- | --- |
| SQL クライアント | 外部の Trino CLI |
| SQL の計画とメタデータ解決 | Trino Coordinator Pod、Iceberg Connector、AWS Glue Data Catalog |
| 読み取りと集約 | Trino Worker Pods |
| データとメタデータ | Amazon S3 上の Iceberg テーブル |
| 実行基盤 | EKS の Kubernetes 制御プレーンと EC2 ノードグループ |
| AWS アクセス | Pod の Kubernetes Service Account に対応する IAM ロール |

Trino のカタログ設定で `iceberg.catalog.type=glue` と `fs.s3.enabled=true` を指定する。Coordinator と Worker の両方に必要な S3 アクセスを、Glue に問い合わせる処理に必要な権限をそれぞれ与える。図は IAM roles for service accounts を使う例であり、ロールやポリシーが自動的に作られることを意味しない。クライアントへの公開方法、ネットワーク、認証、ノード容量は個別に構成する。EKS が Trino 自体をマネージドサービスとして運用するわけではない。

- [Trino on Kubernetes with Helm](https://trino.io/docs/current/installation/kubernetes.html)
- [Trino Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)
- [Trino S3 file system](https://trino.io/docs/current/object-storage/file-system-s3.html)
- [EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [IAM roles for service accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)

AWS が EKS 制御プレーンと EC2・Glue・S3 の基盤を運用する。利用者は Kubernetes API、ノードグループ、Trino の配置・設定・更新、カタログ・S3 データと IAM 権限を管理する。制御プレーンのサーバーは直接操作しない。図は公式資料を組み合わせた代表例であり実動作は未検証。クライアント公開方式、Glue と S3 のネットワーク経路、Trino と Iceberg のバージョン互換性は未指定。
