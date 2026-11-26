# Vortex の基本アーキテクチャ

## 1. 題材と範囲

Vortex は列指向のファイル形式とライブラリである。2026 年 11 月時点で、公式ドキュメントのサイトを基に、1 つのファイルの中の構成と、書く側・読む側・ストレージの関係を整理する。LF AI & Data 傘下という位置づけは、取得した公式ページでは「Vortex a Series of LF Projects, LLC」との表記までしか確認できず、未確認とする。図のデータや実行順は説明用で、実環境での実行や計測は行っていない。複数ファイルをテーブルとして管理する仕組みは扱わない。

## 2. ファイルの構成

ファイルの先頭と末尾は 4 バイトの `VTXF` で挟まれる。間にデータセグメント（必要ならパディング）と postscript が並び、最後にバージョンと postscript 長を持つ。

| 要素 | 中身 |
| --- | --- |
| postscript | DType、ルートレイアウト、ファイル統計、footer の位置（オフセット、長さ、アラインメント）。最大 65,527 バイト。 |
| DType | ルートの論理型。ルートは構造体でなくてもよい。 |
| footer | 配列、レイアウト、セグメント、圧縮（None・LZ4・ZLib・ZStd）、暗号化の仕様。 |
| ファイル統計 | ファイル単位の統計。全体を読み飛ばす判断に使う。 |

読み取りの既定では先頭 64 KB 以上を末尾から読み、postscript を得る。footer は 2 往復で読み込める。

## 3. 書く側と読む側

書き込み側は列を配列としてエンコードし、セグメント、レイアウト木、footer、postscript を書く。読み取り側のエンジンは Scan API にフィルタと列を渡す。Scan API はフィルタとプロジェクションの押し下げに対応し、DataFusion、DuckDB、Spark、Ray との統合が公式ページにある。各エンジンの対応範囲と機能差は未確認。

## 4. レイアウト木と統計

レイアウトは列と行の分割を木で表す。組み込みの種類は次のとおり。

| レイアウト | 役割 |
| --- | --- |
| FlatLayout | シリアライズされた配列を 1 つ持つ。 |
| StructLayout | 構造体のフィールドごとの子レイアウトを持つ。 |
| ChunkedLayout | 行方向に分割した子レイアウトを持つ。 |
| DictionaryLayout | 共有する辞書と、インデックスを持つ子レイアウトを持つ。 |
| ZonedLayout | 読み飛ばし用のゾーンマップ（統計）を持つ。 |

ゾーンの作り方と判定の詳細は、取得した資料に記述がなく未確認。詳しい経路は [Vortex：入れ子のエンコーディングと読み飛ばし](reference-vortex-encodings-pruning.md) に分けた。

## 5. エンコード済みセグメント

配列には FastLanes、FSST、ALP などの軽量エンコーディングを使い、多くの演算は展開せずに実行できる。入れ子にする手順は未確認。

## 6. ストレージ

ローカルのファイルシステムやオブジェクトストレージにファイルを置く。レイアウトは、セグメントのバッファをソースから遅延して取得する。FlatBuffer のメタデータにより、列の特定は O(1) とされる（公式ページの記述）。

## 7. シナリオの見方

「ファイルを書いて読む」は、書き込み側がセグメントと postscript を書き、読み取り側が末尾から postscript を読み、footer とルートレイアウトをたどり、統計で絞ったセグメントだけを読む流れを順に選択して追う。

## 8. 実装例：AWS の EC2 と S3

EC2 上で DataFusion または DuckDB のプロセスが Vortex ライブラリを使い、S3 のオブジェクトとして .vortex ファイルを書き、Scan API 経由で読む構成例。複数の資料を組み合わせた代表例で、動作は未検証である。

| 機能配置 | AWS での担い手 |
| --- | --- |
| 書き込み側 | EC2 上の書き込みジョブ（Vortex ライブラリ） |
| Scan API・読み取りエンジン | EC2 上の DataFusion または DuckDB と Vortex の統合 |
| ファイルの構成要素 | S3 上の 1 つの .vortex オブジェクト |
| ストレージ | Amazon S3 |

AWS は EC2 と S3 の基盤を運用し、利用者はゲスト OS、ジョブ、データと権限を管理する。S3 に対する Vortex の読み取りの実装詳細と各エンジンの対応版は未確認。

- [Vortex ドキュメント](https://docs.vortex.dev/)
- [Vortex File Format](https://docs.vortex.dev/specs/file-format)
- [Vortex Layouts](https://docs.vortex.dev/concepts/layouts)
- [Amazon S3 ユーザーガイド](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html)
- [AWS — Shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
