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
