# ストリーム処理の違い

| 観点 | Kafka Streams | Apache Flink | Spark Structured Streaming | RisingWave |
| --- | --- | --- | --- | --- |
| 特徴 | アプリに **組み込むライブラリ** | **状態付き処理** に特化したエンジン | **バッチと同じ API** で書ける | **SQL のマテリアライズドビュー** が自動で更新 |
| 処理の単位 | 入力パーティションごとの **Task** | Operator をつないだ Task を **スロット上の Subtask** で並列実行 | 一定間隔の **マイクロバッチ** | Fragment を並列の **Actor** が実行 |
| 状態の持ち方 | Task ごとの **ローカル状態ストア**（RocksDB など） | **HashMap か RocksDB**。チェックポイントは別の保存先 | Executor の **状態ストア**（RocksDB を選べる） | **Hummock**（LSM）でオブジェクトストレージに保存 |
| 時刻の扱い | stream time と **grace period** | **Watermark** がウィンドウの終端を越えたら確定 | **Watermark** で遅れたデータの待ち時間を決める | `WATERMARK FOR` と **一時フィルター** |
| 障害からの再開 | **changelog Topic を再生** して状態を戻す | **チェックポイント** から状態と Source の位置を戻す | **チェックポイントの offset** から再実行 | 既定 1 秒ごとの **Barrier** で作った checkpoint から再開 |
| 動かし方 | アプリの JVM を **複数起動** して分担 | Standalone・**Kubernetes**・Managed Service for Apache Flink | Spark アプリとして **投入**（EMR・Kubernetes など） | **Kubernetes Operator**・Docker・RisingWave Cloud |

Kafka 本体は処理エンジンではなく、上の 4 つが読み書きする **分散ログ** です。Redpanda は同じ Kafka API を話す別実装のログ基盤で、Kafka と同じ位置に並びます。Apicurio Registry と Karapace は、Kafka に流すメッセージの **スキーマと互換性を管理する台帳** で、処理はしません。

## ログ型のイベント基盤

| 観点 | Apache Kafka | Redpanda |
| --- | --- | --- |
| 特徴 | イベントを Topic に追記して保持する **分散ログ**。処理エンジンではない | **Kafka API 互換** のログ基盤。Seastar でスレッドを **CPU コアに固定** する |
| データモデル・実行モデル | Topic は複数のパーティションに分かれ、パーティションは **追記専用の順序付きログ**。順序が保証されるのはパーティション内だけ。ディスク上のセグメントファイルに保存する | Topic とパーティションの **追記ログ**。順序はパーティション内で保証。ディスク I/O に DMA や XFS のスパースファイルを使う |
| 一貫性・耐久性の仕組み | パーティションごとにリーダーとフォロワーを持つ。`acks=all` は **ISR 全員** が受けるまで待ち、書き込みの継続は `min.insync.replicas` に依存する。fsync の方針は未確認 | **パーティションごとに Raft グループ**。`acks=all` は **レプリカの過半数** が書いた時点で応答する。fsync の方針は未確認 |
| 拡張のしかた | パーティションとリーダーを Broker に分散する。同じグループでは 1 パーティションを同時に 1 Consumer が読む | 階層型ストレージでセグメントを **オブジェクトストレージ** に退避する（エンタープライズ）。Console からのパーティション再割り当てもエンタープライズ |
| 運用の形態 | 自前（KRaft Controller は 3 台か 5 台、専用ノードを推奨）、または Amazon MSK | **自前運用**。Redpanda Cloud の構成は未確認 |
| 得意な用途 | イベントを保持し、複数の Consumer Group が **それぞれの位置** から読む | **Kafka API のクライアントをそのまま使う** イベント基盤 |
| 注意点 | combined モード（Broker と Controller の兼務）は推奨されない。MSK のレプリカの AZ 配置は未確認 | Kafka 互換の範囲は未確認。階層型ストレージ・RBAC・監査ログなど **多くの機能がエンタープライズ限定** |
| ライセンス | 未確認 | **BSL 1.1**（Change Date は 4 年後、Change License は Apache 2.0）。Community Edition は全環境の合計 50 コアまで無償。OSS ではなくソース公開 |

## スキーマレジストリ

| 観点 | Apicurio Registry | Karapace |
| --- | --- | --- |
| 特徴 | **スキーマと API 定義** を共有するレジストリ。Avro・Protobuf・JSON Schema・OpenAPI・AsyncAPI を扱う。Quarkus の Java アプリ | **Confluent 互換** の OSS スキーマレジストリ。Python 製で、Kafka REST Proxy も同梱する |
| データモデル・実行モデル | グループ → アーティファクト → **不変のバージョン**。同じ内容は contentId を共有する。登録前にルール（VALIDITY・COMPATIBILITY・INTEGRITY・GOVERNANCE）を通す | **サブジェクトごとの版管理**。各スキーマに ID が付く。互換モードは NONE から FULL_TRANSITIVE まで 7 種。各プロセスが `_schemas` トピックを読んで状態を持つ |
| 一貫性・耐久性の仕組み | 保存先を選ぶ。H2（既定、再起動で消える）、**PostgreSQL（本番で推奨）**、Kafka（KafkaSQL）、GitOps | Kafka の **`_schemas` トピック** に保存する。書き込みは **primary** が担当し、選出は Kafka のグループで行う |
| 拡張のしかた | app と ui は別 Pod のステートレス構成で、水平に増やせる。SQL では DB 側の複製とフェイルオーバーが要る | primary と replica の構成。`master_eligibility` を `false` にすると待機役になる |
| 運用の形態 | Kubernetes の **Apicurio Registry Operator**、または Docker。認証は OpenID Connect | コンテナイメージで **自前運用**。REST API は Basic / OIDC 認証。マネージド版の構成は未確認 |
| 得意な用途 | Kafka 以外の API 定義も含めたスキーマ管理。`/apis/ccompat/v7` で Confluent のクライアントも使える | **Kafka 中心の環境** で Confluent 互換のレジストリを使う |
| 注意点 | Confluent 互換 API は Schema Linking・Data Contract・KEK/DEK が未対応。複数レプリカで H2 を使ってはならない | `waiting_time_before_acting_as_master_ms`（既定 5000）を低くしすぎると **ID が重複するおそれ**。`/docs` などは認証がかからない |
| ライセンス | 未確認 | Apache License 2.0 |

## ストリーミングデータベース

| 観点 | RisingWave | Materialize |
| --- | --- | --- |
| 特徴 | 取り込んだデータを SQL で増分処理し、**マテリアライズドビューが自動で更新** される。PostgreSQL のプロトコルに対応 | 外部データの変更を **SQL ビューで増分に保つ** ストリーミング DB。pgwire 互換 |
| データモデル・実行モデル | Source・Table・マテリアライズドビュー・Sink。Frontend・Compute・Meta・Compactor の 4 種のノードで動く | clusterd 上でソース・インデックス・マテリアライズドビュー・シンクが動く |
| 一貫性・耐久性の仕組み | 既定 1000 ms ごとの **Barrier** で checkpoint を作る。状態は Hummock（LSM）で **オブジェクトストレージ** に置く。meta store は PostgreSQL・MySQL・SQLite | レプリカは同じ処理を行う **冗長コピー**。結果の保存先と一貫性の保証は未確認 |
| 拡張のしかた | ストレージと計算が分かれていて、Compute を増減できる。Compute 対 Compactor は 2 対 1 が目安 | **クラスタのサイズを上げる**。レプリカを増やしても処理能力は上がらない |
| 運用の形態 | Kubernetes Operator、Docker Compose、RisingWave Cloud | **Kubernetes 上の自前運用**（Operator と Helm チャート）。クラウド版もある |
| 得意な用途 | SQL だけで常に最新の集計表を持つ。CDC や Kafka の入力 | CDC・Kafka 入力の **リアルタイム集計** |
| 注意点 | 大量の全表走査は列指向の形式より不得手。列指向には Iceberg が案内されている | ストレージ構成と一貫性の仕様は未確認。BSL の **使用上限** がある（メモリ合計 24 GiB 未満・ディスク合計 48 GiB 未満） |
| ライセンス | 未確認 | **BSL 1.1**（2030 年 11 月 28 日に Apache License 2.0 へ切り替わる） |

## 選び方

- 既存の Java アプリに、Kafka のデータの集計を足したい → **Kafka Streams**
- 大きな状態を持ち、イベント時刻で正確にウィンドウを切りたい → **Flink**
- 同じ処理をバッチでも動かしたい、Spark の基盤がすでにある → **Spark Structured Streaming**
- SQL だけで、常に最新の集計表を持ちたい → **RisingWave**
- Producer と Consumer の間でスキーマの変更を壊さずに進めたい → **Apicurio Registry**
- Kafka の API のまま、コアごとにスレッドを固定した実装で運用したい → **Redpanda**
- イベントを Topic に保持し、複数の Consumer Group が各自の位置で読む → **Apache Kafka**
- Kafka の `_schemas` トピックに保存する Confluent 互換のレジストリを自前で動かす → **Karapace**
- Kafka の入力を SQL ビューで増分に保ち、クラスタのサイズで能力を決める → **Materialize**

## 公式資料

- [Kafka Streams Architecture](https://kafka.apache.org/44/streams/architecture/)
- [Flink Architecture](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/flink-architecture/)
- [Structured Streaming Programming Guide](https://spark.apache.org/docs/latest/streaming/index.html)
- [RisingWave Architecture](https://docs.risingwave.com/get-started/architecture)
- [Apicurio Registry](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-intro-to-the-registry.html)
- [Apache Kafka Design](https://kafka.apache.org/44/design/design/)
- [KRaft](https://kafka.apache.org/44/operations/kraft/)
- [Redpanda architecture](https://docs.redpanda.com/current/get-started/architecture/)
- [Redpanda Tiered Storage](https://docs.redpanda.com/current/manage/tiered-storage/)
- [Redpanda Licenses and Enterprise Features](https://docs.redpanda.com/current/get-started/licensing/overview/)
- [Apicurio Registry concepts and glossary](https://www.apicur.io/registry/docs/apicurio-registry/3.4.x/getting-started/assembly-registry-concepts-glossary.html)
- [Karapace（GitHub README）](https://github.com/Aiven-Open/karapace)
- [Karapace 公式サイト](https://karapace.io/)
- [RisingWave Source, Table, MV, and Sink](https://docs.risingwave.com/get-started/source-table-mv-sink)
- [Materialize concepts](https://materialize.com/docs/concepts/)
- [Materialize Clusters](https://materialize.com/docs/concepts/clusters/)
- [Materialize LICENSE](https://github.com/MaterializeInc/materialize/blob/main/LICENSE)
