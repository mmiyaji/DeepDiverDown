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
