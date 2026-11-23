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

## 7. 実装例：Flink SQL・Paimon ファイルカタログ

ローカル Flink SQL クラスターで Paimon の主キーテーブルを作り、更新とバッチ・ストリーム読み取りを試す例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| 上流の注文更新 | Flink SQL Client の試験用 INSERT | 同じ注文キーに対する複数回の更新を入力する。 |
| 主キーを使うテーブル書き込み | Flink SQL・Paimon Sink | Paimon コネクタを使い、パーティションとバケットへ書く。 |
| スナップショット読み取り | Flink のバッチ読み取り | 選んだスナップショットの論理行を確認する。 |
| ストリーム利用者 | Flink のストリーム SELECT | 生成された更新を増分で受け取る。 |
| バケット内の sorted run | warehouse 内のバケットファイル | テーブルの sorted run を保持する。 |
| LSM コンパクション | Paimon コンパクション | 同一キーの更新を整理する。 |
| コミット済みスナップショット | warehouse の snapshot メタデータ | コミット済みのファイル集合を記録する。 |
| Changelog Producer | Paimon の lookup Changelog | `lookup` を選ぶと旧値を使い更新前後を出す。 |
| 実装で追加 | Paimon ファイルカタログ設定 | `CREATE CATALOG` で warehouse を指定する。 |

単一マシンで Flink の JobManager と TaskManager を起動し、SQL Client からジョブを投入する。TaskManager が Paimon Sink と読み取りを実行する。Flink のバージョンに対応する Paimon コネクタを配置し、同時実行に十分なスロットを用意する。公式 Quick Start は word count であり、図の注文データと lookup 設定はその応用例で動作未検証。SQL Client で検証用の更新を入力する。`file:` の warehouse は単一マシンの実験用。分散構成では実行タスクが同じ warehouse に到達できる共有ストレージを使う。`none` と `lookup` の出力差を比較するときは同じ入力の別テーブルを用意する。

[Paimon 2.1 Primary-Key Table](https://paimon.apache.org/docs/2.1/primary-key-table/)、[Paimon 2.1 Changelog Producer](https://paimon.apache.org/docs/2.1/primary-key-table/changelog-producer/)、[Paimon 2.1 Compaction](https://paimon.apache.org/docs/2.1/primary-key-table/compaction/)、[Flink Quick Start](https://paimon.apache.org/docs/2.1/flink/quick-start/)、[Understand Files](https://paimon.apache.org/docs/2.1/learn-paimon/understand-files/)

## 8. 実装例：AWS の EMR on EC2・Flink・S3

Amazon EMR が管理する EC2 クラスタで Flink の YARN セッションを起動する。JobManager がタスクを調整し、TaskManager 上の Paimon コネクタでテーブルを読み書きする。たとえば、Flink 1.20 を含む EMR 7.14.0 に Paimon 2.1 の Flink 1.20 用コネクタを追加する。

| 機能配置 | AWS での担い手 |
|---|---|
| 更新入力・主キー upsert | 試験用の注文更新入力と Flink SQL の Paimon Sink |
| sorted run | S3 warehouse のテーブルプレフィックス内のバケットファイル |
| コンパクション | Flink Sink 内の Paimon の処理 |
| スナップショット | 同じ S3 のテーブルプレフィックス内のコミットメタデータ |
| 変更ログ | `lookup` を選択したテーブルの S3 上の changelog ファイル |
| スナップショット・増分読み取り | Flink 上の Paimon Source によるバッチとストリームの読み取り |

Flink の S3 ファイルシステムを用意し、Paimon のファイルカタログの warehouse を `s3://` に指定する。書き込みジョブを一つに限定し、Flink のチェックポイントを有効にする。Flink が復旧に使うジョブチェックポイントは、Paimon がテーブルの読み取りに使うスナップショットと保存先を分ける。クラスタの IAM ロールで warehouse とチェックポイントの両方に必要な操作を許可する。

- [Amazon EMR Release Guide — Apache Flink](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-flink.html)
- [Amazon EMR Release Guide — Working with Flink jobs](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/flink-jobs.html)
- [Paimon 2.1 — Flink Installation](https://paimon.apache.org/docs/2.1/flink/installation/)
- [Paimon 2.1 — Filesystems](https://paimon.apache.org/docs/2.1/maintenance/filesystems/)
- [Paimon 2.1 — Compaction](https://paimon.apache.org/docs/2.1/primary-key-table/compaction/)
- [Apache Flink 1.20 — Amazon S3](https://nightlies.apache.org/flink/flink-docs-release-1.20/docs/deployment/filesystems/s3/)

EMR 7.14.0 には Flink 1.20.0-amzn-8 が含まれ、Paimon 2.1 の資料には Flink 1.20 用のコネクタが記載されている。Paimon は EMR の同梱一覧にないため別途導入する。EMR の AWS 修正版 Flink、コネクタと S3 依存関係の組み合わせは動作検証していない。 AWS は EMR、EC2、ストレージなどのサービス基盤を運用し、利用者はクラスタ、ゲスト OS、ジョブ、データおよび権限を管理する。EC2 上のソフトウェアには SSH やアプリケーションのインターフェースから操作できるが、マネージドサービスの内部基盤に直接アクセスすることを意味しない。

- [AWS — Shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
