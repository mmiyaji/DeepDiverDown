# SQLMesh の SQL 変換と仮想データ環境

## 1. 概要
SQLMesh は SQL または Python で書いたモデルをデータウェアハウスで実行する、Python 製のデータ変換フレームワークである。CLI、ノートブック、Python API から使う。GitHub のリポジトリは Apache License 2.0 で、README は dbt との後方互換をうたい、Linux Foundation のプロジェクトだと記している。取得日は 2026年11月28日。最新版の番号は取得したページに記載がなく未確認。

- [SQLMesh の概念の概要](https://sqlmesh.readthedocs.io/en/stable/concepts/overview/)
- [SQLMesh の GitHub リポジトリ](https://github.com/TobikoData/sqlmesh)

## 2. モデルとプロジェクト
1 つのモデルが 1 つのテーブルまたはビューを作る。モデルの本体は SQL または Python で、名前などのメタデータを持つ。プロジェクトには `config.yaml` または `config.py` が必要で、`model_defaults` に既定の SQL 方言を指定する。設定は環境変数、`~/.sqlmesh` の設定、プロジェクトの設定の順に優先される。

- [設定ガイド](https://sqlmesh.readthedocs.io/en/stable/guides/configuration/)

## 3. プランと適用
`sqlmesh plan [環境名]` は、手元のプロジェクトと対象環境の差分を示すプランを作る。環境名を省略すると prod が対象になる。プランは直接変更されたモデルと間接的に影響を受けるモデルを区別し、計算が始まる前に必要な処理を示す。適用（apply）でその計算を実行する。

変更は次のように分類される。
- breaking：直接変更したモデルと下流のモデルを再計算する。WHERE 句の変更が例。
- non-breaking：直接変更したモデルだけを再計算する。列の追加が例。
- forward-only：prod の既存の物理テーブルをそのまま使い、再計算しない。開発環境の出力はプレビュー用で、prod には再利用されない。

バックフィルは、新しいバージョンの物理テーブルをモデルの日付範囲で埋める処理である。

- [プランの概念](https://sqlmesh.readthedocs.io/en/stable/concepts/plans/)

## 4. 仮想データ環境
変更のたびに、モデルの新しいバージョン（スナップショット。固有のフィンガープリントを持つ）が専用の物理テーブルに作られる。環境は、これらのバージョンと物理テーブルへの参照の集まりである。環境どうしは、安全な範囲で同じテーブルを共有する。

再計算が不要でデータの欠けがない場合、プランは仮想更新（Virtual Update）になり、参照の付け替えだけで済む。prod への昇格は、開発環境で計算済みのテーブルへ prod の参照を向け直す操作で、データの移動と停止を伴わない。スナップショットの命名規則と参照ビューの作り方の詳細は取得した資料になく未確認。

## 5. 実行と状態の管理
状態（バージョンと処理済みの区間）は、既定ではウェアハウス内の `sqlmesh` スキーマに置く。ゲートウェイは `connection`（ウェアハウス）、`state_connection`（状態の保存先）、`test_connection`、`scheduler` を束ねる。既定のスケジューラーは `builtin` で、既存の SQL エンジンをメタデータとプラン実行に使う。本番ではウェアハウスと状態に同じ接続を使うことは推奨されず、状態には Postgres が推奨されている。DuckDB、MySQL、MSSQL は使えるが検証が少なく、ClickHouse、Spark、Trino は状態の保存先として未対応と記載されている。

- [設定ガイド](https://sqlmesh.readthedocs.io/en/stable/guides/configuration/)

## 6. テストと監査
テストは入力データと期待する出力を与えてモデルのコードを検証する単体テストで、プランの適用時または `test` コマンドで走る。監査は実データに対する SQL で、0 行を返すべきクエリである。モデルのメタデータで指定し、適用時または `audit` コマンドで走る。

- [SQLMesh の概念の概要](https://sqlmesh.readthedocs.io/en/stable/concepts/overview/)

## 7. 実装例：自前の CI ホスト、PostgreSQL のウェアハウスと状態
| 機能 | 具体的な担い手 |
| --- | --- |
| モデル定義、プラン、スケジューラー、テスト・監査 | CI ホスト上の SQLMesh（Python）と `config.yaml` |
| SQL の実行、物理テーブル、環境の参照 | ウェアハウス用の PostgreSQL サーバー |
| 状態 | 別の PostgreSQL サーバー（`state_connection`） |
| 開発者、下流の利用者 | 枠の外のクライアント |

利用者が自前のサーバーで SQLMesh、PostgreSQL、OS を運用する構成。ウェアハウスと状態を別サーバーに分けるのは、同じ接続を本番で使わない推奨に沿った例である。Postgres は設定ガイドが対応エンジンと状態の保存先に挙げているが、この組み合わせの動作は未検証で、導入事例ではない。マネージド版（Tobiko Cloud など）は取得した資料に記載がなく未確認のため、実装例にしていない。
