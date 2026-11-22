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
