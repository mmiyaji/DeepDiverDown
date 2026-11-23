# Iceberg の分散スキャン：データ分散とファイル取得

## 1. 目的と前提

Iceberg テーブルを Trino や Spark などの分散 SQL エンジンで検索するとき、性能を左右するのは「どのファイルを読まずに済ませるか（データ分散と絞り込み）」と「残ったファイルをどう分けて並列に取りに行くか（ファイル取得）」の二つである。このリファレンスでは、`events` テーブル（`day(event_ts)` と `bucket(16, user_id)` でパーティション化）を例に、コーディネーターがメタデータだけで読み取り計画を作り、Worker が並列にオブジェクトストレージから必要なバイト範囲だけを取得する流れを追う。

ファイル数、Worker 数、Split サイズ、統計の有無はエンジン設定やテーブル生成条件に依存する。図中の数（6 分割、同時 4 Task など）は説明用の例であり、実環境の値を主張しない。出典 [Iceberg Specification](https://iceberg.apache.org/spec/)

## 2. データ分散：隠しパーティションと変換

Iceberg はパーティション値を利用者に列として書かせず、`day(event_ts)`、`bucket(N, user_id)`、`truncate` などの変換（transform）でソース列から導出する（隠しパーティショニング）。そのため `WHERE event_ts >= TIMESTAMP '...'` のように元の列で書いた述語からも、エンジンがパーティション述語を導出してプルーニングできる。

`bucket` はハッシュでキーを均等に散らし、特定キーへの偏りを抑える。等値検索（`user_id = 42`）では対象の bucket に絞れるが、範囲検索の絞り込みには効かない。パーティション仕様は進化（partition evolution）でき、古い仕様で書かれたファイルと新しい仕様のファイルは、それぞれの仕様に従って絞り込まれる。出典 [Iceberg Partitioning](https://iceberg.apache.org/docs/latest/partitioning/)、[Iceberg Specification - Partition Transforms](https://iceberg.apache.org/spec/#partition-transforms)

## 3. 3 段階のメタデータ・プルーニング

読み取り計画は、ストレージのディレクトリ一覧（LIST）ではなく、メタデータの木をたどって作る。

1. **Manifest List**：スナップショットが参照する Manifest ごとに、パーティション列の要約（下限・上限、null の有無）を持つ。述語と重ならない Manifest は開かずに丸ごと除外する。
2. **Manifest**：データファイルごとのパーティション値と、列ごとの下限・上限、値数、null 数などの統計を持つ。これで述語に合わないデータファイルを除外する。
3. **データファイル内**：Parquet の Row Group 統計やページ索引などで、ファイル内の不要な範囲を読み飛ばす（エンジンとファイル生成条件に依存）。

1 と 2 はコーディネーター側のメタデータ処理であり、オブジェクトストレージへの LIST を避けられることが大規模テーブルでの計画時間の差になる。ソート順（sort order）で書かれたファイルは列統計の範囲が狭くなり、2 と 3 の効果が上がる（[ソートとプルーニング](reference-sorting-pruning.md) 参照）。出典 [Iceberg Specification - Manifests](https://iceberg.apache.org/spec/#manifests)、[Iceberg Performance](https://iceberg.apache.org/docs/latest/performance/)

## 4. Delete ファイルの取り込み

フォーマット v2 以降の行単位の削除・更新は、データファイルを書き換えずに Delete ファイルとして記録できる。位置削除（ファイルパスと行位置）と等値削除（列値の一致）があり、v3 では削除ベクトル（Puffin ファイルのビットマップ）が加わる。計画時に、各データファイルへ適用すべき Delete ファイルを対応づけてスキャンタスクに含め、Worker は読みながら削除行を除く。Delete ファイルが溜まると読み取りごとの突き合わせが増えるため、コンパクションで解消する。出典 [Iceberg Specification - Row-level Deletes](https://iceberg.apache.org/spec/#row-level-deletes)

## 5. Split への分割と Worker への割り当て

残ったデータファイル（と対応する Delete ファイル）は、スキャンタスク（Split）に分けられる。大きいファイルは Manifest に記録された `split_offsets`（Parquet の Row Group 境界など）で分割し、小さいファイルはまとめる。Spark の Iceberg 読み取りでは `read.split.target-size`（既定 128 MB）と、1 ファイルを開く固定コストとみなす `read.split.open-file-cost`（既定 4 MB）でまとめ方を決める。Trino ではコーディネーターが Split を順次生成して Worker に配り続けるため、計画の完了を待たずに読み取りを始められる。

オブジェクトストレージではデータの置き場所と計算ノードが分離しているため、HDFS のような「データのあるノードで処理する」局所性はほぼ前提にならない。どの Worker もどのファイルでも読めるので、割り当ては主に負荷の均等化で決まる。出典 [Iceberg Configuration - Read properties](https://iceberg.apache.org/docs/latest/configuration/#read-properties)、[Trino Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)

## 6. ファイル取得：範囲 GET と列の読み飛ばし

Worker は Parquet ファイルを丸ごとダウンロードしない。まずファイル末尾のフッター（スキーマ、Row Group と列チャンクの位置、統計）を範囲 GET で読み、述語で残った Row Group の、必要な列の列チャンクだけを範囲 GET で取得する（列投影）。ファイルサイズは Manifest に記録されているため、末尾の位置を知るための問い合わせを省ける実装もある。小さな範囲 GET が多すぎると往復待ちが支配的になるため、近い範囲をまとめて読む、フッターをキャッシュするなどの工夫がエンジン側にある。出典 [Apache Parquet - File Format](https://parquet.apache.org/docs/file-format/)

## 7. 性能を壊すもの

- **小さなファイルが多い**：Manifest が肥大して計画が遅くなり、ファイルごとのオープンとフッター読み取りが積み上がる。コンパクション（`rewrite_data_files`）でまとめる。
- **Manifest の断片化**：コミットごとに Manifest が増えると、計画時に読むメタデータが増える。`rewrite_manifests` で整理する。
- **統計が効かない並び**：述語列でソートされていないと、各ファイルの下限・上限が広くなり除外できない。
- **偏った分散**：パーティションや bucket の偏りで一部の Split が大きいと、遅い Task が全体の完了を決める（[シャッフルとスキュー](reference-shuffle-skew.md) 参照）。

出典 [Iceberg Maintenance](https://iceberg.apache.org/docs/latest/maintenance/)

## 8. シナリオの見方

- `pruned-scan`：日付とユーザーで絞った検索。Manifest List → Manifest → Split → 並列の範囲 GET までを順に追う。
- `delete-merge`：Delete ファイルがあるテーブルの読み取り。計画時の対応づけと Worker 側の除外を追う。
- `small-files`：小さなファイルが多い場合に、計画とファイル取得の両方でコストが増える様子を追う。

## 9. 物理ファイルの配置

Iceberg テーブルの実体は、オブジェクトストレージ上のテーブル位置（例 `s3://lake/db/events/`）の下にある 2 種類のファイル群である。

```text
s3://lake/db/events/
├── metadata/
│   ├── 00042-<uuid>.metadata.json      … テーブルメタデータ（JSON。gzip 圧縮も可）
│   ├── snap-<snapshot-id>-<uuid>.avro  … Manifest List（Avro）
│   └── <uuid>-m0.avro                  … Manifest（Avro）
└── data/
    └── event_ts_day=2026-11-01/user_id_bucket=7/
        ├── 00000-12-<uuid>.parquet     … データファイル
        └── 00001-12-<uuid>-deletes.parquet … 位置削除ファイル
```

- データファイルの場所は Manifest に**完全パスで記録**される。ディレクトリ名のパーティション表記は人が見るための慣習で、読み取りはこのパスを使わず、ディレクトリを LIST しない。そのためパーティション仕様を変えても既存ファイルを移動する必要がない。
- `write.object-storage.enabled=true` にすると、パスの先頭にハッシュを入れてファイルを多数のプレフィックスへ散らす。S3 などはプレフィックス単位でリクエスト数の上限があるため、同じ日付ディレクトリに書き込みと読み取りが集中してスロットリングされるのを避けられる。
- コミットは新しい `metadata.json` を書き、カタログのポインタを差し替えることで行う。既存のデータファイルは書き換えない（イミュータブル）ので、読み手は古いスナップショットのファイルを読み続けられる。

出典 [Iceberg Specification - File System Operations](https://iceberg.apache.org/spec/#file-system-operations)、[Iceberg AWS - Object Store File Layout](https://iceberg.apache.org/docs/latest/aws/#object-store-file-layout)

## 10. ファイル形式：メタデータは Avro、データは Parquet

| 層 | 形式 | 理由 |
|---|---|---|
| テーブルメタデータ | JSON | 小さく、コミットのたびに丸ごと書き直す |
| Manifest List / Manifest | Avro（行指向） | 1 エントリ＝1 ファイルの記録を順に読み、統計で除外するため全列を使う。スキーマ付きで進化に強い |
| データファイル | Parquet（既定）／ORC／Avro | 分析は少数の列を大量の行で読むため、列指向の Parquet・ORC が基本。Avro はストリーミングの書き込みなど行単位で扱う用途 |
| Delete ファイル | データと同じ形式／削除ベクトルは Puffin | 位置削除はファイルパスと行位置の列を持つ |

**Parquet の内部構造**は、ファイル → Row Group（行の塊、既定 128 MB 目安：`write.parquet.row-group-size-bytes`）→ 列チャンク → ページ（既定 1 MB 目安：`write.parquet.page-size-bytes`）の入れ子で、末尾のフッターに全 Row Group・列チャンクの位置と統計が入る。§6 の「フッター→必要な列チャンクだけ範囲 GET」は、この構造があるから成り立つ。Row Group は Split の分割点（`split_offsets`）にもなるため、Row Group が大きすぎると並列度が下がり、小さすぎると統計とフッターが増える。

**Avro** はブロック単位で書かれ、ブロック間に同期マーカー（sync marker）がある。途中のバイト位置から読み始めても次のマーカーで同期できるので、分割して並列に読める。

出典 [Iceberg Specification - File Formats](https://iceberg.apache.org/spec/#appendix-a-format-specific-requirements)、[Apache Parquet - File Format](https://parquet.apache.org/docs/file-format/)、[Apache Avro Specification - Object Container Files](https://avro.apache.org/docs/current/specification/#object-container-files)

## 11. エンコーディングと圧縮

Parquet の列データは、まず**エンコーディング**（値の表現を詰める）、次に**圧縮コーデック**（バイト列を縮める）の 2 段で小さくなる。

- **エンコーディング**：値の種類が少ない列は辞書エンコーディング（値を辞書番号に置換）と RLE／ビットパッキング、単調に増える整数や時刻は差分エンコーディング（DELTA_BINARY_PACKED）が効く。ソートして書くと同じ値や近い値が並び、エンコーディングと統計の両方が効きやすくなる。
- **圧縮コーデック**：Iceberg の Parquet 書き込みの既定は **zstd**（`write.parquet.compression-codec`。1.4 以降。以前は gzip）。ほかに snappy・lz4（速いが縮みは小さい）、gzip（縮むが遅い）、無圧縮を選べる。Avro は `write.avro.compression-codec`（既定 gzip）、メタデータ JSON は `write.metadata.compression-codec`（none／gzip）で指定する。
- **圧縮の単位はページ**（Avro はブロック）。ファイル全体を一つの gzip にするわけではないので、圧縮しても列チャンク単位の範囲 GET と Row Group 単位の分割はそのまま使える。CSV を丸ごと gzip した場合のように「分割できない」問題は起きない。
- **トレードオフ**：圧縮率が高いほどストレージから取るバイト数（＝転送時間・料金）が減り、解凍の CPU が増える。オブジェクトストレージ越しの読み取りでは通常転送量が支配的なので、zstd のような高圧縮・高速解凍のコーデックが既定になっている。

出典 [Iceberg Configuration - Write properties](https://iceberg.apache.org/docs/latest/configuration/#write-properties)、[Apache Parquet - Encodings](https://parquet.apache.org/docs/file-format/data-pages/encodings/)、[Apache Parquet - Compression](https://parquet.apache.org/docs/file-format/data-pages/compression/)

## 12. 物理読み取りシナリオの見方

`physical-read` では、Avro の Manifest からデータファイルの完全パスとサイズを得て、Parquet のフッター→Row Group→列チャンク（zstd 圧縮のページ）を範囲 GET し、Worker が解凍・デコードするまでを追う。
