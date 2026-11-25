# Flink：ジョブグラフ・Task とスロット

Flink の stable 版ドキュメントを基準に、データフローが TaskManager のスロットで並列に動くまでを追う。前提は「Apache Flink の基本アーキテクチャ」（JobManager と TaskManager の役割）。

## 1. 対象と前提

- 対象は、提出されたデータフローが Task になり、スロットに置かれる流れ。
- 時刻とウィンドウは「Flink：イベント時刻とウォーターマーク・ウィンドウ」、状態の保存は「Flink：状態バックエンドとチェックポイント」で扱う。

## 2. JobGraph と並列度

- クライアントがデータフローを組み立てて提出し、JobMaster が 1 つの JobGraph の実行を管理する。
- 並列度は、Operator・実行環境・クライアント・システムの 4 段階で指定できる。Operator への `setParallelism()` が最優先で、クライアントは CLI の `-p` や REST の `parallelism`、システムは `parallelism.default`。
- 最大並列度（max parallelism）は `setMaxParallelism()` で Operator か実行環境にだけ指定でき、クライアントとシステムには指定できない。状態はキーグループに分けて持たれ、最大並列度が上限になる。既定は並列度の約 1.5 倍で、下限 128、上限 32768。復旧元から最大並列度を変えると状態に互換性がなくなる。

## 3. Operator chaining と Task

- Flink は複数の Operator の Subtask を 1 つの Task にまとめ、1 つのスレッドで動かす。スレッド間の受け渡しとバッファを減らせる。チェーンは設定で変えられる。
- keyBy などの再分配では、Subtask 間がバッファ経由でデータを交換する。

## 4. スロットとスロット共有

- スロットは TaskManager の資源の固定的な分け前で、管理メモリを分けるが CPU は分けない。同じ JVM のスロットは TCP 接続とハートビートを共有する。
- スロット共有（既定）では、同じジョブの異なる Task の Subtask が 1 つのスロットを使える。必要なスロット数は、ジョブの最大並列度と同じになる。重い Subtask が複数の TaskManager に散り、軽い Subtask にスロットが塞がれにくい。

## 5. JobMaster と ResourceManager

- Dispatcher が提出を受け、ジョブごとに JobMaster を起動する。
- ResourceManager が、スロットを含むリソースの割り当てを担う。Standalone では既存の TaskManager のスロットを配るだけ。Kubernetes では、Flink が Kubernetes API で TaskManager Pod を要求する。
- スロット割り当ての詳細なアルゴリズムは未確認。

## 6. Application と Session

- Application クラスタ：`main()` がクラスタ上で動き、寿命がアプリケーションと同じ。native Kubernetes では `--target kubernetes-application` で提出し、終了時に Flink が資源を片付ける（本番に推奨）。
- Session クラスタ：長く動き、提出時にスロットを確保して終了で解放する。資源起動の待ちがない一方、障害の影響が全ジョブに及ぶ。
- native Kubernetes では、JobManager が `kubernetes.cluster-id` の名前の Deployment（restart policy は always）、TaskManager は ResourceManager が Kubernetes API で要求する Pod（restart policy は never）になる。

## 7. シナリオ

クライアントがデータフローを JobGraph にして提出する → JobMaster が ResourceManager にスロットを要求する → スロットが確保され Subtask がデプロイされる → Subtask がスロットで動き、再分配でデータを交換する。

## 8. 実装例：EKS 上の Application モード（native Kubernetes）

EKS のノード上で、Flink が Kubernetes API を直接使って JobManager Pod と TaskManager Pod を動かす。

| 機能 | 担い手 |
| --- | --- |
| クライアント | Flink CLI（`--target kubernetes-application`） |
| JobGraph・Dispatcher・JobMaster・ResourceManager | JobManager Pod（Deployment） |
| スロット・Subtask・データ交換 | TaskManager Pods |

加わる部品は EKS の Kubernetes API と EC2 ノード。API の呼び出しには、サービスアカウントに Pod の作成・削除の RBAC 権限が要る。ジョブの JAR はイメージに入れるか、成果物として配る。イメージの置き場所、台数、ノードサイズは未確認。AWS が EKS 制御プレーンと EC2 基盤を運用し、利用者が Flink の設定・イメージ・ジョブ・並列度を管理する。実動作は未検証。

## 公式資料

- [Flink · Flink Architecture](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/flink-architecture/)
- [Flink · Parallel Execution](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/execution/parallel/)
- [Flink · Native Kubernetes](https://nightlies.apache.org/flink/flink-docs-stable/docs/deployment/resource-providers/native_kubernetes/)
- [Amazon EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
