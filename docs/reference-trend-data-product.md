# データプロダクトの公開と利用

## 1. 対象と動向
ビジネス用途に向けてデータ資産、説明、契約、責任者とアクセス手続きをまとめ、利用者が発見・評価して使えるようにする構成。Gartner は 2025 年の公開発表で利用しやすいデータプロダクトを挙げている。公開発表を参照しており、有料レポート全文は未参照。

## 2. 機能配置と処理
提供側が利用目的に沿ってデータ資産を選び、説明、所有者、更新頻度などの契約条件と利用申請の入口を登録する。利用者はカタログから発見し、内容と契約を確認してアクセスを申請する。承認後、データ資産に付与された権限で利用する。運用チームは実際の品質・鮮度を測定し、期待との差を管理する。

## 3. 設計上の注意
契約の記述は品質監視や条件の自動保証を意味しない。カタログ閲覧権限と実データへの権限を分け、データの更新責任、利用目的、品質の測定方法、権限の解除を決める。資産を論理的にまとめても物理データがコピーされるとは限らない。

## 4. 実装例：Google Cloud Knowledge Catalog と BigQuery
提供側プロジェクトの Knowledge Catalog で、同プロジェクトの BigQuery 管理テーブルを製品の資産に加える。所有者は説明と契約条件をまとめ、申請に使う Google グループを設定する。利用者の申請を所有者がコンソールで承認すると、利用者が Google グループに追加される。グループに設定したテーブル閲覧権限が反映され、利用側プロジェクトでジョブ作成権限を持つ利用者がクエリを実行できる。契約条件の自動測定は別途設計する。

| 機能 | 担い手 |
|---|---|
| 提供するデータ | 提供側 BigQuery 管理テーブル |
| クエリ実行 | 利用側プロジェクトの BigQuery クエリジョブ |
| 登録、契約と申請 | Knowledge Catalog のデータプロダクト |
| データの権限 | 対象資産に適用する IAM とアクセスグループ |
| 管理と利用 | プロダクト所有者と利用者 |

[Gartner 2025 発表](https://www.gartner.com/en/newsroom/press-releases/2025-03-05-gartner-identifies-top-trends-in-data-and-analytics-for-2025)、[Google Cloud データプロダクト](https://docs.cloud.google.com/knowledge-catalog/docs/data-products-overview)、[利用手順](https://docs.cloud.google.com/knowledge-catalog/docs/use-data-products)、[製品とアクセス グループの管理](https://docs.cloud.google.com/knowledge-catalog/docs/manage-data-products)、[BigQuery のクエリ実行](https://docs.cloud.google.com/bigquery/docs/running-queries)。

この構成は公式機能を組み合わせた例であり、実環境での設定、認証、接続と障害復旧は未検証。サービス提供者が基盤を運用し、利用者はデータ、権限とジョブ設定を管理する。内部ホストへの直接アクセスは前提としない。
