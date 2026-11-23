# Apache Iceberg の基本アーキテクチャ

## 1. テーブルの入口

SQL エンジンはテーブルの現在のメタデータを読み、そこから対象スナップショットを選ぶ。ストレージ上のデータファイル一覧を直接推測するのではなく、テーブルメタデータを起点に読む。出典 [Iceberg Specification](https://iceberg.apache.org/spec/)

## 2. スナップショットの切り替え

ライターは新しいデータファイルを準備し、メタデータを更新してスナップショットをコミットする。読み手は読み込み時点のスナップショットを使い、更新をリフレッシュするまで同じ状態を見続ける。出典 [Iceberg Specification](https://iceberg.apache.org/spec/)

## 3. Manifest List と Manifest

各スナップショットは Manifest List から複数の Manifest をたどる。Manifest はパーティション値や列統計を持つデータファイルの一覧で、クエリ計画時のプルーニングに使われる。出典 [Iceberg Terms](https://iceberg.apache.org/terms/)

## 4. データファイルの読み出し

エンジンは Manifest のファイル情報と統計で不要なファイルを除外し、残った Parquet などのデータファイルをストレージから読む。スナップショットの内容は、その Manifest にある生存ファイルの集合である。出典 [Iceberg Specification](https://iceberg.apache.org/spec/)

## 5. 時点読み取り

スナップショット ID または時刻を選べば、過去の表状態を読むシナリオを表現できる。古いメタデータやファイルの保持期間は運用設定に依存するため、このモデルでは固定しない。出典 [Iceberg Terms](https://iceberg.apache.org/terms/)

## 6. シナリオの見方

「注文のスナップショットを読む」では、コミット済みメタデータから snapshot、Manifest List、Manifest を順にたどり、必要なデータファイルだけを読む。`snapshot-read` のリンクを順番に選択すると流れを追える。

## 7. スナップショットの履歴と失効

コミットのたびに新しいスナップショットが作られ、テーブルメタデータの `snapshots` と `snapshot-log` に履歴が残る。操作の種類（append、overwrite、delete、replace＝コンパクションなど）と追加・削除したファイル数が `summary` に記録される。`FOR TIMESTAMP AS OF` や `FOR VERSION AS OF` で過去のスナップショットを選ぶと、その版の Manifest List から当時の生存ファイルを読む。古いスナップショットは `expire_snapshots` で失効させ、失効した版だけが参照していたファイルを削除する。失効させた版へはタイムトラベルできない。出典 [Iceberg Maintenance](https://iceberg.apache.org/docs/latest/maintenance/)

## 8. パーティションの進化と孤立ファイル

パーティション仕様は変更でき（partition evolution）、変更はメタデータに新しい仕様を追加するだけで、既存のデータファイルは書き直さない。古いファイルは古い仕様（例：月）のまま残り、新しく書くファイルだけが新しい仕様（例：日）で置かれる。クエリは各ファイルに記録された仕様ごとにプルーニングする。また、スナップショットを失効させると、失効した版だけが参照していたファイルが削除される。どのメタデータからも参照されないまま残ったファイル（書き込み失敗の残骸など）は `remove_orphan_files` で掃除する。出典 [Iceberg Partitioning](https://iceberg.apache.org/docs/latest/partitioning/)、[Iceberg Maintenance](https://iceberg.apache.org/docs/latest/maintenance/)
