# ETL と ELT の比較アーキテクチャ

## 1. 共通の入力

注文データなどのソースから、ETL と ELT のどちらも分析基盤へデータを届ける。違いは、変換をターゲットへロードする前に行うか、ロードした後に行うかである。出典 [AWS Glue](https://docs.aws.amazon.com/glue/latest/dg/components-key-concepts.html)

## 2. ETL の経路

ETL は Extract でソースを読み、Transform で整形・クレンジングし、Load で変換済みデータをターゲットへ書く。AWS Glue Job はこの流れを実行するマネージドな例である。出典 [AWS Glue concepts](https://docs.aws.amazon.com/glue/latest/dg/components-key-concepts.html)

## 3. ELT の経路

ELT はまず raw データを分析基盤へ Load し、その後、基盤上の計算資源で Transform する。dbt は既にロードされた warehouse データを SQL モデルで trusted data products に変換する例である。出典 [dbt introduction](https://docs.getdbt.com/docs/introduction)

## 4. 変換の置き場所

ETL の変換は転送・取り込み処理と同じパイプラインに置かれ、ターゲットには整形済みデータを渡す。ELT では raw 層を保持し、staging や mart などのモデルをターゲット側で派生させる。実際の分割、更新方式、品質チェックは製品と設計に依存する。

## 5. 選択の観点

ソース側でのマスキングや容量削減を優先するなら ETL、raw データを保持して SQL で再利用・再変換するなら ELT が説明しやすい。両者は排他的とは限らず、同じ基盤でジョブと SQL モデルを組み合わせられる。出典 [AWS Glue](https://docs.aws.amazon.com/glue/latest/dg/)・[dbt introduction](https://docs.getdbt.com/docs/introduction)

## 6. シナリオの見方

「注文データを日次集計する」では、ETL は変換してから curated 層へロードし、ELT は raw 層へロード後に warehouse でモデル化する。`compare-etl-elt` のリンクを順番に選択すると差を比較できる。

## 7. 実装例：AWS Glue・Amazon Redshift・dbt

S3 上の同じ注文入力を使い、Glue で先に変換してロードする ETL と、Redshift に先にロードする ELT を比較する例。

| 機能 | 具体的な担い手 | 配置・設定 |
| --- | --- | --- |
| 注文データソース | Amazon S3 の入力バケット | 同じ注文ファイルを両経路の原本として保持する。 |
| ロード前の変換処理 | AWS Glue ETL ジョブ | 抽出と変換を行い、Redshift へロードする。 |
| Curated Table | Redshift の ETL 整形済みテーブル | Glue で変換した結果を保持する。 |
| Raw Landing | Redshift の raw スキーマ | COPY でロードした無変換の入力を保持する。 |
| ロード後の SQL 変換 | dbt-redshift と Redshift SQL | dbt モデルの SQL を Redshift 内で実行する。 |
| Analytics Mart | Redshift の分析マート | 比較用に経路ごとにスキーマを分離する。 |
| BI / Consumer | Redshift 対応の BI クライアント | 注文売上の集計を参照する。 |
| 実装で追加 | Amazon S3 の Glue 一時領域 | Glue と Redshift の転送時に一時データを置く。 |

ETL は Glue が変換結果を Redshift に書く際に一時 S3 領域を使う。ELT は Redshift の `COPY` で無変換の入力を `raw` スキーマにロードし、`dbt-redshift` が後から SQL を実行する。二経路のマートは別スキーマへ作り、同じマートに二重に投入しない。

[AWS Glue concepts](https://docs.aws.amazon.com/glue/latest/dg/components-key-concepts.html)、[AWS Glue Redshift connections](https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-etl-connect-redshift-home.html)、[Amazon Redshift COPY from S3](https://docs.aws.amazon.com/redshift/latest/dg/t_loading-tables-from-s3.html)、[dbt Redshift setup](https://docs.getdbt.com/docs/local/connect-data-platform/redshift-setup)
