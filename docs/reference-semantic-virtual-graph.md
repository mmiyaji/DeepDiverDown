# RDB から仮想ナレッジグラフへの対応付け

## 1. 対象
DWH などの関係データを、業務概念に対応する RDF グラフとして参照する構成。実体のコピーを保持する方式と、元のデータベースを問い合わせる仮想方式を区別する。

## 2. 機能配置と処理
設計者がテーブル・列と概念・プロパティの対応、主キーなどから作る IRI のルールを定義する。R2RML はリレーショナルデータから RDF データセットへの対応を表す標準である。利用者の SPARQL を、対応定義と利用可能な語彙を基に関係データへの問い合わせへ変換し、結果を RDF の用語として返す。実体化方式では生成結果を別途保存できる。

## 3. 設計上の注意
仮想グラフでは一般にデータが元のデータソースに残る。R2RML 仕様自体は仮想化・実体化のいずれも許容し、SPARQL から SQL への変換を全実装に要求するものではない。元 DB の権限、SQL の実行負荷、NULL と型、IRI の安定性、データ更新時の意味を検討する。対応定義だけで指標の計算ルールやアクセス制御が完成するわけではない。

## 4. 実装例：Ontop とリレーショナル DB
Ontop は R2RML 対応定義と軽量オントロジーを利用して仮想グラフを公開し、SPARQL を元の関係データベースに対する SQL に変換する。DB は任意の対応データソースの例であり、ホスティング先や具体的なアクセス権は環境に依存する。Ontop の対応範囲には製品固有の制約があり、すべての SPARQL または OWL をサポートすると仮定しない。

| 機能 | 担い手 |
|---|---|
| 元データ | 対応するリレーショナル DB |
| 対応と概念 | R2RML マッピングと RDFS / OWL 2 QL 定義 |
| 仮想問い合わせ | Ontop SPARQL エンドポイントと SQL 変換 |
| 利用 | SPARQL クライアント |

[W3C R2RML](https://www.w3.org/TR/r2rml/)、[Ontop Introduction](https://ontop-vkg.org/guide/)。

## 5. 実装例：AWS（Ontop on ECS・RDS for PostgreSQL）

Ontop と PostgreSQL JDBC ドライバー、R2RML マッピング、OWL 定義を含むコンテナイメージを Amazon ECR に登録する。Amazon ECS サービスが AWS Fargate 上のタスクの指定数を維持する。Ontop は同じ VPC にあるプライベートな RDS for PostgreSQL に接続する。

| 機能 | 担い手 |
|---|---|
| 設計と配布 | 設計者が管理する R2RML と OWL を含む Amazon ECR のイメージ |
| SPARQL 受付と SQL 変換 | Fargate タスク上の Ontop |
| 元の表と SQL 実行 | Amazon RDS for PostgreSQL |
| 問い合わせ | SPARQL クライアントと内部 Application Load Balancer |

内部ロードバランサーは IP 型のターゲットグループで Fargate タスクへ転送する。タスクのセキュリティグループから RDS の PostgreSQL ポートへのアクセスを許可する。DB の資格情報はイメージに含めず、起動時に設定する。この例では対象の表またはビューを参照する読み取り専用の DB ユーザーを使用する。Ontop がリクエストごとに SQL を発行して、結果を SPARQL の応答として返す。

- [Ontop コンテナの構成](https://ontop-vkg.org/tutorial/endpoint/endpoint-docker.html)
- [Ontop の PostgreSQL 接続](https://ontop-vkg.org/guide/databases/postgres)
- [ECS の Fargate タスク定義](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html)
- [ECS の Fargate ネットワーキング](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html)
- [RDS for PostgreSQL の接続](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ConnectToPostgreSQLInstance.html)

上記は公式機能を組み合わせた構成例であり、実機での接続、認証、セキュリティ設定、障害復旧は未検証。利用者がアプリ、設定、データと権限を管理し、AWS がマネージドサービスの基盤を運用する。内部ホストへの直接操作を前提としない。
