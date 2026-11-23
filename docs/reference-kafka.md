# Apache Kafka の基本アーキテクチャ

## 1. 分散ログの構成

Kafka はイベントを Topic ごとに保持する。Topic は複数の追記ログ（パーティション）から成り、各パーティションのログを Broker が保持する。この図では Topic `orders` に P0・P1・P2 があり、それぞれのリーダーが Broker 1・2・3 に分散している。複製係数は3の例。Controller はメタデータを管理し、レコードの読み書きは Broker が受け持つ。

出典 [Apache Kafka Design](https://kafka.apache.org/44/design/design/)・[KRaft](https://kafka.apache.org/44/operations/kraft/)

## 2. Producer の書き込み

Producer はパーティションを決め、メタデータからそのリーダーを調べて送信する。図では P0 のリーダー Broker 1 に追記する。キーはパーティション選択に使える。レコードに付くオフセットと読み出し順序はパーティション内で意味を持つ。

出典 [Apache Kafka Protocol](https://kafka.apache.org/44/design/protocol/)・[Producer Configs](https://kafka.apache.org/44/configuration/producer-configs/)

## 3. 複製と書き込み応答

フォロワーはリーダーからログを取得し、自分のコピーに追記する。ISR はリーダーと、リーダーに追随しているレプリカの集合。図の複製の矢印はデータが移る方向を示す。図の例では `acks=all`、`min.insync.replicas=2` とする。成功応答には必要な最小 ISR 数を満たし、その時点の ISR が追記を確認している必要がある。

出典 [Apache Kafka Design](https://kafka.apache.org/44/design/design/)・[Producer Configs](https://kafka.apache.org/44/configuration/producer-configs/)

## 4. Consumer Group の読み出し

Consumer は Broker から自分でデータを取りに行く。通常の Consumer Group では、同一グループ内で1つのパーティションを1つの Consumer が担当する。図では Consumer 1 が P0・P1、Consumer 2 が P2 を担当する。参加者が増減すると割り当てが見直される。別グループは、それぞれの進捗で同じログを読める。

出典 [Apache Kafka Design](https://kafka.apache.org/44/design/design/)

## 5. 進捗の保存と再読込

Consumer は次に読む位置をオフセットとしてコミットできる。リクエストは Group Coordinator の Broker が受け、内部 Topic `__consumer_offsets` に保存する。図では Broker 2 が Coordinator の例。読んだレコードも保持されている間は、位置を戻して読み直せる。

出典 [Apache Kafka Design](https://kafka.apache.org/44/design/design/)・[Apache Kafka Protocol](https://kafka.apache.org/44/design/protocol/)

## 6. リーダー障害からの切り替え

P0 のリーダー Broker 1 が停止し、Broker 2 と Broker 3 が ISR に残っている例。KRaft Controller が Broker 2 を新リーダーに選出する。Producer はメタデータを取得し直し、必要に応じて新リーダーへ再送する。Consumer も新リーダーに接続し直す。書き込みを継続できるかは、新リーダーの選出と残存 ISR が設定を満たすかに依存する。

出典 [Apache Kafka Design](https://kafka.apache.org/44/design/design/)・[KRaft](https://kafka.apache.org/44/operations/kraft/)・[Producer Configs](https://kafka.apache.org/44/configuration/producer-configs/)

## 7. パーティションのログの中身

パーティションは Broker のディスク上で `<topic>-<partition>/` ディレクトリになり、その中は**セグメント**の並びである。各セグメントは先頭オフセット（20 桁）を名前に持つ `.log`（レコードバッチ本体）、`.index`（オフセット → ファイル内位置の疎な索引）、`.timeindex`（時刻 → オフセット）の組で、末尾の 1 つだけが追記中の**アクティブセグメント**になる。`segment.bytes`（既定 1 GiB）や `segment.ms` に達すると閉じて新しいセグメントが始まり、保持期限（`retention.ms`、既定 7 日）や容量上限は**閉じたセグメント単位**で削除される。

ログ上の位置として、末尾の **LEO**（Log End Offset）、全 ISR に複製済みの境界である **High Watermark**、Consumer Group ごとの**コミット済みオフセット**（`__consumer_offsets` に保存）がある。Consumer は High Watermark までしか読めず、コミット済みオフセットと High Watermark の差がコンシューマーラグになる。読み取りは `.index` で開始位置を引き、`.log` を順に読む（多くの場合 OS のページキャッシュから返る）。出典 [Apache Kafka Design](https://kafka.apache.org/documentation/#design)、[Topic Configs](https://kafka.apache.org/documentation/#topicconfigs)

## 8. Consumer Group のリバランスと ISR の追い付き

Consumer Group にメンバーが加わる・抜けると、Group Coordinator がパーティションの担当を割り当て直す（リバランス）。担当が移ったパーティションは、新しい担当がコミット済みオフセットから読み始める。協調的リバランス（CooperativeStickyAssignor）では、動かす必要のある担当だけを移し、他の担当は読み続けられる。複製では、フォロワーがリーダーのログを取り込んで追い付き、遅れすぎたフォロワーは ISR から外れる。リーダーが停止すると、ISR に残るフォロワーが新しいリーダーに選ばれ、外れていたフォロワーは新リーダーから追い付いて ISR に戻る。出典 [Apache Kafka Design](https://kafka.apache.org/documentation/#design)、[Consumer Configs](https://kafka.apache.org/documentation/#consumerconfigs)
