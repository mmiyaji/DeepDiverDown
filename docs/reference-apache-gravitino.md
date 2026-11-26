# Apache Gravitino のフェデレーションメタデータカタログ

2026 年 11 月時点。参照した資料は GitHub main の docs（バージョン表記は 2.0.0-SNAPSHOT）で、リリース版との差は未確認。

## 1. 題材と範囲

Gravitino は、異なるソース・種類・リージョンのメタデータをその場で管理するフェデレーションメタデータレイクである。データやメタデータを移さず、カタログを束ねて 1 つの入口にする。

[Apache Gravitino ドキュメント](https://raw.githubusercontent.com/apache/gravitino/main/docs/index.md)

## 2. メタレイクとサーバー API

メタレイクはメタデータ管理の最上位の単位で、カタログを含む。管理者とコネクタは Gravitino サーバーの API を通じて操作する。メタレイクの内部構造の詳細は今回確認していない（未確認）。

## 3. 束ねるカタログ

| 種類 | 対象 |
| --- | --- |
| リレーショナル | Hive、Iceberg、MySQL、PostgreSQL、Paimon、Hudi、Doris、Hologres、StarRocks、Lakehouse generic（OceanBase と ClickHouse は標準配布物に含まれず catalogs-contrib） |
| メッセージング | Kafka |
| ファイルセット | ストレージ上のファイル群 |
| モデル | モデルカタログ（図では省略） |

## 4. アクセス制御

ユーザー・グループ・ロール・権限・セキュアブルオブジェクト・オーナーで構成する。権限はロール経由でのみ付与し、既定は拒否で、DENY は ALLOW に優先する。`gravitino.authorization.enable`（既定 false）で有効にし、`serviceAdmins` の管理者がメタレイクを作る。既定の判定は JcasbinAuthorizer で、Apache Ranger などへ判定を委ねる構成もある。認証は simple（評価用）、basic、OAuth、Kerberos。制約：列単位の制御はなく、ノード間の変更反映に最大でポーリング間隔（既定 3 秒）かかる。

[アクセス制御](https://raw.githubusercontent.com/apache/gravitino/main/docs/security/access-control.md)

## 5. エンジンからの接続

コネクタは Trino、Spark、Flink、Daft が公式資料の目次にある。各コネクタが対応するカタログと機能差は未確認。Gravitino は Iceberg REST カタログサービスとしても動作する。配置形態、バックエンド、Iceberg REST 経由の認可と一時認証情報は未確認で、図の該当の接続には「未確認」と付した。

## 6. シナリオの見方

「複数カタログを 1 つのメタレイクから使う」はコネクタ経路、「Iceberg REST で接続する」は REST 経路を追う。例のデータは説明用。

## 7. 実装例：自前環境

社内のサーバーに Gravitino（Java 17 が必要）を置き、既存の Hive Metastore・RDB・Kafka・HDFS を束ねる。

| 機能 | 担い手 |
| --- | --- |
| 管理者 | 運用者（REST API または CLI） |
| クエリエンジン | Trino / Spark / Flink |
| サーバー API・メタレイク・アクセス制御・各カタログ | Gravitino サーバー |
| Iceberg REST | Iceberg REST サービス（配置形態は未確認） |
| 外部のメタデータとデータ | Hive Metastore・RDB、Kafka、HDFS など |

公式資料を組み合わせた説明用の構成で、動作検証はしていない。メタデータ自体の保存先、リネージ、高可用性構成は未確認。
