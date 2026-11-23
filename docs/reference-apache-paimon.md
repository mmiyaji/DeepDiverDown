# Apache Paimon の主キーテーブル：Flink 更新と変更ログ

## 1. 題材と範囲

Paimon 2.1 の主キーテーブルを Flink で更新する。架空の注文 42 は最初 `open` で、上流から同じ `order_id` の新しい完全行 `paid` が届く。図の run、変更、コミット順は説明用。実環境での実行や計測は行っていない。

## 2. 主キー upsert と現在状態

Flink SQL で `PRIMARY KEY (order_id) NOT ENFORCED` を宣言した Paimon テーブルを想定する。`merge-engine = deduplicate` は同じキーの最新の完全行を論理行として返す。入力順と業務上の新旧がずれる場合は、順序を表す値をシーケンスフィールドに指定する。

更新行は該当のパーティション・バケットのソート済みファイルに書き込まれ、コミットしたスナップショットから見えるようになる。図は Merge-on-Read の一例。新旧の run がともに参照されていても、読み取り時にキーごとのバージョンを統合するので、注文 42 の論理状態は `paid` になる。

## 3. LSM コンパクション

バケット内の複数の sorted run を選び、キー順にマージして `deduplicate` を適用し、出力のファイルを作る。新しいスナップショットは出力のファイルを参照する。以前のスナップショットが参照するファイルの削除は保持ポリシーに従う。コンパクションは読み取り時のマージを減らす一方、追加の CPU とストレージ I/O を要する。

## 4. 下流に必要な情報で変更ログを選ぶ

下流で主キーの値を置き換えるだけなら、`changelog-producer = none` の増分読み取りで得られる upsert を適用できる。更新前の値を引いてから更新後の値を足す集計などでは、図の `−U open` と `+U paid` の両方が必要になる。記号は Flink の `UPDATE_BEFORE` と `UPDATE_AFTER` を表す。

| 方式 | 下流が読める変更 |
| --- | --- |
| `none` | 別個の完全な変更ログを生成せず、増分スナップショットから upsert を読む。必要に応じて Flink が状態を保持して正規化できる。 |
| `input` | 入力の変更を別ファイルに保存して転送する。前値が必要なら上流が供給する。 |
| `lookup` | コンパクション時に旧値を取得し、結果の変更ログをコミットしてから読める。 |
| `full-compaction` | フルコンパクションの結果間の差分から変更を生成する。 |

キーの現在状態を決める設定は `merge-engine`、ストリーミングで下流に見える変更を決める設定は `changelog-producer`。図の 2 方式は、同じ入力を異なる設定で処理した場合を表す。

## 5. Hudi の CoW・MoR との比較

[Hudi の教材](reference-apache-hudi.md) では、CoW は更新時に対象ファイルグループのベースファイルを書き直し、MoR はベースとデルタログを組み合わせて読み、コンパクションでベースへ統合する。Hudi は完了したアクションをタイムラインで管理する。Paimon の例では、同じバケットの LSM の sorted run を読み取りやコンパクションで統合し、下流向け変更の生成方式を別に選ぶ。比較するときは、保存単位、コンパクションのタイミング、増分読み取りの意味をそれぞれ確認する。

## 6. 公式資料

- [Paimon 2.1 Primary-Key Table](https://paimon.apache.org/docs/2.1/primary-key-table/)
- [Paimon 2.1 Merge Engines](https://paimon.apache.org/docs/2.1/primary-key-table/merge-engine/)
- [Paimon 2.1 Changelog Producer](https://paimon.apache.org/docs/2.1/primary-key-table/changelog-producer/)
- [Paimon 2.1 Compaction](https://paimon.apache.org/docs/2.1/primary-key-table/compaction/)
- [Apache Hudi Concepts](https://hudi.apache.org/docs/concepts/)
- [Paimon 2.1 Table Mode](https://paimon.apache.org/docs/2.1/primary-key-table/table-mode/)
