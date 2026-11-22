# Apache Hudi の基本アーキテクチャ

## 1. 更新イベントの取り込み

Hudi は更新・挿入・削除をテーブルのコミットとして取り込み、ストレージ上のファイルを世代管理する。CDC や増分処理では、コミットのタイムラインを下流処理の入力にできる。出典 [Hudi Concepts](https://hudi.apache.org/docs/concepts/)

## 2. Copy-on-Write

Copy-on-Write（CoW）は更新時に列指向のベースファイルを書き換える。読み取りはベースファイルだけで済むため読み取り性能を優先するが、更新時の I/O は大きくなる。出典 [Hudi Concepts](https://hudi.apache.org/docs/concepts/)

## 3. Merge-on-Read

Merge-on-Read（MoR）はベースファイルに加えてログファイルへ更新を追記し、読み取り時にマージする。必要に応じてコンパクションでログを新しいベースファイルへ反映し、書き込みレイテンシーと読み取りコストを調整する。出典 [Hudi Concepts](https://hudi.apache.org/docs/concepts/)

## 4. タイムラインとクエリ

Snapshot query はコミット済みの最新状態を読み、Incremental query は指定したコミット以降の変更を読む。MoR の Read Optimized query はベースファイルだけを読み、コンパクション後の状態を使う。出典 [Hudi Concepts](https://hudi.apache.org/docs/concepts/)

## 5. シナリオの見方

「CDC 更新を取り込む」では、更新イベントをコミットし、CoW ならベースファイルを書き換え、MoR ならログへ追記してから snapshot または incremental query で読む。`upsert-cdc` のリンクを順番に選択すると比較できる。
