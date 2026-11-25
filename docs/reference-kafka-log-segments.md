# Kafka：パーティションとログセグメント・offset

Apache Kafka 4.4 の公式ドキュメントを基準に、1 つのパーティションのログがディスク上でどう並び、offset で読まれ、削除されるかを追う。前提は「Apache Kafka の基本アーキテクチャ」。

## 1. 対象と前提

- 対象は 1 パーティションのリーダーが持つログ。複製は次の図、Consumer Group の担当割り当ては 3 つ目の図で扱う。
- 図の数値（ファイルサイズ、offset）は説明用。

## 2. パーティションは追記専用のログ

- パーティションは追記だけができる順序付きログで、レコードにはパーティション内で連番の offset が付く。
- Consumer が持つ位置は、パーティションごとに 1 つの整数（次に読む offset）だけ。巻き戻せば読み直せる。

## 3. セグメントファイル

- ログは複数のセグメントに分かれ、ファイル名はそのセグメントの先頭 offset（20 桁）である。最初は `00000000000000000000.log`。
- 末尾の 1 つだけが追記中のアクティブセグメント。`segment.bytes` や `segment.ms` に達すると閉じて、新しいセグメントを作る。閉じたセグメントは書き換えない。
- 各セグメントには、レコードを持つ `.log` のほかに offset の索引（`.index`）と時刻の索引（`.timeindex`）がある。

## 4. 追記と末尾の位置

- Producer のバッチはリーダーのアクティブセグメント末尾（LEO：Log End Offset）に追記される。
- フォロワーが取り込み、ISR 全員が受けたレコードがコミット済みになる。Consumer が読めるのはその範囲まで（High Watermark の手前）。

## 5. offset から読む

- 読み取りは 64 ビットの論理 offset と最大サイズで指定する。
- Broker は、offset を含むセグメントを、メモリ上の範囲の一覧に対する二分探索で探し、ファイル内の位置に直して読む。
- 途中で切れたメッセージはサイズ接頭辞で検出できる。

## 6. 保持と削除

- 削除はセグメント単位。時間による保持（`retention.ms`）は、セグメント内で最大のレコード時刻で判断する。サイズによる保持（`retention.bytes`）は既定で無効で、古いセグメントから消して上限内に収める。両方を有効にすると、どちらかが対象にしたセグメントが消える。
- アクティブセグメントは閉じるまで削除の対象にならない。
- 別の方針として、キーごとの最新値を残すログ圧縮（`cleanup.policy=compact`）がある。offset は変わらず、アクティブセグメントは圧縮しない。

## 7. コミット済み offset の保存

- Consumer Group の進捗は、内部 Topic `__consumer_offsets` に保存される。読んだレコードがすでに保持期限を過ぎて消えると、その位置から読み直せない。
- `auto.offset.reset`（既定 `latest`）は、保存された位置がない・存在しないときの開始位置を決める。

## 8. 実装例：自前 Linux Broker ホストのログディレクトリ

利用者が管理する Linux ホスト 1 台で Broker を動かし、ローカルディスク（`log.dirs`）にセグメントを置く。Producer と Consumer の設置場所は指定せず、Broker に接続する外部クライアントとして示す。Broker が 1 台のため、`offsets.topic.replication.factor=1` で内部 Topic を作成する。

| 機能 | 担い手 |
| --- | --- |
| Producer | KafkaProducer |
| パーティションのリーダー | Kafka Broker プロセス |
| アクティブセグメント・閉じたセグメント | `log.dirs` のローカルディスク上のファイル |
| 保持による削除 | Broker 内のログ管理（`retention.ms` / `retention.bytes`） |
| Consumer と進捗の保存 | KafkaConsumer、Broker 上の `__consumer_offsets` |

ディスクの種類、容量、ファイルシステム、複数ディレクトリの使い分けは未指定。図は公式資料を組み合わせた例で、実環境の動作は未検証。

- [Kafka Log Implementation](https://kafka.apache.org/44/implementation/log/)
- [Topic Configs](https://kafka.apache.org/44/configuration/topic-configs/)
- [Broker Configs](https://kafka.apache.org/44/configuration/broker-configs/)

## 未確認

- `.index`・`.timeindex` のファイル形式と索引の間隔は、確認した Implementation のページに記載がなく未確認。
- High Watermark という語の定義の出典は今回確認していない。複製の仕組み（コミット済みの範囲）は Design のページに基づく。
- `segment.bytes`、`segment.ms`、`retention.ms` の既定値は本文に書いていない（Topic Configs で確認する）。

## 公式資料

- [Kafka Log Implementation](https://kafka.apache.org/44/implementation/log/)
- [Apache Kafka Design](https://kafka.apache.org/44/design/design/)
- [Topic Configs](https://kafka.apache.org/44/configuration/topic-configs/)
- [Consumer Configs](https://kafka.apache.org/44/configuration/consumer-configs/)
