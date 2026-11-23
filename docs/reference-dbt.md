# dbt の ELT アーキテクチャ

## 1. 範囲
ロード済みの注文データを SQL モデルで staging から mart へ変換し、依存関係と品質テストを実行する流れを示す。

出典 [What is dbt?](https://docs.getdbt.com/docs/introduction)

## 2. 入力とモデル
dbt はウェアハウス内の raw データに対する SQL select を再利用可能なモデルとして管理し、依存関係を DAG として扱う。

## 3. 実行
コンパイルした SQL を対象データプラットフォームで実行し、staging から mart のテーブルやビューを作る。

## 4. テストと文脈
テスト、lineage、契約、メトリクスなどの構造化された文脈が変更影響と品質確認を支える。

出典 [What is dbt?](https://docs.getdbt.com/docs/introduction)

## 5. シナリオ
図は Raw table、dbt project、Model DAG、Warehouse compute、Staging、Mart、Tests の7ノードで、run と test を分けて追う。実行時間やウェアハウス名は未確定とする。

## 6. 参考資料
- [What is dbt?](https://docs.getdbt.com/docs/introduction)
- [Build dbt projects](https://docs.getdbt.com/docs/build/projects)

## 7. 実装例：dbt Core と PostgreSQL

dbt Core を CI ジョブで実行し、PostgreSQL の raw・staging・mart スキーマを使って変換する例。dbt の制御プロセスと SQL を実行するデータベースを分ける。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 変換プロジェクト、モデルの依存グラフ、データの品質検査 | CI 上の dbt Core と dbt-postgres | source と ref から依存順を決め、dbt build でモデル作成とデータテストを実行する。 |
| Raw table、SQL の実行エンジン、整形済み中間データ、分析用の成果物 | PostgreSQL の SQL と三つのスキーマ | raw.orders を読み、staging と mart の関係を定義した SQL で作る。 |

実装で加わる部品を以下に示す。

- profiles.yml の接続プロファイル。アダプターの接続先と出力スキーマなどの実行先を指定する。
- manifest.json。モデル、検査、依存関係を含む解析成果物として保持する。

公式資料

- [What is dbt?](https://docs.getdbt.com/docs/introduction)
- [Connect Postgres to dbt](https://docs.getdbt.com/docs/local/connect-data-platform/postgres-setup)
- [Manifest JSON file](https://docs.getdbt.com/reference/artifacts/manifest-json)

CI は利用者が管理するセルフホストランナー、PostgreSQL は別の利用者管理サーバーとして示す。ランナーの提供製品、ホストの設置先、バージョンと接続経路は固定していない。この組み合わせは動作未検証。

## 8. 実装例：ECS on Fargate の dbt Core と Amazon Redshift

EventBridge Scheduler で ECS タスクを定期起動し、Fargate コンテナ上の dbt Core から Redshift の注文テーブルを変換する。

| 機能 | 担い手 |
| --- | --- |
| 変換プロジェクトと依存グラフ | ECR のイメージに同梱した dbt プロジェクトを、Fargate 上の dbt Core が読み込む。 |
| SQL の実行とデータ保存 | 同じ Redshift データベース内の raw、staging、mart。 |
| 品質検査 | dbt Core がテスト SQL を生成し、Redshift が実行する。 |

この例は OSS の dbt Core を ECS 上で利用者が運用する。dbt Core と互換性のある dbt-redshift をイメージで固定する。EventBridge Scheduler のロールに ECS 起動権限を付与し、タスク実行ロールに ECR と Secrets Manager へのアクセスを付与する。Redshift の専用 DB ユーザーの資格情報をタスクへ渡し、プライベート経路と TLS を使って接続する。DB ユーザーには raw の参照と変換先スキーマへの書き込み権限を割り当てる。

公式資料

- [EventBridge Scheduler による ECS タスクの定期実行](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/tasks-scheduled-eventbridge-scheduler.html)
- [dbt Core の Redshift 接続](https://docs.getdbt.com/docs/local/connect-data-platform/redshift-setup)
- [ECS タスクへの Secrets Manager の値の注入](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html)
- [dbt build コマンド](https://docs.getdbt.com/reference/commands/build)

AWS は Scheduler、ECS、Fargate、ECR、Secrets Manager と Redshift のサービス基盤を運用する。利用者はスケジュール、タスク定義、コンテナ、データ、資格情報と権限を設定する。Fargate の内部ホストへ直接アクセスする構成ではない。公式資料を組み合わせた例であり、実動作は未検証。[AWS 共有責任](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
