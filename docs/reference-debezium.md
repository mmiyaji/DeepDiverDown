# Debezium の CDC アーキテクチャ

## 1. 範囲と読み方
PostgreSQL の注文テーブルを初期スナップショットし、その後の変更をログからイベント化して Kafka に届ける例を示す。Debezium は Kafka Connect の Source Connector として動かす構成を中心に扱う。

出典 [Debezium Architecture](https://debezium.io/documentation/reference/stable/architecture.html)・[PostgreSQL connector](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)

## 2. 初期スナップショット
Connector は既存テーブルを読み、後続の変更を取りこぼさない位置まで進める。スナップショットのモードやロックは設定とDBに依存する。

出典 [Snapshot](https://debezium.io/documentation/reference/stable/connectors/postgresql.html#postgresql-property-snapshot-mode)

## 3. 変更ログの捕捉
PostgreSQL の論理レプリケーションを使い、WAL の変更を読み取る。INSERT、UPDATE、DELETE はイベントに変換される。

出典 [PostgreSQL connector](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)

## 4. Kafka への発行
Debezium の Source Task は変更イベントを Kafka topic へ発行する。topic 命名、キー、スキーマ形式は設定・コンバーターに依存する。

出典 [Debezium Architecture](https://debezium.io/documentation/reference/stable/architecture.html)

## 5. 再開位置と障害
コネクターはデータベースのログ位置をオフセットとして保持し、再起動時にその位置から読める。ログ保持期間や重複処理は運用設計で決める。

出典 [Debezium Architecture](https://debezium.io/documentation/reference/stable/architecture.html)・[Kafka Connect User Guide](https://kafka.apache.org/44/kafka-connect/user-guide/)

## 6. シナリオ
機能配置は変更元 DB、論理レプリケーション、CDC コネクター、コネクター実行基盤、CDC イベントの配信先、オフセット、下流のイベント処理を示す。初回同期から継続配信と再開までを追える。イベント遅延や保存先は未確定である。

## 7. 参考資料
- [Debezium Architecture](https://debezium.io/documentation/reference/stable/architecture.html)
- [PostgreSQL connector](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)

## 8. 実装例：AWS
機能配置（§1〜§6）の各機能を AWS のマネージドサービスで組む一例。サービスの選び方は一例で、自前の Kafka Connect（EC2・EKS）や Amazon Aurora PostgreSQL でも同じ機能配置になる。

| 機能 | AWS での担い手 | 補足 |
|---|---|---|
| 変更元の注文 DB・論理レプリケーション | Amazon RDS for PostgreSQL | DB パラメータグループで `rds.logical_replication` を有効にすると、論理レプリケーションを使える。2 つの機能を 1 つのサービスが担う |
| コネクター実行基盤 | MSK Connect | Kafka Connect のワーカーを AWS が管理する。容量はワーカー数・MCU で指定する |
| CDC コネクター | MSK Connect の Debezium コネクター | Debezium のプラグイン（zip）を S3 に置き、カスタムプラグインとして登録する |
| CDC イベントの配信先・CDC オフセット | Amazon MSK | CDC イベントとオフセットを同じクラスター内の別々のトピックに保持する |
| 下流のイベント処理 | AWS Lambda のイベントソースマッピングと関数 | マッピングが MSK のトピックをポーリングして関数を呼び出す |

MSK Connect の Debezium タスクは、VPC の接続用 ENI を介して RDS と MSK に接続する。事前に DB 側の Publication と論理スロットを用意し、`plugin.name=pgoutput` を指定する。Lambda のマッピングはプロビジョンドモードとし、マッピングと関数はそれぞれ別の Lambda 管理 VPC に属する。マッピングは MSK のプライベートサブネットにある Hyperplane ENI を介して接続し、関数呼び出しの接続は Lambda が管理する。図の MSK Connect は利用者 VPC 内の計算基盤を表すものではなく、接続用 ENI を介して利用者 VPC に到達する。

機能配置にはなく、実装で加わる部品：

- Amazon S3：カスタムプラグインの zip を置く。
- AWS Secrets Manager：DB の認証情報をコネクタの設定に直接書かず、設定プロバイダーで渡す。
- Amazon CloudWatch Logs：ワーカーのログの送り先。

出典 [Working with logical replication（Amazon RDS for PostgreSQL）](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.FeatureSupport.LogicalReplication.html)・[MSK Connect](https://docs.aws.amazon.com/msk/latest/developerguide/msk-connect.html)・[MSK Connect のプラグイン](https://docs.aws.amazon.com/msk/latest/developerguide/msk-connect-plugins.html)・[Using Lambda with Amazon MSK](https://docs.aws.amazon.com/lambda/latest/dg/with-msk.html)

- [MSK Connect の認証情報を外部化する](https://docs.aws.amazon.com/msk/latest/developerguide/msk-connect-config-provider.html)
- [MSK Connect のオフセットストレージ](https://docs.aws.amazon.com/msk/latest/developerguide/msk-connect-set-offset-storage-topic.html)
- [MSK Connect のログ](https://docs.aws.amazon.com/msk/latest/developerguide/msk-connect-logging.html)
- [AWS の PostgreSQL CDC 構成例](https://aws.amazon.com/blogs/database/implementing-real-time-change-data-capture-with-debezium-for-amazon-aurora-postgresql-and-amazon-rds-for-postgresql/)
- [MSK Connect のワーカー](https://docs.aws.amazon.com/msk/latest/developerguide/msk-connect-workers.html)
- [Lambda の MSK イベントソースのネットワーク](https://docs.aws.amazon.com/lambda/latest/dg/with-msk-cluster-network.html)

この例は公式資料を組み合わせた代表構成であり、実際の導入事例や動作検証済み構成ではない。AWS が RDS・MSK・MSK Connect・Lambda・S3・Secrets Manager・CloudWatch Logs のサービス基盤を運用する。利用者は DB の論理レプリケーションと権限、コネクターの容量・プラグイン・設定、トピック、Lambda のマッピングと関数コード、認証情報、ログの保持期間を管理する。MSK Connect の内部ワーカーホストや Lambda 管理 VPC を利用者が直接操作する構成は想定しない。設定プロバイダーを Debezium と同じプラグイン ZIP に含め、ワーカー設定と実行ロールの権限および Secrets Manager へのネットワーク到達性を用意する。各バージョンの組み合わせと実際の動作は未検証。
