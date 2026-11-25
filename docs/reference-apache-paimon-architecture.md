# Apache Paimon の基本アーキテクチャ

## 1. 題材と範囲

Paimon 2.1 のテーブルを、エンジン・カタログ・ストレージの関係から捉える。初めて学ぶ人向けに、テーブルの中身（スナップショット・マニフェスト・データファイル）と、それを読み書きするエンジン、置き場所のストレージをつなぐ。図のデータや実行順は説明用で、実環境での実行や計測は行っていない。

## 2. テーブルのディレクトリ構成

テーブルはストレージ上のテーブルディレクトリに置かれる。主な中身は次のとおり。

| 場所 | 中身 |
| --- | --- |
| `schema/` | `schema-<n>`。フィールド ID、型、主キー、パーティションキー、テーブルのオプション。 |
| `snapshot/` | `snapshot-<id>`。コミットごとの版。 |
| `manifest/` | manifest list と manifest。 |
| パーティション・バケットのディレクトリ | データファイル（例：`dt=.../bucket-0/`）。既定の形式は Parquet。 |

読み取りはディレクトリの一覧ではなく、スナップショットのメタデータをたどって有効なファイルを決める。

## 3. 書き込み・読み取りエンジン

テーブルを読み書きする処理はエンジン側にあり、Paimon はテーブル形式とコネクタを提供する。このリファレンスの実装例は Flink を使う。公式サイトの目次には Flink、Spark、PyPaimon の項目がある。Hive や Trino など、ほかのエンジンの対応範囲と機能差は今回確認していない（未確認）。

書き込み側はデータファイルを書き、コミットで新しいスナップショットを作る。読み取り側は選んだスナップショットから有効なデータファイルを求め、主キーテーブルでは複数の行バージョンを統合して最新の論理行を返す。

## 4. スナップショットからデータファイルへ

スナップショットは、スキーマ ID、コミットの種類、manifest list への参照を持つ JSON ファイルである。base manifest list は既存のファイル集合、delta manifest list はそのコミットでの追加と削除を指す。manifest list は manifest を指し、manifest がデータファイルの追加（add）と削除（delete）のエントリ、パーティション、バケット、統計を持つ。詳細は [Paimon：スナップショットとマニフェスト](reference-apache-paimon-snapshots-manifests.md) に分けた。

## 5. 主キーテーブルのコンパクション

主キーテーブルでは、バケット内に複数の sorted run が並び、コンパクションがマージして新しいファイル集合をコミットする。マージの規則は `merge-engine`、下流に見える変更は `changelog-producer` で選ぶ。詳細は [主キーテーブル：Flink 更新と変更ログ](reference-apache-paimon.md)（仕組み step 1）に分けた。

## 6. カタログとストレージ

カタログはデータベースとテーブルを管理し、エンジンはカタログでテーブルの場所とスキーマを解決する。ファイルカタログは `warehouse` のパスからテーブルを見つける。公式サイトには REST Catalog のガイドもある。ほかのカタログ種別と細部は未確認。

ストレージは、`file:` のローカルや `s3://` などのスキームで warehouse を指す。対応するファイルシステムは [Paimon 2.1 Filesystems](https://paimon.apache.org/docs/2.1/maintenance/filesystems/) で確かめる。

## 7. シナリオの見方

「テーブルを書いて読む」は、カタログでテーブルを解決し、データファイルを書き、コミットでスナップショットを作り、読み取りで同じ経路を逆にたどり、最後にコンパクションで run を整理する流れを順に選択して追う。

## 8. 実装例：Flink SQL・Paimon ファイルカタログ

ローカルの Flink で Paimon のファイルカタログを作り、テーブルの書き込みと読み取りを試す例。

| 機能配置 | 具体的な担い手 |
| --- | --- |
| 書き込みエンジン | Flink の TaskManager 上の Paimon Sink |
| 読み取りエンジン | Flink の TaskManager 上の Paimon Source |
| カタログ | `CREATE CATALOG` で `warehouse` を指定するファイルカタログ |
| スキーマ・スナップショット・manifest・データファイル | warehouse 配下のテーブルディレクトリ内のファイル |
| コンパクション | Sink 内の Paimon の処理 |
| ストレージ | ローカルファイルシステム |

Flink の JobManager が TaskManager にタスクを割り当てる。`file:` の warehouse は単一マシンの実験用で、分散構成では全タスクが同じ warehouse に届くストレージが要る。公式 Quick Start は word count であり、この図の構成は組み合わせた例で動作未検証。

- [Paimon 2.1 Flink Quick Start](https://paimon.apache.org/docs/2.1/flink/quick-start/)
- [Paimon 2.1 Understand Files](https://paimon.apache.org/docs/2.1/learn-paimon/understand-files/)
- [Paimon 2.1 Basic Concepts](https://paimon.apache.org/docs/2.1/concepts/basic-concepts/)

## 9. 実装例：AWS の EMR on EC2・Flink・S3

Amazon EMR が管理する EC2 クラスタで Flink の YARN セッションを起動し、TaskManager 上の Paimon コネクタが S3 の warehouse を読み書きする。たとえば Flink 1.20 を含む EMR 7.14.0 に、Paimon 2.1 の Flink 1.20 用コネクタを追加する。

| 機能配置 | AWS での担い手 |
| --- | --- |
| 書き込み・読み取りエンジン | EMR の YARN 上の Flink（Paimon Sink・Source） |
| カタログ | S3 の warehouse を指すファイルカタログ |
| スキーマ・スナップショット・manifest・データファイル | S3 のテーブルプレフィックス内のファイル |
| コンパクション | Flink Sink 内の Paimon の処理 |
| ストレージ | Amazon S3 |

Flink のジョブチェックポイントは Paimon の warehouse と別の S3 プレフィックスに置く。クラスタの IAM ロールで両方に必要な操作を許可する。EMR の Flink 修正版、Paimon コネクタ、S3 依存関係の組み合わせは動作検証していない。AWS は EMR、EC2、S3 などのサービス基盤を運用し、利用者はクラスタ、ゲスト OS、ジョブ、データおよび権限を管理する。EC2 上のソフトウェアには SSH やアプリケーションのインターフェースから操作できるが、マネージドサービスの内部基盤に直接アクセスすることを意味しない。

- [Amazon EMR Release Guide — Apache Flink](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-flink.html)
- [Paimon 2.1 — Flink Installation](https://paimon.apache.org/docs/2.1/flink/installation/)
- [Paimon 2.1 — Filesystems](https://paimon.apache.org/docs/2.1/maintenance/filesystems/)
- [Apache Flink 1.20 — Amazon S3](https://nightlies.apache.org/flink/flink-docs-release-1.20/docs/deployment/filesystems/s3/)
- [AWS — Shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
