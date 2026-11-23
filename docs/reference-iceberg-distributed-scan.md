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
