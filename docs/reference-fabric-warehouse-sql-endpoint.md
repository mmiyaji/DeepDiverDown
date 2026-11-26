# Microsoft Fabric：Warehouse と SQL 分析エンドポイント

2026 年 11 月時点の公式資料に基づく。

## 1. 二つの SQL 項目

Fabric には T-SQL で使う項目が二つある。Warehouse は読み書きでき、SQL 分析エンドポイントは Delta テーブルを読むだけである。どちらも同じ SQL エンジンで動き、Lakehouse、Warehouse、ミラーリングデータベース、SQL データベースを作ると SQL 分析エンドポイントが自動で付く。

[Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/data-warehousing)、[SQL analytics endpoint](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-sql-analytics-endpoint)

## 2. 接続

クライアントは TDS で接続し、T-SQL を送る。接続は Warehouse か SQL 分析エンドポイントに渡される。

[SQL analytics endpoint](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-sql-analytics-endpoint)

## 3. Warehouse

Warehouse は DDL・DML とマルチテーブルの ACID トランザクションを持ち、ビュー、関数、ストアドプロシージャを使える。取り込みは COPY INTO、パイプライン、データフロー、CTAS、INSERT..SELECT で行う。データは Delta Parquet で OneLake に保存される。ストレージと計算は分離され、複数データベースをまたぐクエリを使える。

[Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/data-warehousing)

## 4. SQL 分析エンドポイントとメタデータ同期

SQL 分析エンドポイントは、Lakehouse の Tables にある Delta テーブルを検出して T-SQL のテーブルにする。データは変更できない。Spark が Delta テーブルを書くと、変更を検出して SQL 側の定義を更新する。更新を手動で起動する方法もある。Tables の外に置いたテーブルは出ない。Spark で作った外部 Delta テーブルは、ショートカットで Tables に置くと見える。一つのワークスペースに置けるのは Warehouse と SQL 分析エンドポイントを合わせて 150 項目まで。同期の遅延は未確認。

[SQL analytics endpoint](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-sql-analytics-endpoint)

## 5. 権限と容量

SQL 分析エンドポイントに設定した SQL の権限は、そのエンドポイント経由のアクセスにだけ適用され、Spark など他の経路には適用されない。他の経路はワークスペースのロールなどで制御する。計算は容量の CU を消費する。

[SQL analytics endpoint](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-sql-analytics-endpoint)、[Fabric licenses and capacity](https://learn.microsoft.com/en-us/fabric/enterprise/licenses)

## 6. 実装例 Warehouse と Lakehouse を T-SQL で使う

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| クライアント | SSMS・アプリ | TDS 接続 |
| 接続の振り分け | Fabric の SQL エンドポイント | Warehouse か SQL 分析エンドポイントへ |
| 更新できる SQL | Fabric Warehouse | T-SQL のスキーマとデータ |
| 読み取り専用の SQL | Lakehouse の SQL 分析エンドポイント | ビュー、権限 |
| SQL エンジン | Fabric の SQL エンジン | 共通 |
| Delta の保存 | OneLake | Delta Parquet |
| 計算の単位 | Fabric 容量 | CU |

公式資料を組み合わせた代表構成であり、動作検証済みの導入事例ではない。利用者はワークスペースと容量、SQL のスキーマ、ビュー、権限、データを管理する。SQL エンジンやメタデータ同期の内部は Microsoft が運用し、直接操作できない。
