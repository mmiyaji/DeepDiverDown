# RisingWave：バリアとチェックポイント・復旧

docs.risingwave.com の公式ドキュメントを基準に、Barrier で checkpoint を作り、障害後に再開する流れと、Sink へ配信するタイミングを追う。前提は「Hummock ストレージとコンパクション」。

## 1. 対象と前提

- 対象は Barrier・checkpoint・復旧・Sink の commit 間隔・Meta のバックアップ。
- 資料は復旧の手順（どの checkpoint を選ぶか、所要時間）を詳述していない。資料にある範囲だけを書く。Epoch は確認した資料で定義されていないため、概念として説明しない。

## 2. Barrier と checkpoint

- RisingWave は Chandy–Lamport アルゴリズムで checkpoint を作る。checkpoint はシステム全体の一貫した状態のスナップショットである。
- **Barrier**：ストリームのデータフローに定期的に注入される同期の印。データと一緒に演算子を通り、状態の書き出しと checkpoint の完了を揃える。
- Meta が Barrier を注入する。Streaming Node は状態を commit し、Barrier を下流へ渡す。すべての Barrier が集まり、状態がオブジェクトストレージへアップロードされると、一貫した checkpoint が完了する。
- `barrier_interval_ms` の既定は 1000（1 秒ごとに Barrier）。`checkpoint_frequency` の既定は 1（Barrier ごとに checkpoint）。`ALTER SYSTEM SET` で全体に、`ALTER DATABASE` でデータベースごとに設定できる。資料は、遅延・スループット・負荷に影響するため、多くの利用者は既定値を使うよう勧める。

## 3. 状態の永続化

- Compute は、直近の checkpoint 以降の変更（dirty state）をメモリにバッファする。バッファがしきい値を超えるか、checkpoint が作られると書き出す。
- checkpoint では、演算子の差分の状態と出力結果が、耐久性のあるリモートストレージ（S3 互換・GCS・HDFS など）に永続化される。
- メモリは主にキャッシュとして働く。メモリが多いほどキャッシュが効く。

## 4. 障害からの再開

- 障害後、Meta が最後の checkpoint から Actor を作り直す。
- `RECOVER` は、ストリーミング実行の復旧を手動で起動する。処理が一時的に止まりうる。状態ストアへの未書き込みが溜まっているクラスタでは、長くかかることがある。
- `DROP` と `CANCEL JOBS` は Barrier と同期して効くため、Barrier の遅延が大きいと反映が遅れる。
- どの checkpoint から再開するか、復旧の所要時間、Source の読み取り位置の戻し方は、確認した資料に記載がない（未確認）。

## 5. Sink への配信

- Sink デカップルは、Sink と出力先の間にバッファ用のキューを挟み、遅い出力先が RisingWave に影響しにくくする。資料は全 Sink で既定で有効と述べる。
- checkpoint は約 1 秒ごとだが、デカップルした Sink は 10 checkpoint（約 10 秒）ごとに commit する（`commit_checkpoint_interval`）。デカップルしない Sink は checkpoint ごと、Iceberg は既定で 60 checkpoint ごと。出力先に見えるまで 10〜60 秒かかりうる。
- 配信の保証：exactly-once は Iceberg（`is_exactly_once = true`、既定。Sink デカップルが前提）。Kafka（非トランザクション）・Kinesis・Elasticsearch・NATS は at-least-once。append-only の Sink は重複しうる。upsert の Sink は主キーで重複を除く。

## 6. Meta のバックアップ

- meta snapshot は、ある時点の Meta のデータのバックアップ。オブジェクトストレージに置く。`risectl meta backup-meta` などで要求したときだけ作られ、組み込みのスケジューラはない。
- SST のファイルは複製されない。保存先は `backup_storage_url` と `backup_storage_directory` で、未設定なら state store の URL と `{data_directory}/backup`。
- 復元では、全ノードを停止し、空の meta store を用意して `risectl meta restore-meta` を実行する。同じ SST に対して 2 つのクラスタを動かしてはならない。

## 7. 実装例：AWS の EKS・S3

「RisingWave の基本アーキテクチャ」と同じ AWS 構成。Meta Pod が Barrier の注入と checkpoint の確定、復旧の開始を担い、Compute Pod の Actor と Sink のバッファが動く。checkpoint の状態と meta snapshot は S3 に保存する例とする（snapshot の保存先は既定で state store の URL 配下）。

| 機能 | 担い手 |
| --- | --- |
| Barrier の注入・checkpoint の確定・復旧 | Meta Pod |
| 最上流の Actor・Actor・未保存の状態・Sink のバッファ | Compute Pod |
| checkpoint の永続化・meta snapshot | Amazon S3 |
| 出力先 | 外部システム（実行場所は未選定） |
| メタデータ | RDS for PostgreSQL（実装で加わる部品） |

Meta が S3 へ snapshot を書く経路は、この例で加えた接続であり、権限を含む詳細は未確認。図は公式資料を組み合わせた代表例で実動作は未検証。Meta を 2 台にする場合の切り替えは未確認。

## 公式資料

- [RisingWave · Data persistence](https://docs.risingwave.com/reference/data-persistence)
- [RisingWave · Architecture](https://docs.risingwave.com/get-started/architecture)
- [RisingWave · Key concepts](https://docs.risingwave.com/reference/key-concepts)
- [RisingWave · FAQ (using RisingWave)](https://docs.risingwave.com/faq/faq-using-risingwave)
- [RisingWave · Sink data from RisingWave](https://docs.risingwave.com/delivery/overview)
- [RisingWave · Meta backup](https://docs.risingwave.com/operate/meta-backup)
