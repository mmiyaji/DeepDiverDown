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

## 6. 実装例：Hudi Streamer・Kafka・Spark

Hudi の Docker デモをもとに、Kafka の変更を Spark 上の Hudi Streamer で取り込み、表の配置を比較する例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| CDC / 更新イベント | Kafka の注文更新トピック | Hudi Streamer が読む変更を保持する。 |
| Hudi Timeline | Hudi のタイムライン（`.hoodie`） | コミットとテーブル保守の状態を記録する。 |
| Copy-on-Write Base Files | 分散ファイルシステムの COW テーブル | 更新済みベースファイルを置く。 |
| Merge-on-Read Log Files | 分散ファイルシステムの MOR テーブル | 更新ログとベースファイルを維持する。 |
| Compactor | Hudi Streamer の非同期コンパクション | MOR の変更ログをベースファイルへ統合する。 |
| Query Engine | Spark SQL | Hudi のテーブルを読む。 |
| 分析結果 | Spark SQL の集計結果 | 読み取り後のデータを利用者へ返す。 |
| 実装で追加 | Hudi Streamer（Spark） | Kafka から取り込み、キーで更新を適用する。 |

Copy-on-Write と Merge-on-Read は別のテーブルで試す。Merge-on-Read では Hudi Streamer の連続モードで非同期コンパクションを選べる。順序付けとレコードキーはデータ契約に合わせて設定する。

[Apache Hudi Concepts](https://hudi.apache.org/docs/concepts/)、[Hudi Streamer Deployment](https://hudi.apache.org/docs/deployment/)、[Hudi Compaction](https://hudi.apache.org/docs/compaction/)
