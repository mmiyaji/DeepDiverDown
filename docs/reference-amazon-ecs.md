# Amazon ECS のサービススケジューリング

## 1. クラスターと実行方式

Amazon ECS はクラスター状態を使ってコンテナの配置を決める。長時間稼働する API にはサービススケジューラーを使い、タスクは Fargate、またはクラスターに登録した EC2 コンテナインスタンスで実行できる。Fargate は基盤となるサーバーを利用者が管理せず、EC2 はインスタンスの容量・属性を自分で管理する実行方式である。

出典 [Schedule your containers on Amazon ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/scheduling_tasks.html)

## 2. タスク配置とサービススケジューラー

REPLICA スケジューリングは指定した desired count のタスクを維持する。Fargate ではサービススケジューラーが Availability Zone 間の均衡を試み、EC2 では利用可能な CPU・メモリ・ポートなどを満たすインスタンスを絞り込み、配置戦略・制約を適用して選ぶ。これは「タスクをどの実行基盤へ置くか」という配置メカニズムであり、サービスの desired state を維持するスケジューラーの仕組みとは区別する。

出典 [Amazon ECS service deployment controllers and strategies](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_service-options.html)

## 3. 注文 API のデプロイ

注文 API を ECS Service として登録し、タスク定義、ネットワーク、desired count、ロードバランサー連携を指定する。Fargate なら Fargate capacity provider、EC2 なら登録済みコンテナインスタンスを含む capacity provider を選ぶ。capacity provider strategy は、base と weight により起動先の割合を定める。

出典 [Schedule your containers on Amazon ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/scheduling_tasks.html)・[Amazon ECS service deployment controllers and strategies](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_service-options.html)

## 4. 障害時の置き換え

サービススケジューラーは desired count を保つため、停止・失敗したタスクを置き換える。タスク配置の対象は実行方式と制約に従って再評価される。EC2 の場合は配置戦略がなければ Availability Zone の分散が既定で考慮され、Fargate でも AZ 間の均衡を試みる。

出典 [Amazon ECS service deployment controllers and strategies](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_service-options.html)

## 5. デプロイ更新と確認点

サービス更新では deployment configuration により新旧タスクの置き換え方を制御できる。運用時は desired count、実行方式（Fargate/EC2）、capacity provider、配置制約、Availability Zone の分散を確認する。Fargate は DAEMON スケジューリングをサポートせず、EC2 の DAEMON は各条件適合コンテナインスタンスに 1 タスクを置くため、注文 API の REPLICA と役割が異なる。

出典 [Amazon ECS service deployment controllers and strategies](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_service-options.html)
