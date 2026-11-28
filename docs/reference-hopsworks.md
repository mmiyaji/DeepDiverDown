# Hopsworks の特徴量ストア（フィーチャーグループ・オンライン／オフライン・書き込み経路・フィーチャービュー）

取得日は 2026年11月28日。Hopsworks の公式ドキュメント（最新版の表示だが、ページ上に最新版ではない旨の注記がある）と GitHub の README に基づく。

## 1. 概要とライセンス・提供形態

Hopsworks は特徴量ストアを中心にした ML 基盤である。特徴量ストアは単独でも使える。モデルの配備には KServe を使い、モデルレジストリは KServe 向けに作られている。ベクトル検索用のインデックスは OpenSearch の kNN を基にしている。マルチテナントのプロジェクト、バージョン管理とリネージ付きの ML 資産、プロジェクト間のデータ共有を備える。Jupyter、Python・Spark のジョブ、Airflow、Git 連携を含むデータサイエンス用の環境も同梱される。

ライセンスは GitHub の README で AGPL-V3 とされている。提供形態は、サーバーレス（ベータ、app.hopsworks.ai）、利用者の AWS・Azure・GCP の環境で動く Managed Hopsworks、自前のハードウェアへのオンプレミス導入の三つが README に記載されている。オンプレミスの最小要件は CentOS/RHEL 8.x または Ubuntu 22.04、32GB RAM、8 CPU、空き 100GB のディスク。エアギャップのデータセンターにも導入できるとされる。商用の有償プランの内容は未確認。

- [Hopsworks の概要](https://docs.hopsworks.ai/latest/concepts/hopsworks/)
- [logicalclocks/hopsworks（GitHub）](https://github.com/logicalclocks/hopsworks)

## 2. フィーチャーグループとオンライン・オフラインのストア

フィーチャーグループは特徴量の表で、主キーと、任意で event_time、パーティションキー、ほかのグループへの外部キーを持つ。これらは索引用の列で、モデルの特徴量には選ばれない。保存するのは変換前のデータで、変換はあとのフィーチャービューが担う。

オンラインストアは RonDB で、既定ではエンティティごとの最新値だけを持つ。event_time と TTL を付けると、1 エンティティに複数行を持てる。埋め込み列があるグループにはベクトルインデックスを付けられる。オフラインストアは履歴を持ち、学習データの作成とバッチ推論の取得元になる。データは通常 Hopsworks 内に置くが、データソース経由で外部のファイルシステムにも置ける。外部のテーブル（Snowflake、BigQuery、Redshift、S3 など）は外部フィーチャーグループとして読み取り専用で接続でき、取り込みや更新はできない。クエリは読み出し時に実行される。

オフラインの形式は、書き込み API の資料が Hudi、概要図が Delta と表記している。版による違いかどうかは未確認。

- [フィーチャーグループの概要](https://docs.hopsworks.ai/latest/concepts/fs/feature_group/fg_overview/)
- [外部フィーチャーグループ](https://docs.hopsworks.ai/latest/concepts/fs/feature_group/external_fg/)

## 3. 書き込み経路

書き込みは 3 種類ある。ストリーム API（Python と Spark）は、まず Kafka のトピックへ書く。Hopsworks が OnlineFS でオンラインストアを更新し、Hudi DeltaStreamer のジョブでオフラインストアへ書く。Kafka は at-least-once で、オンラインは冪等な upsert、オフラインはコミット時の重複除去により、結果は実質 1 回になる。Python クライアントが使えるのはこの API だけで、Spark でもオンラインとオフラインの整合のために推奨されている。

バッチ API（Spark のみ）は Kafka を通さず、HDFS API で Hopsworks 上の Hudi テーブルへ直接書く。大量のバックフィルに向く。Spark クライアントは Hopsworks のデータノードへ到達できる必要がある。コネクタ API は外部テーブルをオフラインのフィーチャーグループとして接続し、データは取り込まない。Flink の対応は取得した資料に記載がなく未確認。

- [書き込み API](https://docs.hopsworks.ai/latest/concepts/fs/feature_group/write_apis/)

## 4. フィーチャービューと推論

フィーチャービューは、複数のフィーチャーグループの特徴量を結合した論理的な入口である。ルートのフィーチャーグループ（教師あり学習ではラベルを持つグループ）から外部キーをたどって結合する。ビュー自身は主キーを持たず、ラベルのグループの外部キーをサービングキーとして使う。学習データは学習・検証・テストに分けて作れ、追加のフィルターは学習データにだけ適用される。オンラインでは、サービングキーを渡して最新値の特徴量ベクトルを得る。

変換関数は個々の特徴量に付き、学習時と推論時で同じ変換が使われる（学習データの統計で fit した値を推論でも使う）。フィーチャーグループは変換前の値を持つため、ビューごとに別の変換ができる。時点で正しい結合の詳細は取得した資料に記載がなく未確認。

- [フィーチャービューの概要](https://docs.hopsworks.ai/latest/concepts/fs/feature_view/fv_overview/)

## 5. モデルの登録と配備

学習したモデルはモデルレジストリに登録し、KServe で配備する。推論リクエストは Kafka に記録でき、モデルのメトリクスは Grafana・Prometheus で見られる。オンライン推論とバッチ推論の両方が概要図に示されている。バッチ推論の手順の詳細は未確認。

## 6. 実装例：自前の Linux 上の Hopsworks（OSS 版）

| 機能 | 具体的な担い手 |
| --- | --- |
| 特徴量パイプライン | Hopsworks 上の Spark・Python のジョブ |
| 書き込みの中継 | Kafka |
| オンラインへの反映 | OnlineFS |
| オフラインへの反映 | Hudi DeltaStreamer ジョブ |
| オンラインストア | RonDB |
| オフラインストア | Hudi テーブル |
| 学習データとベクトルの取得 | フィーチャービュー API |
| 学習 | 学習ジョブ |
| モデルの配備 | モデルレジストリと KServe |

利用者が自前のサーバーで Hopsworks とその基盤を運用する構成。公式資料に基づく代表例であり、導入事例や動作検証済みの構成ではない。ノード数、各コンポーネントの配置、HopsFS の役割は未確認。

## 7. 実装例：利用者のクラウドアカウント上の Managed Hopsworks

README は、Managed Hopsworks が利用者の AWS、Azure、GCP の環境で動くとしている。図は AWS を選んだ代表例で、コンポーネントは自前構成と同じ役割で描いている。クラウド上の具体的なサービス（Kubernetes、ストレージなど）への対応と、提供元と利用者の運用分担は取得した資料に記載がなく未確認。
