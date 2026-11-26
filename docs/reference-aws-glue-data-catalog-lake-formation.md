# AWS Glue Data Catalog と Lake Formation の権限と Iceberg REST

2026 年 11 月時点の公式資料に基づく。

## 1. 対象

Glue Data Catalog はデータベースとテーブルのメタデータ（スキーマ、パーティション、S3 上の保存場所）を持つ。クローラーで自動登録するか、手動で定義する。Iceberg、Hudi、Delta Lake の表も登録できる。例ではアカウントの既定カタログの sales_db.orders を使う。

## 2. AWS のエンジンからの解決

Athena、EMR、Redshift Spectrum、Glue ETL などの統合エンジンは、Data Catalog にメタデータを要求する。Data Catalog は Lake Formation で要求者の権限を確認し、参照を許可されたメタデータだけを返す。表が Lake Formation の管理下（S3 ロケーションを登録済み）なら、エンジンは Lake Formation に一時的なアクセスを要求し、受け取った認証情報で S3 を読む。列・行・セルのフィルタリングはエンジン側で適用される。管理下にない表は、S3 のバケットポリシーと IAM ポリシーで評価される。

エンジンごとに対応範囲が異なる。Athena SQL は表・列・行の読み取りに対応し、Athena Spark は未対応。EMR on EKS と EMR Serverless の Hive は未対応。Glue ETL の列・行の制御は Glue 5.0 以降の読み取りが対象。Iceberg への書き込みは、Athena SQL と EMR の Spark で全表アクセスが前提になる。

## 3. Iceberg REST エンドポイント

エンドポイントは `https://glue.<リージョン>.amazonaws.com/iceberg`。Iceberg 表 v1 と v2（既定は v2）を扱い、S3 の表と S3 Tables の表にアクセスできる。Spark では `warehouse` にカタログ ID（既定カタログはアカウント ID）を指定し、`rest.sigv4-enabled=true` と `rest.signing-name=glue` を設定する。対応する API は GetConfig、名前空間の作成・取得・更新・削除、テーブルの作成・取得・更新・削除など。名前空間は 1 階層のみで、多階層はカタログ側の階層で表す。

認証は 2 通りある。

- SigV4：AWS SDK と AWS のエンジンの既定。
- OAuth 2.0 Bearer：外部のパートナーやエンジン向け。利用者の JWT を AWS Sign-In で Glue 向けの短期アクセストークンに交換し（RFC 8693 のトークン交換）、`Authorization: Bearer` で提示する。Glue がトークンを検証し、要求ごとに Lake Formation の権限を適用する。LoadTable で払い出される S3 認証情報は、引き受けた IAM ロールと Lake Formation の許可の範囲に収まる。

トークン交換の設定手順は AWS Sign-In のガイドにあり、この図では確認していない。

## 4. Lake Formation の権限とクレデンシャルベンディング

データレイク管理者または委任された利用者が、データベース・表・列に許可を付与し、表の S3 ロケーションを登録する。登録は、Lake Formation が S3 アクセスを一時認証情報で仲介する前提になる。この仕組みをクレデンシャルベンディングと呼ぶ。

AWS 製の統合エンジンは信頼された呼び出し元として認証情報を得る。第三者のエンジンは `GetTemporaryGlueTableCredentials` と `GetTemporaryGluePartitionCredentials` で同じ仕組みを使える。この API は既定で無効で、IAM セッションタグの検証か、「全表アクセスのときに外部エンジンの S3 アクセスを許可する」オプションで有効にする。後者は列・行のフィルターがない全表アクセスが対象。

## 図で確認するシナリオ

- **Athena が Lake Formation 管理の表を読む** — エンジンが Glue Data Catalog API で表のメタデータを取得する。 → Lake Formation が要求者の権限を確認し、許可された範囲だけを払い出しの対象にする。 → エンジンが一時認証情報を受け取り、S3 のデータを読む。
- **外部の Spark が Iceberg REST で表を読む** — 外部エンジンが利用者の JWT を OAuth アクセストークンに交換する。 → Bearer トークンで REST 要求を送り、名前空間と表を解決する。 → Glue が Lake Formation の権限を要求ごとに適用する。LoadTable では権限の範囲に収まる S3 認証情報を払い出す。

## 公式資料

- [Glue Iceberg REST エンドポイント](https://docs.aws.amazon.com/glue/latest/dg/connect-glu-iceberg-rest.html)
- [Lake Formation の仕組み](https://docs.aws.amazon.com/lake-formation/latest/dg/how-it-works.html)
- [Lake Formation のアプリケーション統合（クレデンシャルベンディング）](https://docs.aws.amazon.com/lake-formation/latest/dg/using-cred-vending.html)
- [Lake Formation と他の AWS サービス](https://docs.aws.amazon.com/lake-formation/latest/dg/working-with-services.html)
- [Glue Data Catalog の概要](https://docs.aws.amazon.com/glue/latest/dg/catalog-and-crawler.html)

## 5. 実装例 Glue Data Catalog と Lake Formation を AWS のエンジンと社内 Spark から使う

1 つの AWS アカウントのカタログを、Athena・EMR・Redshift Spectrum は Glue API と Lake Formation で、社内の Spark は Iceberg REST と OAuth で読む例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| AWS のクエリエンジン | Amazon Athena、EMR on EC2 の Spark（YARN）、Redshift Spectrum | Glue Data Catalog API でメタデータを取得し、一時認証情報で S3 を読む。 |
| 外部のクエリエンジン | 社内の Spark | OAuth トークンで Iceberg REST に接続する。 |
| トークン交換 | AWS Sign-In | JWT を Glue 向けの短期アクセストークンに交換する。 |
| Iceberg REST エンドポイント／Glue Data Catalog API | AWS Glue | 同じカタログを 2 つの経路で公開する。 |
| データベースとテーブル | Glue Data Catalog の sales_db.orders | S3 の保存場所を指す。 |
| Lake Formation の権限・登録ロケーション・払い出し | AWS Lake Formation | 許可の付与、S3 パスの登録、一時認証情報の払い出し。 |
| テーブルデータ | Amazon S3 | データファイルを保持する。 |

Glue と Lake Formation は AWS が運用し、利用者が許可、ロケーション登録、EMR クラスターの設定を管理する。EMR の対応リリース、Redshift Spectrum の外部スキーマの権限設定、Sign-In の設定手順は未確認。この例は公式資料を組み合わせた構成で、実動作は未検証。

出典 [Glue Iceberg REST エンドポイント](https://docs.aws.amazon.com/glue/latest/dg/connect-glu-iceberg-rest.html)、[Lake Formation の仕組み](https://docs.aws.amazon.com/lake-formation/latest/dg/how-it-works.html)、[クレデンシャルベンディング](https://docs.aws.amazon.com/lake-formation/latest/dg/using-cred-vending.html)、[Lake Formation と他の AWS サービス](https://docs.aws.amazon.com/lake-formation/latest/dg/working-with-services.html)、[Glue Data Catalog の概要](https://docs.aws.amazon.com/glue/latest/dg/catalog-and-crawler.html)
