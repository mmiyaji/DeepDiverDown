# Spark と Apache Celeborn のリモートシャッフル

## 1. 対象と位置付け

Spark の join、groupBy、repartition などでは、map 側の中間データを下流の partition ごとに再分配する。通常の shuffle は Executor ホストのローカルディスクに map 出力を置き、下流が取得する。Spark の External Shuffle Service（ESS）は各計算ノード上の長時間プロセスとして Executor 終了後も同じローカルファイルを提供する。ホスト・ディスク障害からの独立は保証しない。shuffle tracking はデータを持つ Executor を維持する方式、decommission はブロックを移動する方式で、いずれも別の選択肢である。

Celeborn は Spark の ShuffleManager を差し替え、計算側と別の Worker 群で shuffle データを管理するサービス。Spark の DAGScheduler や SQL 演算そのものを置き換えるわけではない。Celeborn の push ベースの書き込みは Spark 標準の push-based shuffle（Spark 4.2.1 の資料では YARN の ESS に限定）と別機能である。Real-Time Mode の streaming shuffle との組み合わせは本資料では互換性未検証で、同一視しない。

## 2. 制御プレーンと配置

Spark Driver 内の LifecycleManager は shuffle の登録、partition の場所、成功した map attempt、コミット状態を保持する。Executor ごとの ShuffleClient はデータの push と取得を担う。初回 push で ShuffleClient が登録を要求し、LifecycleManager は Celeborn Master にスロット割り当てを要求する。Master は Worker の資源を管理し、Worker にスロットを予約して PartitionLocation を作る。Master の HA には Raft を利用できる。Master は通常の shuffle データ経路の中継点ではない。

## 3. 書き込み・物理構造

map task はデータを partition 別に分け、ShuffleClient が圧縮・バッファリングして担当 Worker に push する。Worker は同じ reducer partition のバッチをマージしてファイルに書く。Spark 用 ReducePartition ファイルは複数 chunk から成り、メモリ上の index が chunk 開始位置を示す。chunk サイズの既定例は 8 MiB だが設定やバージョンで異なる。push の ACK はディスクへの flush 完了を意味しない。

複製を有効にすると Worker は peer に送信し、peer の ACK を受けてからクライアントに ACK を返す。複製は設定依存であり、常に有効ではない。全 mapper 完了後に LifecycleManager が CommitFiles を送り、Worker はバッファを flush してファイルを閉じる。異なる到着順のため primary と replica の同じ chunk 番号は同一内容とは限らない。

## 4. 読み取りと後片付け

reduce task は LifecycleManager から reducer のファイル位置を取得し、Worker に OpenStream を送って index を取得し、ChunkFetchRequest でデータを読む。shuffle が不要になれば LifecycleManager が解放を依頼し、Worker の領域を後から回収する。保存された中間データは最終結果や恒久的なテーブルではない。

## 5. 障害と重複

push 失敗時は Revive で新しい epoch の PartitionLocation に切り替え、fetch 失敗時は設定された回数の再試行や利用可能な replica への切り替えを行う。ディスク不足・大きな partition では分割される場合がある。map ID・attempt ID・batch ID と成功 attempt の情報を使い、再試行や投機実行による重複を読み取り時に除外する。読み取り失敗や複製喪失など全障害を隠蔽する保証ではなく、復旧不能なら Spark 側の再試行・再計算が必要になる。

## 6. Spark 設定と運用

Spark と Scala のバージョンに対応する Celeborn クライアント JAR を Driver と Executor に配布し、`spark.shuffle.manager=org.apache.spark.shuffle.celeborn.SparkShuffleManager`、`spark.celeborn.master.endpoints` などを設定する。公式手順では Kryo serializer を指定する。リリースごとの対応を確認する。AUTO fallback は Worker 数・quota・partition 数などにより Spark 標準 shuffle を使う可能性があり、NEVER は fallback が必要なら失敗する。動的割り当てでは fallback 時のローカル shuffle 保護、Spark 3.5 以降の CelebornShuffleDataIO、shuffle tracking、ESS、decommission の組み合わせを確認する。

Executor の計算資源と shuffle 容量を別々に調整できる反面、Worker のディスク容量・帯域、ネットワーク、複製コスト、同時利用、監視と cleanup が必要。性能向上はワークロード次第で、追加のネットワーク経路が常に速いわけではない。

## 7. 類似製品と実装例

Apache Uniffle は Coordinator と Shuffle Server を備える別の Remote Shuffle Service。サーバーはデータをマージし、設定によりローカルディスクや HDFS などを使う。Celeborn と API・運用・データ配置を同一とみなさない。

例は自前の Spark Standalone クラスターと独立した Celeborn Master / Worker 群、Worker ローカルディスクを組み合わせた代表構成。実在の導入例や実機検証済み構成ではない。Worker 複製を有効にした例であり、台数、ネットワーク、認証と容量は環境ごとに設計する。Driver＝LifecycleManager、Executor＝map / reduce の ShuffleClient、Master＝配置、Worker＝保存と複製、ディスク＝partition ファイルに対応する。

出典：[Spark Dynamic Allocation](https://spark.apache.org/docs/4.0.0/job-scheduling.html#dynamic-resource-allocation)、[Celeborn Architecture](https://celeborn.apache.org/docs/latest/developers/overview/)、[LifecycleManager](https://celeborn.apache.org/docs/latest/developers/lifecyclemanager/)、[ShuffleClient](https://celeborn.apache.org/docs/latest/developers/shuffleclient/)、[Worker Storage](https://celeborn.apache.org/docs/latest/developers/storage/)、[Fault Tolerance](https://celeborn.apache.org/docs/latest/developers/faulttolerant/)、[Celeborn Spark configuration](https://celeborn.apache.org/docs/latest/deploy/)、[Uniffle architecture](https://uniffle.apache.org/docs/intro/)。
