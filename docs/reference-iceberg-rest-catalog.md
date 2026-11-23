# Iceberg REST Catalog の基本アーキテクチャ

## 1. クライアントとカタログ API

SQL エンジンは REST Catalog の共通 API で namespace やテーブルを操作する。クライアントごとに異なるカタログ実装へ直接結合せず、HTTP API の契約を利用する。出典 [REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)

## 2. テーブル解決

エンジンがテーブルを要求すると、Catalog Server はテーブル識別子を解決し、メタデータの場所や必要な設定を返す。これにより複数言語・複数エンジンから同じカタログへ接続できる。出典 [REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)

## 3. ストレージ上のメタデータとデータ

エンジンはカタログから得たメタデータの場所を使い、オブジェクトストレージの Iceberg メタデータ、Manifest、データファイルを読む。Catalog API はデータそのものを中継するものではない。出典 [REST Catalog](https://iceberg.apache.org/docs/latest/rest-catalog/)

## 4. Change-based commit

REST Catalog は変更ベースのコミットを使い、サーバー側で競合解消やリトライを扱える。ルートメタデータの更新をカタログサービスが管理することで、クライアント間の互換性と信頼性を高める。出典 [REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)

## 5. セキュリティと拡張

仕様は credential vending や remote signing による安全なテーブル共有、lazy snapshot loading や multi-table commit などの拡張を想定する。採用する機能や認証方式はサーバー実装に依存する。出典 [REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)

## 6. シナリオの見方

「エンジンが注文テーブルを読む」では、エンジンが REST Catalog へ問い合わせ、返されたメタデータ位置からストレージを読む。更新時は change-based commit をカタログへ送る。`catalog-read-commit` のリンクを順番に選択すると流れを追える。

## 7. 実装例：Trino・Polaris・RustFS

Polaris の公式 Trino ガイドに沿って、Trino Iceberg コネクタから REST API と S3 互換ストレージへ接続する例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| SQL エンジン | Trino Iceberg コネクタ | SQL 読み書きを Iceberg Catalog 操作に変換する。 |
| REST Catalog API・Catalog Server・Change-based Commit | Polaris Server（Iceberg REST） | テーブル解決、REST 操作、コミット要求を処理する。 |
| Iceberg Metadata | RustFS 上の Iceberg メタデータ | スナップショット情報を含むテーブルメタデータを置く。 |
| Manifest / Data Files | RustFS の Manifest・データファイル | 同じストレージ上のテーブルファイル。 |
| 実装で追加 | polaris.properties | REST URI とストレージエンドポイントを持つ。 |

`catalog/polaris.properties` で `iceberg.catalog.type=rest` を選び、Polaris REST URI と RustFS の S3 エンドポイントを設定する。管理 API を使う初期設定と Trino の REST 接続は別の役割。

[Apache Iceberg REST Catalog Spec](https://iceberg.apache.org/rest-catalog-spec/)、[Getting Started with Apache Polaris and Trino](https://polaris.apache.org/guides/trino/)、[Trino Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)
