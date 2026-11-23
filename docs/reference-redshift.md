# Amazon Redshift のクラスター・マネージドストレージアーキテクチャ

## 1. 範囲
Amazon Redshift のプロビジョンドクラスターを、クライアント、リーダーノード、コンピュートノード、データベース、Redshift Managed Storage（RMS）の関係として示す。Redshift サービスはクラスターの設定、監視、バックアップ、パッチ適用を管理する。

出典 [Amazon Redshift provisioned clusters overview](https://docs.aws.amazon.com/redshift/latest/mgmt/overview.html)

## 2. クラスター
クラスターは1つのリーダーノードと1つ以上のコンピュートノードで構成される。クライアントはリーダーノードと通信し、コンピュートノードは外部アプリケーションから透過的に扱われる。

出典 [Data warehouse system architecture](https://docs.aws.amazon.com/redshift/latest/dg/c_high_level_system_architecture.html)

## 3. リーダーノード
リーダーノードはクライアントとの通信を受け、SQLを解析して実行計画を作り、コンパイルした処理をコンピュートノードへ配布する。コンピュートノードから中間結果を受け、最終集約してクライアントへ返す。

出典 [Data warehouse system architecture](https://docs.aws.amazon.com/redshift/latest/dg/c_high_level_system_architecture.html)

## 4. コンピュートノードとスライス
コンピュートノードは割り当てられた処理を実行し、中間結果をリーダーノードへ返す。各ノードはスライスに分割され、テーブルの分散スタイルや分散キーに基づいてデータと処理を並列化する。

出典 [Architecture components of an Amazon Redshift data warehouse](https://docs.aws.amazon.com/prescriptive-guidance/latest/query-best-practices-redshift/data-warehouse-arch-components.html)

## 5. Redshift Managed Storage
データウェアハウスのデータはコンピュートから分離されたRMSに保持できる。RMSはAmazon S3を使ってストレージを拡張し、コンピュートとストレージを独立して扱える。ローカルSSDは高性能なキャッシュとして自動利用される。

出典 [Data warehouse system architecture](https://docs.aws.amazon.com/redshift/latest/dg/c_high_level_system_architecture.html)

## 6. クエリの流れ
図は Client、Leader node、Compute node、Node slice、Database、Redshift Managed Storage、BI user の7ノードで、リーダーが計画を配布し、コンピュート側が並列処理して結果を戻す流れを表す。

出典 [Data warehouse system architecture](https://docs.aws.amazon.com/redshift/latest/dg/c_high_level_system_architecture.html)・[Amazon Redshift provisioned clusters overview](https://docs.aws.amazon.com/redshift/latest/mgmt/overview.html)

## 7. 参考資料
- [Amazon Redshift provisioned clusters overview](https://docs.aws.amazon.com/redshift/latest/mgmt/overview.html)
- [Data warehouse system architecture](https://docs.aws.amazon.com/redshift/latest/dg/c_high_level_system_architecture.html)
- [Architecture components of an Amazon Redshift data warehouse](https://docs.aws.amazon.com/prescriptive-guidance/latest/query-best-practices-redshift/data-warehouse-arch-components.html)

## 8. 実装例 Amazon Redshift RA3 のプライベートクラスター

プライベートサブネットのプロビジョンド RA3 クラスターに接続し、Amazon S3 から受注をロードする構成。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| SQL client | VPC 接続済みの SQL クライアント | Redshift クラスターの SQL エンドポイントに接続する。 |
| BI user | BI 担当者 | 集計済みの結果を参照する。 |
| クエリ計画・結果調整ノード | RA3 クラスターの Leader node | 実行計画を作り分散処理を調整する。 |
| 分散計算ノード・ノード内の並列処理単位 | RA3 コンピュートノードとスライス | 各ノード内の並列処理単位で計画の一部を実行する。 |
| 分析データベース・分離された管理ストレージ | Redshift データベースと Redshift Managed Storage | 論理データベースのテーブルを管理ストレージ上に保持する。 |

プライベート接続用のサブネットとセキュリティグループを設定する。S3 への COPY 経路を VPC 側で制御する場合は拡張 VPC ルーティングの到達先も構成する。図の計算ノードとスライスはプロビジョンドクラスターの例を示す。

出典 [Amazon Redshift provisioned clusters overview](https://docs.aws.amazon.com/redshift/latest/mgmt/overview.html)、[Data warehouse system architecture](https://docs.aws.amazon.com/redshift/latest/dg/c_high_level_system_architecture.html)、[Architecture components of an Amazon Redshift data warehouse](https://docs.aws.amazon.com/prescriptive-guidance/latest/query-best-practices-redshift/data-warehouse-arch-components.html)、[VPC 内の Redshift リソース](https://docs.aws.amazon.com/redshift/latest/mgmt/managing-clusters-vpc.html)、[Enhanced VPC routing](https://docs.aws.amazon.com/redshift/latest/mgmt/enhanced-vpc-enabling-cluster.html)
