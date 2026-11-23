# Delta Lake の基本アーキテクチャ

## 1. データファイルとトランザクションログ

Delta table はデータファイルと、表の変更を記録する `_delta_log` を組み合わせる。読み手はディレクトリ全体を表の状態だとみなさず、ログを再生して状態を組み立てる。出典 [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)

## 2. 書き込みとコミット

ライターはまず新しいデータファイルを書き、その後ログに add/remove などのアクションを含む新しいバージョンを原子的にコミットする。ログの各 JSON ファイルが表の1バージョンに対応する。出典 [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)

## 3. MVCC と一貫したスナップショット

Delta は MVCC で複数バージョンを保持し、読み手はトランザクションログから対象バージョンのデータファイルを選ぶ。これにより、読み取り中に別のコミットがあっても一貫したスナップショットを得る。出典 [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)

## 4. Checkpoint

Checkpoint は指定バージョンまでの有効なアクションをまとめる。読み手は最新の完全な Checkpoint と、その後の JSON ログを使って、長いログ全体を毎回再生せずに表の状態を復元できる。出典 [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)

## 5. 時点読み取り

過去のバージョンを選ぶと、その時点のスナップショットを再構成できる。古いログやデータの削除は保持期間と vacuum の運用に依存するため、このモデルでは固定しない。出典 [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)

## 6. シナリオの見方

「注文をコミットして読む」では、データファイルを書き、JSON ログへコミットし、Checkpoint と後続ログからスナップショットを復元して読む。`commit-read` のリンクを順番に選択すると流れを追える。

## 7. 実装例：Spark・Delta Lake・Amazon S3

Delta の `S3DynamoDBLogStore` を構成し、協調する複数の Spark クラスターから同じ S3 のテーブルを更新する例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| Writer / Engine | Delta Lake を導入した Apache Spark | データファイルを生成し、LogStore でコミットを公開する。 |
| Data Files | S3 の Delta データファイル | Parquet のデータ本体を保持する。 |
| Delta JSON Log・Checkpoint | S3 の `_delta_log`（コミット・チェックポイント） | テーブルの履歴と、復元を短縮するチェックポイントを保持する。 |
| Consistent Snapshot・Reader / Query Engine | Apache Spark（ログ再生と読み取り） | 有効ファイル集合を復元し、対象のデータを読む。 |
| 実装で追加 | DynamoDB の書き込み調停用テーブル | 複数クラスター間で新規ログファイル作成を調停する。 |

全書き込み元を同じ LogStore、DynamoDB テーブル、リージョン設定に揃える。単一クラスターでの通常の S3 読み書きとも区別する。チェックポイントのファイル形式は Delta プロトコルで選択可能な形式に依存する。

[Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)、[Delta Lake Storage configuration: Amazon S3](https://docs.delta.io/delta-storage/)、[Delta Lake Quick Start](https://docs.delta.io/quick-start/)
