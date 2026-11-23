# Parquet ファイルの内部：フッターからページまで

## 1. 目的と前提

[物理ファイルフォーマット](reference-file-formats.md) の Parquet を 1 ファイルの単位までドリルダウンし、読み手がどのバイト範囲をどの順に取るかを追う。オブジェクトストレージ上のファイルを、範囲 GET（HTTP の Range 指定）で読む前提とする。サイズや個数は説明用の例で、実際の値は書き手の設定による。出典 [Parquet File Format](https://parquet.apache.org/docs/file-format/)

## 2. ファイルのバイト配置

```text
┌ 先頭 "PAR1"（4 バイトのマジック）
├ Row Group 0
│   ├ 列チャンク a ─ [辞書ページ] [データページ] [データページ] …
│   ├ 列チャンク b ─ …
│   └ 列チャンク c ─ …
├ Row Group 1 …
├ （任意）ブルームフィルター、Column Index、Offset Index
├ フッター FileMetaData（Thrift Compact で符号化）
├ フッター長（4 バイト、リトルエンディアン）
└ 末尾 "PAR1"（4 バイト）
```

ヘッダーは 4 バイトのマジックだけで、**ファイルの説明はすべて末尾のフッターにある**。書き手は Row Group を先頭から流し書きし、最後に各位置が確定してからフッターを書く。この「後ろにメタデータ」の配置のため、読み手はまず末尾を読む。

## 3. フッター（FileMetaData）

フッターには次が入る。

- スキーマ（列の型・入れ子・繰り返し）と総行数
- Row Group ごとの `RowGroupMetaData`：行数、バイト数、各列チャンクの `ColumnMetaData`
- `ColumnMetaData`：圧縮コーデック、使ったエンコーディング、値の数、圧縮後／圧縮前のサイズ、**データページと辞書ページの開始オフセット**、min/max・null 数などの統計
- 任意の索引の位置：`column_index_offset`・`offset_index_offset`、`bloom_filter_offset`
- key-value メタデータ（書き手の情報、Arrow のスキーマなど）

フッターは Row Group と列の数に比例して大きくなる。列が数千あるテーブルや Row Group が多すぎるファイルでは、フッターの読み込みとデコード自体が無視できないコストになる。

## 4. 読み取りの順序

1. **末尾を読む**：ファイルサイズ（Iceberg なら Manifest に記録済み）から末尾 8 バイト（フッター長＋`PAR1`）を範囲 GET する。実装の多くは、余分に末尾 数十 KB〜数 MB をまとめて取り、フッターが収まれば 1 往復で済ませる。
2. **フッターをデコード**：スキーマと全 Row Group の位置・統計を得る。
3. **Row Group を選ぶ**：述語と列統計（min/max・null 数）を照らし、範囲外の Row Group を捨てる。等値検索ではブルームフィルターを読んで「確実に無い」Row Group を捨てる。
4. **ページを選ぶ**：Column Index（ページごとの min/max）と Offset Index（ページの位置と先頭行番号）があれば、残った Row Group の中でも必要なページだけを範囲 GET する。
5. **列チャンクを取る**：必要な列だけ、必要な範囲を範囲 GET する。近い範囲はまとめて 1 回の GET にする実装が多い。
6. **ページをデコード**：ページヘッダーを読み、解凍し、レベルと値をデコードする。

出典 [Parquet Page Index](https://parquet.apache.org/docs/file-format/pageindex/)、[Parquet Bloom Filter](https://parquet.apache.org/docs/file-format/bloomfilter/)

## 5. 列チャンクとページ

列チャンクはページの並びで、それぞれのページの先頭にページヘッダー（種類、圧縮前後のサイズ、値の数、エンコーディング）がある。

- **辞書ページ**：列チャンクの先頭に最大 1 つ。値の種類が少ない列では、値の一覧を辞書ページに一度だけ書き、データページには辞書番号を RLE／ビットパッキングで書く。辞書が大きくなりすぎると、書き手は途中から辞書を使わない（PLAIN など）エンコーディングに切り替える。
- **データページ**：繰り返しレベル、定義レベル、値の 3 部分。v1 ではまとめて圧縮し、v2 ではレベルを圧縮せず分けて置くので、値を解凍せずに null や配列境界を判断できる。
- **圧縮はページ単位**：ページを取れば単独で解凍できる。これがページ単位の読み飛ばしと範囲 GET を可能にしている。

出典 [Parquet Data Pages](https://parquet.apache.org/docs/file-format/data-pages/)、[Parquet Encodings](https://parquet.apache.org/docs/file-format/data-pages/encodings/)

## 6. 入れ子の型：繰り返しレベルと定義レベル

構造体・配列・マップは、葉の列ごとに平らにして保存する。各値に、**定義レベル**（どの深さまで値が存在するか＝null の位置）と、**繰り返しレベル**（どの深さで新しい繰り返しが始まるか＝配列の境界）を付けて、元の入れ子を復元できるようにする（Dremel 方式）。必須の平らな列ではどちらも 0 なので省略される。

## 7. サイズの勘所

| 単位 | 大きすぎると | 小さすぎると |
|---|---|---|
| ファイル | 並列度が下がる、書き込みが遅い | Manifest とフッター読み取りが増える |
| Row Group | 分割点が減り並列度が下がる、メモリを食う | フッターが肥大、統計の管理コスト |
| ページ | 読み飛ばしの粒度が粗い | ページヘッダーと索引の割合が増える |

Iceberg の既定では Row Group は 128 MB、ページは 1 MB が目安（`write.parquet.row-group-size-bytes`、`write.parquet.page-size-bytes`）。

## 8. シナリオの見方

- `open-file`：末尾 8 バイト→フッター→スキーマと位置を得る。
- `prune-and-read`：統計とブルームフィルターで Row Group を捨て、ページ索引で必要なページだけ取ってデコードする。
- `point-lookup`：ID の等値検索で、min/max では捨てられない Row Group をブルームフィルターで捨てる。

## 9. 実装例：S3 上の Parquet を Trino Hive で読む

Trino Hive カタログから S3 の Parquet ファイルを読む例。索引の動作はファイルの書き手、利用できる統計、述語、読取側の設定に依存する。

| 機能 | 実装での担い手 | 配置・設定 |
| --- | --- | --- |
| 列データの読み取り役、列データの解凍・復号 | Trino Worker の Parquet Reader | 対象の列、行グループ、索引が使えるページを見つけ、取得したデータを解凍して復号する。 |
| Header "PAR1"、Row Groups、Column Chunks、Bloom / Column / Offset Index、Footer (FileMetaData)、Footer length + "PAR1"、Dictionary Page、Data Pages | S3 上の Parquet オブジェクト | ファイルの末尾と各区画を同じオブジェクト内に保持する。辞書や索引は存在する場合に使う。 |

実装で加わる部品を以下に示す。

- Hive カタログの読取設定。Parquet の列索引やブルームフィルターを使用する設定を確認する。

公式資料

- [Parquet File Format](https://parquet.apache.org/docs/file-format/)
- [Parquet Page Index](https://parquet.apache.org/docs/file-format/pageindex/)
- [Parquet Bloom Filter](https://parquet.apache.org/docs/file-format/bloomfilter/)
- [Parquet Data Pages](https://parquet.apache.org/docs/file-format/data-pages/)
- [Trino object storage file formats](https://trino.io/docs/current/object-storage/file-formats.html)
- [Trino Hive connector](https://trino.io/docs/current/connector/hive.html)
