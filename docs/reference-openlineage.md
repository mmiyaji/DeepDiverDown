# OpenLineage の基本アーキテクチャ

## 1. 読み方と範囲

受注原本から日次売上までの2つの変換 Job と、その実行時に送られる RunEvent を追う。OpenLineage の Job、Run、Dataset の関係を教材用に単純化している。

出典 [OpenLineage Object Model](https://openlineage.io/docs/1.47.0/spec/object-model/)

## 2. Dataset と Job

Dataset は処理の入力または出力となるデータを表し、Job は Dataset を消費・生成する定義済みの処理を表す。原本、明細、日次売上を別 Dataset として扱う。

出典 [OpenLineage Object Model](https://openlineage.io/docs/1.47.0/spec/object-model/)

## 3. 変換の流れ

整形 Job が受注原本を読み明細を生成し、集計 Job が明細を読み日次売上を生成する。複数 Job の観測をつなぐことで lineage graph を構成できる。

出典 [OpenLineage Object Model](https://openlineage.io/docs/1.47.0/spec/object-model/)

## 4. RunEvent

RunEvent は Job の実行時に送る状態更新で、通常は START と COMPLETE などを含む。各イベントには Job、Run、入力 Dataset、出力 Dataset を含められる。

出典 [OpenLineage Object Model](https://openlineage.io/docs/1.47.0/spec/object-model/)

## 5. 収集と利用

実行基盤やクライアントが RunEvent を収集先へ送る。JobEvent や DatasetEvent は設計時のメタデータ更新であり、Run に結び付く RunEvent とは用途が異なる。

出典 [OpenLineage Object Model](https://openlineage.io/docs/1.47.0/spec/object-model/)

## 6. シナリオ

「原本から日次売上までの lineage」シナリオをクリックすると、Dataset、変換 Job、RunEvent の START/COMPLETE を順に追える。

## 7. 実装例：Apache Spark・Marquez

OpenLineage の Spark Listener から、Docker で起動した Marquez へ HTTP で実行イベントを配信する例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| 受注原本 Dataset | 入力 Parquet（受注原本） | Spark が読み取る入力データセット。 |
| 整形 Job・集計 Job | Apache Spark（整形・集計） | 両方の変換を同じ実行基盤で動かす。 |
| 受注明細 Dataset | 中間 Parquet（受注明細） | 整形結果を次の集計処理が読む。 |
| 日次売上 Dataset | 出力 Parquet（日次売上） | 集計ジョブの出力データセット。 |
| RunEvent 収集先 | Marquez API | OpenLineage RunEvent を HTTP で受信する。 |
| 実装で追加 | OpenLineageSparkListener | Spark の実行情報からイベントを組み立てる。 |
| 実装で追加 | Marquez Web UI | 実行単位のメタデータから、ジョブとデータセットの関係を確認できる。 |

公式のローカル試行構成では Spark と Jupyter、および Marquez の受信 API を用意する。`spark.extraListeners` と HTTP transport を設定し、ジョブの namespace とデータセットの識別子を揃える。

[OpenLineage Object Model](https://openlineage.io/docs/1.47.0/spec/object-model/)、[OpenLineage Getting Started](https://openlineage.io/getting-started/)、[Using OpenLineage with Spark](https://openlineage.io/docs/1.54.0/guides/spark/)
