# Project Nessie のバージョン管理カタログ

## 1. ブランチ・タグとコミット

Nessie はカタログの名前付き参照を管理する。ブランチはコミットで進み、タグは特定のコミットに名前を付ける。コミットを選ぶと、その時点のカタログ上で複数のテーブルやビューを同じ参照から解決できる。

[Nessie Specification](https://projectnessie.org/develop/spec/)

## 2. コンテンツキーと Iceberg スナップショット

名前空間とテーブル名を含むコンテンツキーを選んだ参照上で引く。Iceberg テーブルの参照ごとの状態にはスナップショット ID やスキーマ ID などが含まれる。Nessie コミットは複数資産の状態を束ね、Iceberg スナップショットは個別テーブルの状態を表す。

[Nessie Specification](https://projectnessie.org/develop/spec/)

## 3. 変更の検証と公開

作業ブランチで複数テーブルを更新・検証し、その状態を本番ブランチにマージできる。通常のマージでは対象の変更が競合すると失敗する。参照を切り替えても、オブジェクトストレージのファイルをブランチごとに複製する必要はない。

[Nessie Specification](https://projectnessie.org/develop/spec/)、[Nessie CLI Merge](https://projectnessie.org/nessie-0-107-1/generated-docs/cli-help-MergeBranchStatement/)

## 4. Iceberg REST 接続

公式ガイドでは Iceberg REST 対応を実験的と記載している。サーバー側でストレージと warehouse を構成し、クライアントは URI でブランチやタグを選べる。REST 応答で公開されるテーブルのスナップショットは選択した Nessie コミットに対応する一つで、過去時点は Nessie の参照・コミット ID・時刻から選ぶ。

[Configure Nessie with Iceberg REST](https://projectnessie.org/guides/iceberg-rest/)

## 5. シナリオの見方

例では当初 `main` とタグ `close-jun` に同じ確定済みの売上・顧客テーブルがあり、作業ブランチ `review` で両方を更新する。公開後もタグで締め時点の組み合わせを読める。木の各枝はマージ前の参照を展開した概念図。

## 6. 実装例：Spark・Nessie・MinIO

公式のローカル Iceberg REST ガイドに沿って Spark と MinIO を接続し、作業ブランチを試す例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| Iceberg エンジン | Spark SQL | Iceberg REST クライアントからブランチを選ぶ。 |
| データ運用者 | 運用者の Nessie CLI | ブランチの作成とマージを行う。 |
| Iceberg REST 接続・ブランチ・タグ・テーブル状態 | Nessie Server | REST 接続、参照とコンテンツキーの解決を担う。 |
| コミット履歴 | Nessie インメモリ Version Store | 試行用のコミット履歴をプロセス内に保存する。 |
| Iceberg メタデータ・ファイル | MinIO（S3 互換） | warehouse に Iceberg メタデータとデータを置く。 |
| 実装で追加 | warehouse 設定 | オブジェクトストレージの接続先とテーブルの既定位置を定義する。 |

warehouse をサーバーで定義する。試行用の履歴はインメモリで、再起動後も保持する運用では永続バックエンドを使う。Iceberg REST 対応は公式ガイドで実験的とされる。

[Nessie Specification](https://projectnessie.org/develop/spec/)、[Configure Nessie with Iceberg REST](https://projectnessie.org/guides/iceberg-rest/)、[Getting Started with Nessie and Iceberg REST](https://projectnessie.org/guides/try-nessie/)
