# Apache Flink の基本アーキテクチャ

## 1. 読み方と範囲

Kafka の受注イベントを Flink の並列ストリーム処理で読み、イベント時刻の窓集計を出力する。演算子と配置は説明用の構成である。

出典 [Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)・[Timely Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/)

## 2. Source とデータフロー

Source がイベントを読み、演算子間のデータフローへ渡す。Kafka のように位置を戻せるソースはチェックポイントからの再開に利用できる。

出典 [Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)

## 3. イベント時刻とウォーターマーク

イベントに含まれる時刻を基準に処理し、ウォーターマークがイベント時刻の進行を知らせる。遅れて届くイベントを扱うため、処理時刻とは区別する。

出典 [Timely Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/)

## 4. 状態付き窓演算子

キー付き演算子は集計状態を保持し、窓が閉じると結果を Sink へ送る。並列サブタスクはキーグループを分担する。

出典 [Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)

## 5. チェックポイント

チェックポイントは入力位置と各演算子の状態を一貫したスナップショットにする。失敗時は最新の成功チェックポイントからデータフローを再配置する。

出典 [Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)

## 6. 出力と復旧

Sink は集計結果を下流へ書く。復旧時は状態を復元し、ソースをチェックポイント位置へ戻して処理を続ける。実際の保証は Sink のコネクター設定にも依存する。

出典 [Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)

## 7. シナリオ

「イベント時刻の窓集計と復旧」シナリオをクリックすると、Source、ウォーターマーク、状態、Sink、チェックポイント復帰を追える。

## 8. 実装例：Flink・Kafka・永続チェックポイント

Kafka の時刻付きイベントをキー別の窓で集計する Flink ジョブ。選んだ状態バックエンドとチェックポイントの保存先は独立に指定する。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 再読できるイベント入力 | Flink KafkaSource と注文トピック | 入力の Kafka パーティションと読み取り位置を管理する。 |
| イベント時刻の進捗生成、窓集計の実行 | TaskManager 上の時刻処理と Window Operator | WatermarkStrategy と窓処理をフローの実行タスクに組み込む。 |
| キー別の作業状態 | EmbeddedRocksDBStateBackend | TaskManager のローカルディスクを利用し、キー別状態を持つ。 |
| 永続チェックポイント | HDFS のチェックポイントディレクトリー | ファイルシステム型のチェックポイント保存先にする。 |
| 結果の出力先 | Kafka の出力トピック | KafkaSink で窓集計の結果を書き込む。 |

実装で加わる部品を以下に示す。

- JobManager のチェックポイント調整。チェックポイントを開始し、各タスクから完了確認を集める。

公式資料

- [Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)
- [Timely Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/)
- [Flink Checkpointing](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/fault-tolerance/checkpointing/)
- [Flink State Backends](https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/state/state_backends/)

## 9. 実装例：Amazon EMR on EKS の Flink・MSK・S3

Flink Kubernetes Operator で EKS 上に Application モードの Flink ジョブを展開する例。MSK の受注を集計し、別のトピックへ出力する。

| 機能 | 担い手 |
| --- | --- |
| 再読可能な入力と結果出力 | MSK の注文トピックと集計トピック。 |
| イベント時刻と窓集計 | TaskManager Pod 上の KafkaSource、ウォーターマーク生成、窓演算子。 |
| キー別の作業状態 | TaskManager の組み込み RocksDB 状態バックエンド。 |
| チェックポイントと復旧 | JobManager が調整し、S3 に保存した最新の成功点からタスクを復元する。 |

EKS の EC2 ノードグループで、Flink Kubernetes Operator と EMR ランタイムを使う Flink Pod を同じ名前空間に配置する。EKS の Kubernetes API へ `FlinkDeployment` を適用し、JobManager と TaskManager のリソースを指定する。Kubernetes HA を有効にし、S3 のチェックポイントと HA メタデータを別のプレフィックスに保持する。Flink のサービスアカウントに S3 への IAM アクセスを割り当て、EKS ワークロードから MSK へのプライベート接続と認証を構成する。

公式資料

- [EMR on EKS で Flink アプリケーションを実行する](https://docs.aws.amazon.com/emr/latest/EMR-on-EKS-DevelopmentGuide/jobruns-flink-kubernetes-operator-run-application.html)
- [EMR on EKS の Flink Operator を準備する](https://docs.aws.amazon.com/emr/latest/EMR-on-EKS-DevelopmentGuide/jobruns-flink-kubernetes-operator-setup.html)
- [EKS マネージドノードグループ](https://docs.aws.amazon.com/eks/latest/userguide/create-managed-node-group.html)
- [Flink の Kubernetes HA](https://docs.aws.amazon.com/emr/latest/EMR-on-EKS-DevelopmentGuide/jobruns-flink-using-ha.html)
- [Flink の状態バックエンド](https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/state/state_backends/)
- [MSK クライアントのアクセス](https://docs.aws.amazon.com/msk/latest/developerguide/client-access.html)

自前例は Linux ホスト群上の Flink Standalone JobManager と TaskManager、別の自前 Kafka と HDFS を前提とする。KafkaSource は TaskManager で動作する。ホスト数、HDFS の可用性と詳細なネットワークは未指定である。AWS 例は公式資料を組み合わせた代表構成であり、動作検証済み事例ではない。AWS が EKS 制御プレーンと EC2・MSK・S3 の基盤を運用し、利用者は Kubernetes API、ノード、Operator、ジョブ、状態と権限を管理する。制御プレーンサーバーへの直接アクセスは想定しない。Flink・Kafka コネクター・EMR のバージョン互換性は未検証。

- [Flink Standalone Deployment](https://nightlies.apache.org/flink/flink-docs-stable/docs/deployment/resource-providers/standalone/overview/)

図では EKS ワーカーノードと MSK ブローカーを同一の利用者 VPC に置く例を選ぶ。EKS 制御プレーンは AWS 管理であり、図の VPC 内にあるワーカーノードとは運用境界が異なる。セキュリティグループ、サブネット、S3 への経路と MSK 認証は利用者が設定する。

- [EKS VPC とサブネット](https://docs.aws.amazon.com/eks/latest/userguide/network-reqs.html)
