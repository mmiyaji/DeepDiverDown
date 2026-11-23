# Inmon CIF の統合 EDW と依存型データマート

## 1. モデルの範囲

Bill Inmon の Corporate Information Factory（CIF）が中心に据える統合 EDW と、そこからデータを供給するマートを扱う。架空の注文・顧客・返金システムを入力とし、ODS など CIF の周辺機能は図から省略する。

出典 [Bill Inmon: Data Warehousing 2.0](https://www.embarcadero.com/images/dm/technical-papers/bill-inmon-data-warehousing-2-0-whitepaper.pdf)、[Bill Inmon: A Tale of Two Architectures](https://williaminmon.substack.com/p/a-tale-of-two-architectures-kimball)

## 2. 業務システムから統合する

ソース統合 ETL は業務システムごとの表現を全社で使う定義に対応付ける。たとえば EC 側の顧客番号 C-15 を顧客マスターと照合し、企業内顧客キー E-42 として注文を関連付ける。キーの対応や意味は統合時に決める。

出典 [Bill Inmon: Data Warehousing 2.0](https://www.embarcadero.com/images/dm/technical-papers/bill-inmon-data-warehousing-2-0-whitepaper.pdf)、[Bill Inmon: A Tale of Two Architectures](https://williaminmon.substack.com/p/a-tale-of-two-architectures-kimball)

## 3. 正規化された統合 EDW

CIF の EDW は統合済みで履歴を持つ詳細データの置き場で、この例は第3正規形（3NF）を使う。顧客属性は顧客表、注文単位の項目は注文表、明細単位の項目は注文明細表にあり、キーで関連付ける。返金取引も識別子を持ち、元の注文明細と関連付けて記録する。

出典 [Bill Inmon: Data Warehousing 2.0](https://www.embarcadero.com/images/dm/technical-papers/bill-inmon-data-warehousing-2-0-whitepaper.pdf)、[Bill Inmon: A Tale of Two Architectures](https://williaminmon.substack.com/p/a-tale-of-two-architectures-kimball)

## 4. 依存型データマート

マートは EDW の統合データから作る。営業マートは1注文明細1行で販売時点の地域と受注時金額を提供する。経理マートは日別・通貨別に受注額と返金額を提供する。受注額は注文日、返金額は返金取引日で集計し、後着の返金は該当する経理マートの日付を更新する。

出典 [Bill Inmon: Data Warehousing 2.0](https://www.embarcadero.com/images/dm/technical-papers/bill-inmon-data-warehousing-2-0-whitepaper.pdf)、[Bill Inmon: A Tale of Two Architectures](https://williaminmon.substack.com/p/a-tale-of-two-architectures-kimball)

## 5. Kimball との比較

CIF は全社統合の責務を正規化した EDW に置く。Kimball のバスアーキテクチャは業務プロセス単位のファクト表を段階的に提供し、複数のファクト表に共通の適合ディメンションを使って横断分析を成立させる。両者とも共有の定義で統合する設計で、統合を担う構造と公開までのデータ経路が異なる。

出典 [Bill Inmon: A Tale of Two Architectures](https://williaminmon.substack.com/p/a-tale-of-two-architectures-kimball)、[Kimball Group: Enterprise Data Warehouse Bus Architecture](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/kimball-data-warehouse-bus-architecture/)

## 6. 実装例 PostgreSQL の統合 EDW と公開スキーマ

PostgreSQL に入力、統合 EDW、業務別の公開スキーマを用意し、段階的に統合と配信を試す実装例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 注文システム・顧客マスター・返金システム | landing スキーマの 3 ソース表 | 注文・顧客・返金のエクスポートを、元のキーのまま別テーブルで受け取る。 |
| ソース統合 ETL | 統合 ETL の SQL | 顧客キーを対応表で引き、注文・明細・返金を反映する。 |
| 統合 EDW（3NF） | edw スキーマの正規化表 | 顧客、注文、明細、返金に主キーと外部キーを設定する。 |
| マート作成処理 | マート用の SQL リフレッシュ処理 | 統合 EDW を読み、用途別の粒度を再生成する。 |
| 営業マート | sales.order_line マテリアライズドビュー | 注文明細の粒度で地域と受注金額を提供する。 |
| 経理マート | finance.daily_amount マテリアライズドビュー | 日別・通貨別に注文金額と返金額を提供する。 |
| 統合とマート更新の起動 | Amazon EventBridge Scheduler、Amazon ECS on AWS Fargate、Amazon ECR | 定期起動したタスクが ECR のイメージを使って RDS に接続する。 |

公開時は EDW に登録済みのデータで両マートを計算する。マテリアライズドビューの更新には再計算が必要なので、翌日到着した返金をどのタイミングで公開するか決める。

Amazon RDS for PostgreSQL 16 の単一データベースに `landing`、`edw`、`sales`、`finance` のスキーマを用意する。Amazon EventBridge Scheduler が起動する ECS の Fargate タスクは、入力表に登録済みのバッチを取り込み、EDW への統合をコミットしてから営業・経理マートを更新する。スケジュールの起動権限と、RDS への接続および DB 内での更新権限を分ける。

公開ビューは PostgreSQL の `REFRESH MATERIALIZED VIEW` で再計算する。並行読み取りを保つために `CONCURRENTLY` を選ぶ場合は、ビューが初期投入済みで、全行を対象とする列ベースの一意インデックスを持つことが前提になる。運用では入力バッチ ID で再実行を判定し、EDW とマートの更新状況を記録する。

- [RDS for PostgreSQL への接続](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ConnectToPostgreSQLInstance.html)
- [EventBridge Scheduler で ECS タスクを実行](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/tasks-scheduled-eventbridge-scheduler.html)
- [ECS の Fargate タスク定義と ECR からのイメージ取得](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html)
- [PostgreSQL 16 の REFRESH MATERIALIZED VIEW](https://www.postgresql.org/docs/16/sql-refreshmaterializedview.html)

出典 [Bill Inmon: Data Warehousing 2.0](https://www.embarcadero.com/images/dm/technical-papers/bill-inmon-data-warehousing-2-0-whitepaper.pdf)、[Bill Inmon: A Tale of Two Architectures](https://williaminmon.substack.com/p/a-tale-of-two-architectures-kimball)、[Kimball Group: Enterprise Data Warehouse Bus Architecture](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/kimball-data-warehouse-bus-architecture/)、[PostgreSQL CREATE TABLE](https://www.postgresql.org/docs/current/sql-createtable.html)、[PostgreSQL CREATE MATERIALIZED VIEW](https://www.postgresql.org/docs/current/sql-creatematerializedview.html)

Scheduler が ECS RunTask を呼び、Fargate の顧客管理ローダーが Secrets Manager の DB 資格情報を使い RDS に接続する。入力の配送方式は固定していない。AWS はサービス基盤を運用し、利用者はジョブ・SQL・データ・アクセス権を設定する。Fargate や RDS の内部ホストは直接操作しない。公式資料を組み合わせた例で、この SQL と認証構成は未検証。[ECS Secrets Manager](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html)、[AWS shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
