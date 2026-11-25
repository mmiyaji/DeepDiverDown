# Apache Paimon：スナップショットとマニフェスト

## 1. 題材と範囲

Paimon 2.1 のテーブルで、スナップショットから manifest list、manifest、データファイルまでをたどる経路と、コミットがその経路を作る順序を扱う。図の run や順序は説明用で、実環境での実行や計測は行っていない。

## 2. メタデータの階層

| 階層 | 場所 | 中身 |
| --- | --- | --- |
| スナップショット | `snapshot/snapshot-<id>` | スキーマ ID、コミットの種類、manifest list への参照。changelog と index のメタデータは任意。 |
| manifest list | `manifest/` | manifest の名前とパーティション統計。 |
| manifest | `manifest/` | データファイルの追加（add）と削除（delete）のエントリ、パーティション、バケット、統計。 |
| データファイル | パーティション・バケットのディレクトリ | レコード。主キーテーブルでは行の種類とシーケンス番号を持つ。 |
| スキーマ | `schema/schema-<n>` | フィールド、主キー、オプション。 |

スナップショットは base manifest list と delta manifest list を指す。base は既存のファイル集合、delta はそのコミットでの追加と削除を表す。manifest の削除エントリはファイルを論理テーブルから外すが、ストレージからは直ちに消さない。

## 3. 読み取りでのたどり方

読み取り側はテーブルのディレクトリを一覧せず、選んだスナップショットから base と delta の manifest list を読み、manifest のエントリで有効なデータファイルを決める。主キーテーブルでは、読み出した複数の行バージョンをキーごとに統合して最新の論理行を返す。

## 4. コミット

書き込み側は、データファイルを書き、そのファイルを指す manifest と manifest list を作ってから、新しいスナップショットを公開する。参照される側が先に存在する順序を想定した説明で、書き込み順の詳細は未確認。同時書き込みの競合検出とスナップショット公開の原子性は、今回確認した資料に記載がなく未確認。

## 5. 期限切れと削除

保持は 保持時間と最小・最大の保持数で決まる。タグと追跡中のコンシューマーは、スナップショットとそのファイルを期限切れから守る。ファイルは、保持中のどのスナップショットからも参照されなくなってから回収される。失敗した書き込みの残りファイルは、別の孤立ファイル掃除の手順で扱う。期限切れの実行タイミングは未確認。

## 6. シナリオの見方

「コミットして読む」では、データファイルと manifest の書き込み、スナップショットの公開、スナップショットの選択、manifest list と manifest のたどり、有効ファイルの読み取りを順に選択して追う。

## 7. 実装例：Flink SQL・Paimon ファイルカタログ

[基本アーキテクチャ](reference-apache-paimon-architecture.md#§8) と同じローカル構成。Flink の TaskManager 上の Paimon Sink がコミットし、Paimon Source が読む。スナップショット、manifest list、manifest、データファイル、スキーマは warehouse 配下のファイルで、ローカルファイルシステムに置く。期限切れ処理は Paimon の処理で、実行する場所は未確認。構成は組み合わせた例で動作未検証。

- [Paimon 2.1 Understand Files](https://paimon.apache.org/docs/2.1/learn-paimon/understand-files/)
- [Paimon 2.1 Basic Concepts](https://paimon.apache.org/docs/2.1/concepts/basic-concepts/)
- [Paimon 2.1 Flink Quick Start](https://paimon.apache.org/docs/2.1/flink/quick-start/)

## 8. 実装例：AWS の EMR on EC2・Flink・S3

[基本アーキテクチャ](reference-apache-paimon-architecture.md#§9) と同じ AWS 構成。TaskManager の Paimon Sink が S3 の warehouse にデータファイルと manifest を書き、スナップショットを公開する。Paimon Source が S3 のスナップショットからたどって読む。Flink のジョブチェックポイントは別の S3 プレフィックスに保存する。構成は組み合わせた例で動作未検証。AWS は EMR、EC2、S3 の基盤を運用し、利用者はクラスタ、ジョブ、データ、権限を管理する。

- [Amazon EMR Release Guide — Apache Flink](https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-flink.html)
- [Paimon 2.1 — Filesystems](https://paimon.apache.org/docs/2.1/maintenance/filesystems/)
- [AWS — Shared responsibility](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)
