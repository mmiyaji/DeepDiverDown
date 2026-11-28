# Redpanda の Kafka 互換ログ基盤

Redpanda 公式ドキュメント（2026年11月28日取得、docs 版 26.3、最新タグ v26.3.1）を基準に、Kafka API のクライアントから書き込まれたイベントが、ブローカーのログと複製、階層型ストレージに置かれるまでの主要な部品を示す。

## 1. 対象と読み方

- Redpanda は Kafka API で接続するイベントのログ基盤。イベントは Topic に入り、Topic はパーティションに分かれる。
- 図は部品の関係を示す。台数・配置は説明用の例。
- 取得した資料に記載が無い点は「未確認」とした。

## 2. Kafka API とスレッドモデル

- Producer と Consumer は Kafka API で接続する。両者は分離され、Consumer は非同期に読む。
- ブローカーは Seastar ライブラリでアプリケーションのスレッドを CPU コアに固定する。スレッド間はメッセージ渡しで通信し、コンテキストスイッチとほとんどのロックを避ける。
- ディスク I/O に DMA、XFS のスパースファイルなどを使い、起動時のチューナーがハードウェアに合わせて設定を調整する。

## 3. パーティションごとの Raft

- 各パーティションが 1 つの Raft グループで、リーダー 1 つとレプリケーション係数に応じたフォロワーを持つ。2f+1 台で f 台の障害に耐える。
- リーダーは 150 ms ごとにハートビートを送る。`election_timeout_ms` の既定は 1500 ms。
- `acks=all`（-1）では、レプリカの過半数が書いた時点でリーダーが応答する。少数の遅いレプリカはクライアントの待ち時間を増やさない。
- キーが同じイベントは同じパーティションに入り、順序はパーティション内で保証される。キーなしはラウンドロビン。

## 4. コントローラー

- Topic やユーザーの作成などのメタデータ変更は、コントローラーパーティションを通る。これは全ブローカーを含む Raft グループ。
- スナップショットは既定で有効で、各ブローカーがコントローラーのログディレクトリに保存する。
- 取得した資料のこの箇所に ZooKeeper と KRaft の記載は無い。

## 5. ローカルログ

- イベントはディスク上のログファイルに追記され、フォロワーへ複製される。
- fsync の方針は取得した資料に記載が無く、未確認。

## 6. 階層型ストレージ

- ログセグメントを Amazon S3、Google Cloud Storage、Azure Blob Storage などに退避する。エンタープライズライセンスが要る。
- パーティションのリーダーが、Consumer が読める範囲（last stable offset 未満）のセグメントを順次アップロードする。アップロード済みになるまでローカルのセグメントは削除されない。
- ローカルに無いオフセットは、同じ Kafka API の要求でオブジェクトストレージから取得され、ローカルキャッシュに置かれる。
- `retention.ms` と `retention.bytes` がオブジェクトストレージ側の保持を決め、ローカル用の保持設定は別にある。
- 有効化と無効化を繰り返すとデータに欠落が出うる。バケットのライフサイクルルールで Redpanda が書いたオブジェクトを消さない。

## 7. Console とライセンス

- Redpanda Console は管理用の UI。認証、認可（RBAC）、デバッグバンドル生成、パーティション再割り当ては、エンタープライズのライセンスキーが要る。
- 公式のライセンス概要では、Community Edition は Redpanda Community Edition License の下で、全クラスター・全環境の合計 50 コアまで本番を含めて無償。サポートは含まない。Enterprise Edition はライセンスキーが要り、50 コアの上限が外れる。26.3 から、有効なライセンスが無く 50 コアを超えるクラスターはエンタープライズ機能の利用として扱われる。
- エンタープライズ機能（クラスター）には、階層型ストレージ、監査ログ、RBAC、Continuous Data Balancing、Leader Pinning、Remote Read Replicas、Shadowing、Iceberg Topics、FIPS、Kerberos、OIDC などが挙がっている。
- ソースの Business Source License 1.1 は、ライセンサーが Redpanda Data, Inc.。追加の使用許諾は「Streaming or Queuing Service」への利用を除き自由で、Change Date はリリースから 4 年後、Change License は Apache License 2.0。この License と Community Edition License の関係は未確認。
- Apache 2.0 のオープンソースではなく、ソース公開（source-available）のライセンスとして扱う。

## 8. 実装例：自前の Linux 上の 3 ブローカー構成

利用者が管理するデータセンター（オンプレミス）で、ブローカーがコントローラーとパーティションのリーダー・フォロワーを兼ねる構成。図は 2 台に省略している。

| 機能 | 担い手 |
| --- | --- |
| クライアント | Kafka API を使うアプリケーション |
| ブローカー、コントローラー、リーダー | Linux ホスト上の Redpanda ブローカー 1 |
| フォロワー | ブローカー 2 |
| ログ | ブローカーのローカルディスク |
| 階層型ストレージ | オブジェクトストレージ（稼働環境の外） |

ホスト、ディスク、更新、バケットは利用者が運用する。公式資料を組み合わせた代表例で、動作検証済みの導入事例ではない。

## 未確認

- Schema Registry と HTTP Proxy の構成と配置。
- fsync の方針と書き込み確認の既定値。
- Community Edition License と Business Source License 1.1 の関係。
- マネージド版（Redpanda Cloud）の構成。
- 個別のクライアント・ツールごとの Kafka 互換の範囲。

## 公式資料

- [Redpanda architecture](https://docs.redpanda.com/current/get-started/architecture/)
- [Tiered Storage](https://docs.redpanda.com/current/manage/tiered-storage/)
- [Redpanda Licenses and Enterprise Features](https://docs.redpanda.com/current/get-started/licensing/overview/)
- [Licensing](https://docs.redpanda.com/current/get-started/licensing/)
- [Business Source License](https://github.com/redpanda-data/redpanda/blob/dev/licenses/bsl.md)
