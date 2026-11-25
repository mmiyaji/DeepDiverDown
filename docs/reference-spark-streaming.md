# Spark Streaming（DStreams）：旧 API のバッチ間隔処理と復旧

## 1. 読み方と範囲

Kafka などから受け取ったイベントを StreamingContext が時間間隔ごとの RDD 列として処理し、集計結果を保存する旧 DStream API の例を示す。

出典 [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)

## 2. 入力 DStream

受信ストリームは DStream になり、内部では連続する RDD の系列として表現される。Kafka 連携などは別ライブラリを明示的に追加して使う。

出典 [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)

## 3. StreamingContext とバッチ間隔

StreamingContext がバッチ間隔を定め、各間隔で生成された RDD に変換を適用する。`start` 後はストリーミング計算が継続し、`awaitTermination` などで待機する。

出典 [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)

## 4. 変換と集計

map や reduceByKey などの変換で各 RDD を処理し、状態を持つ変換では過去のバッチの結果を更新する。これは Structured Streaming のテーブルモデルとは異なる。

出典 [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)

## 5. 出力

`foreachRDD` などの出力操作で各バッチを外部システムへ保存する。出力の重複や冪等性はアプリケーションと保存先の設計に依存する。

出典 [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)

## 6. チェックポイントと復旧

信頼できるファイルシステムにチェックポイントディレクトリを設定すると、状態や進捗を保存できる。ドライバー障害時はチェックポイントから StreamingContext を再生成する。

出典 [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)

## 7. シナリオ

「DStream のバッチ処理と復旧」シナリオをクリックすると、入力 RDD、変換、出力、チェックポイント再開を追える。

## 8. 実装例：DStreams のファイル入力と HDFS

既存の DStreams アプリが新しいファイルを監視し、区間ごとに RDD を処理する例。メタデータや必要な RDD 状態のチェックポイントには HDFS を使う。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| Input Stream | HDFS 入力ディレクトリー | 新しいファイルを監視するファイル入力を使う。 |
| ストリーミング処理の調整役、区間ごとのデータ集合 | Driver 内の StreamingContext と DStream | 処理間隔と変換グラフを持ち、バッチごとの RDD 処理を起動する。 |
| 分散バッチの実行担当 | Spark Executor JVM | 分散 RDD の変換を実行する。 |
| Batch Output、復旧用の状態保存先 | HDFS 内の出力とチェックポイント | 結果とメタデータ・状態は別ディレクトリーに書く。 |

実装で加わる部品を以下に示す。

- バッチ間隔の設定。アプリケーションで処理間隔を決め、入力到着速度と変換処理時間を照合する。

公式資料

- [Spark Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming-programming-guide.html)

## 9. 実装例：AWS の EMR on EC2 / YARN

DStreams の既存アプリを Amazon EMR の EC2 クラスタに Spark step として投入する例。YARN cluster mode の Driver は StreamingContext と DStream の定義を持ち、YARN コンテナーの Executor は Kafka Direct API で Amazon MSK のトピックを読み、RDD の変換を実行する。結果とチェックポイントは S3 の別パスに保存する。EMR の primary / core ノードは EC2 上で動作する。図は単一クラスタの概念配置で、Driver が常に primary ノードで動くとは仮定しない。

| 機能 | 担い手 |
| --- | --- |
| 入力 | Amazon MSK と DStreams Kafka 0.10 Direct API |
| 処理の調整・DStream | YARN cluster mode の Spark Driver |
| 分散処理 | YARN コンテナーの Spark Executor |
| 出力・復旧 | S3 の別々の出力パスとチェックポイントパス |
| 実行基盤 | Amazon EMR、EC2、YARN |

Kafka 用の `spark-streaming-kafka-0-10` は Spark・Scala・EMR のバージョンに合うものを用意する。IAM、ネットワークと MSK 認証も構成する。チェックポイントからの復旧にはアプリの再起動が必要であり、同じチェックポイントからコード変更後に復旧できるとは限らない。出力は少なくとも一度の実行を前提に冪等性やオフセット管理を設計し、exactly-once を自動的に保証しない。

出典：[Spark Streaming と Kafka](https://spark.apache.org/docs/3.5.7/streaming-kafka-0-10-integration.html)、[Spark Streaming チェックポイント](https://spark.apache.org/docs/3.5.7/streaming-programming-guide.html)、[EMR のノード](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-master-core-task-nodes.html)、[EMR Spark step](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-spark-submit-step.html)。

## 10. 実装例：AWS の EKS / Spark on Kubernetes

EKS の Kubernetes API に Spark アプリを投入し、EC2 マネージドノードグループ上に Driver Pod と Executor Pod を配置する例。Driver が Executor Pod を要求し、Executor は DStreams Kafka Direct API で MSK を読み処理する。結果とチェックポイントは S3 の別パスとする。これは通常の Spark on Kubernetes の例であり、EMR on EKS の課金・管理機能を暗黙には利用しない。

| 機能 | 担い手 |
| --- | --- |
| 入力 | Amazon MSK と DStreams Kafka 0.10 Direct API |
| 処理の調整・DStream | Spark Driver Pod |
| 分散処理 | Spark Executor Pod |
| 出力・復旧 | S3 の別々の出力パスとチェックポイントパス |
| 実行基盤 | EKS の Kubernetes API と EC2 ノードグループ |

Spark と Kafka 連携ライブラリーを含むイメージ、Kubernetes のサービスアカウント・権限、MSK / S3 接続を用意する。Driver Pod の再起動、チェックポイントの利用、出力の冪等性、オフセットとコード更新の扱いは別途設計する。DStreams の例であり、EMR Serverless の Structured Streaming 専用 streaming job を示すものではない。

出典：[Spark on Kubernetes](https://spark.apache.org/docs/3.5.7/running-on-kubernetes.html)、[Spark Streaming と Kafka](https://spark.apache.org/docs/3.5.7/streaming-kafka-0-10-integration.html)、[EKS マネージドノードグループ](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)。

AWS のマネージド範囲を 3D 図に表示する。「AWS管理」は表示したサービス基盤に AWS の運用範囲があることを示し、設定・データ・権限を含むすべてを AWS が担う意味ではない。「共同管理」はマネージドノードグループなど役割が分かれる場合、「利用者管理」は Spark アプリなど利用者が主に運用する部品を示す。詳しい分担は各部品を選択して確認する。

[AWS 共有責任モデル](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)、[EKS マネージドノードグループ](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)、[EMR のセキュリティ](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-security.html)。

自前例は Linux ホスト群で Spark Standalone の Master と Worker を運用し、cluster モードの Driver と Executor を Worker に配置する。HDFS は別の自前クラスターとし、NameNode・DataNode の具体的な配置や冗長化は未指定である。AWS 例はいずれも公式資料を組み合わせた代表構成であり、実際の導入事例や動作検証済み構成ではない。EKS の制御プレーンは AWS が運用し、利用者は Kubernetes API とクラスタ設定を操作できるが、制御プレーンサーバーには直接アクセスしない。EMR・Spark・Kafka ライブラリーの個別バージョン互換性やチェックポイントの S3 利用を含めた実際の動作は未検証である。

- [Spark Standalone Mode](https://spark.apache.org/docs/latest/spark-standalone.html)
- [HDFS Architecture](https://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-hdfs/HdfsDesign.html)

AWS の2例は実行ノードと MSK を同じ利用者 VPC に置く選択例とし、S3 および AWS 管理の EKS 制御プレーンとは区別する。サブネット、セキュリティグループ、S3 経路と認証の具体的設定は未指定である。
