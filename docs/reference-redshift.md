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
