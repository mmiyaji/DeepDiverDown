# クラウドのスポット容量と中断への対応

## 1. 対象
クラウドの余剰計算容量を、回収される可能性を受け入れて利用する構成。障害や中断を許容できる処理、再試行、進捗保存、代替容量の確保を組み合わせる。価格と利用可能性は場所・種類・時点によって変わる。

## 2. 機能配置と処理
容量の選択と多様化を行い、通常容量と中断可能な容量にワークロードを配置する。中断通知を受けたら受付停止や処理の中断を進め、進捗を永続化する。管理側は別の容量を確保し、保存済み進捗から処理を再開する。通知・代替容量・正常終了は必ず得られるとは限らないため、突然の停止や再試行にも耐える。

## 3. 各クラウドの違いと注意
AWS EC2 は停止・終了に通常 2 分前の通知を出すがベストエフォートであり、休止は即時に開始する。リバランス推奨は中断通知より早く届く場合があるが、同時になる場合もある。Azure Spot VM の Scheduled Events は退避の少なくとも 30 秒前に Preempt を通知すると説明する一方、作成直後の退避は外部の状態監視も必要。Google Cloud Spot VM は既定で事前通知猶予 0 秒、作成時に 120 秒を指定可能で、別途ベストエフォートの最大 30 秒のシャットダウン期間がある。OCI Preemptible は終了開始の 2 分前にイベントを発行し、インスタンスを終了する。各クラウドの最新の対応リソースと制約を確認する。

単一のスポットプールや通知に可用性を依存させず、複数タイプ・AZ、通常容量、適切なチェックポイント、冪等な再実行を検討する。通常容量への切替も容量不足を解消する保証ではない。状態を VM の一時ディスクだけに置かない。

## 4. 実装例：AWS EC2 Spot と Auto Scaling
複数の EC2 インスタンスタイプを許可した Auto Scaling グループが Spot と On-Demand の混合ポリシーを使用し、ワークロードが S3 に進捗を保存する例。容量リバランスを有効にするとリバランス推奨を受けて代替容量の起動を試みる。中断通知はインスタンスメタデータや EventBridge から確認できるが、通知処理とチェックポイントはアプリ側で実装する。起動成功や中断回避は保証されない。

| 機能 | 担い手 |
|---|---|
| 容量選択と補充 | EC2 Auto Scaling と混合インスタンスポリシー |
| 実行容量 | EC2 Spot / On-Demand |
| 中断処理を開始する通知 | Spot インスタンスの EC2 IMDSv2 |
| 進捗 | アプリが記録する S3 オブジェクト |

Auto Scaling グループには複数 AZ と起動候補の機種を指定し、混合ポリシーで On-Demand の基礎容量と追加容量の割合を決める。Spot 上のアプリは IMDSv2 の `spot/instance-action` を確認して停止処理を始める。通知が来る前から S3 に定期保存し、代替インスタンスでアプリを起動するときに保存済みの進捗を読み戻す。起動テンプレートのインスタンスロールには、使用する S3 オブジェクトへの読み書きを許可する。EventBridge は外部からの観測にも利用できる。

AWS は Auto Scaling・EC2・S3・IAM のサービス基盤を運用する。利用者は Auto Scaling の API で混合ポリシーや容量リバランスを設定し、ゲスト OS、アプリ、チェックポイント、S3 の権限と IAM ロールを管理する。AWS が運用するサービス内部への直接アクセスを前提にしない。Spot の通知はベストエフォートで、容量リバランスによる代替の起動も保証されない。この図は公式資料を組み合わせた代表構成であり、実環境での動作は未検証。

- [EC2 Auto Scaling の混合インスタンスポリシー](https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-mixed-instances-groups.html)
- [EC2 Spot の進捗保存](https://docs.aws.amazon.com/pdfs/whitepapers/latest/cost-optimization-leveraging-ec2-spot-instances/cost-optimization-leveraging-ec2-spot-instances.pdf)

[AWS 中断通知](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-instance-termination-notices.html)、[AWS リバランス推奨](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/rebalance-recommendations.html)、[Azure Spot 退避](https://learn.microsoft.com/en-us/azure/architecture/guide/spot/spot-eviction)、[Google Cloud Spot VM](https://docs.cloud.google.com/compute/docs/instances/spot)、[OCI Preemptible](https://docs.oracle.com/en-us/iaas/Content/Compute/Concepts/preemptible.htm)。
