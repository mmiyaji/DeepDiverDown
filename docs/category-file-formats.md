# ファイル形式の違い

| 観点 | Apache Parquet | Apache ORC | Apache Avro | Apache Arrow | Vortex | Lance |
| --- | --- | --- | --- | --- | --- | --- |
| 特徴 | **Row Group・列チャンク・ページ** の入れ子で、分析の標準 | **Stripe** 単位で、索引と統計を形式に組み込む | **スキーマ付きの行** をブロックに詰める | **メモリ配置そのまま** の受け渡し形式（IPC） | 圧縮したまま扱える **軽量エンコーディングの入れ子** | **ランダムアクセス** と全体スキャンを両立 |
| 格納の向き | **列** | **列** | **行** | **列** | **列** | **列**（行グループなし） |
| エンコーディング・圧縮 | 辞書・RLE・DELTA などをページ単位で選ぶ。圧縮は snappy・zstd など | 列ごとに RLE v2・辞書を選ぶ。圧縮は zlib・snappy・zstd など | ブロック単位の圧縮。スキーマはヘッダーに持つ | 辞書あり。バッファ単位で lz4・zstd を選べる | FastLanes・FSST・ALP などを入れ子にする | mini-block・full-zip などの構造と、bitpacking・FSST・辞書 |
| 読み飛ばしの仕組み | フッターの統計、ページ索引、ブルームフィルター | ファイル・Stripe・行グループの 3 段の統計 | 同期マーカーでブロックを分割する。統計は持たない | 統計なし。フッターのブロック位置で **バッチ単位に seek** | ゾーンマップとファイル統計（詳細は未確認） | 列メタデータの行番号からページを引く（統計は未確認） |
| 得意な用途 | レイクハウスの **データファイル** | Hive・Trino の分析 | Kafka などの **イベントとメッセージ** | 処理系間の受け渡し、一時データ | オブジェクトストレージ上のスキャンと点読み | 行番号指定の取得、埋め込みや大きなバイナリ |
| 注意点 | 小さいファイルが増えると遅くなる | Parquet より対応エンジンが少ない | 列を絞った集計は不向き | 長期保存・大規模スキャン向けの統計がない | **新しい形式** で、エンジンごとの対応差と性能は未検証 | 2.2 以降の機能は **新しく不安定**。性能値は自己申告 |

CSV・JSON Lines は、スキーマと索引を持たないテキスト形式で、交換や小さなデータに使います。Nimble（Meta）は仕様書を確認できなかったため、図にしていません。

ファイル形式が決めるのは **1 つのファイルの中身** です。複数のファイルをテーブルとして管理する仕組み（スナップショット、マニフェスト、削除ファイル、Iceberg の Puffin など）は、「テーブル形式とカタログ」で扱います。

## 選び方

- レイクハウスのデータファイルにする、迷ったら標準にする → **Apache Parquet**
- Hive・Trino の既存資産で、統計を細かく使う → **Apache ORC**
- イベントやメッセージを、スキーマ付きで行ごとに流す → **Apache Avro**
- 処理系の間でコピーせずに受け渡す → **Apache Arrow**
- 新しい形式を、軽量な圧縮と点読みのために評価する → **Vortex**
- 行番号指定の取得や、埋め込み・大きなバイナリを含むデータ → **Lance**

Vortex と Lance は 2026 年 11 月時点で仕様が動いています。対応エンジンと安定性は、各プロジェクトの資料で確認します。

## 公式資料

- [Parquet File Format](https://parquet.apache.org/docs/file-format/)
- [ORC Specification v1](https://orc.apache.org/specification/ORCv1/)
- [Avro Specification](https://avro.apache.org/docs/current/specification/)
- [Arrow Columnar Format](https://arrow.apache.org/docs/format/Columnar.html)
- [Vortex（GitHub）](https://github.com/vortex-data/vortex)
- [Lance File Format](https://lancedb.github.io/lance/format/file)
