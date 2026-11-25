# Azure Data Factory：Mapping Data Flow の実行

## 1. 対象

パイプラインの Data Flow アクティビティが、Spark クラスターでソースから変換、シンクまでを実行する流れを扱う。Azure IR のコンピューティング設定、クラスターの起動と TTL を含む。

## 2. Data Flow アクティビティ

Data Flow アクティビティはパイプラインに置き、実行する Data Flow の定義と、使う Azure IR を指定する。Data Flow の定義は、ソース、変換、シンクをつないだグラフである。

## 3. Azure IR のコンピューティング設定

Azure IR に、コンピューティングの種類、コア数、TTL（Time to live）を設定する。この設定が、実行に使う Spark クラスターの規模と、クラスターを実行後に保持する時間を決める。

## 4. Spark クラスターの起動と再利用

ADF は Data Flow の実行時に、Azure IR の設定で Spark クラスターを用意する。クラスターは ADF が管理し、利用者は内部のホストへ直接アクセスしない。TTL を設定すると、実行後もその間はクラスターが残り、次の実行で再利用できる。TTL を使わない実行では、そのつどクラスターの起動を待つ。再利用の判定条件と起動時間は未確認である。

## 5. ソースから変換、シンクまで

クラスターは、ソース変換で入力のデータストアを読み、変換を順に適用し、シンク変換で出力のデータストアへ書く。変換はフィルター、結合、集計、派生列などである。

## 6. シナリオ

アクティビティが Data Flow の定義と Azure IR を指定する。IR の設定でクラスターを起動するか、TTL 内の既存クラスターを再利用し、変換グラフを渡す。Spark がソースを読み、変換を適用し、シンクが出力先へ書く。

## 7. 実装例：ADF の Azure IR と ADLS Gen2

ADF のパイプラインが Data Flow アクティビティを実行する。Azure IR のコンピューティング設定で ADF 管理の Spark クラスターを用意し、ADLS Gen2 の raw を読み、変換して curated に書く。

| 機能 | 担い手 |
| --- | --- |
| Data Flow アクティビティ、Data Flow の定義 | ADF パイプラインと Data Flow の定義 |
| Azure IR のコンピューティング設定 | Azure IR |
| Spark クラスター | ADF 管理の Spark クラスター |
| ソース、変換、シンク | Spark 上の Data Flow の各段 |
| 入力・出力のデータストア | ADLS Gen2 の raw と curated |

Microsoft が運用するのは Spark クラスターを含む ADF のサービス基盤である。利用者が管理するのは、Data Flow の定義、Azure IR のコンピューティング設定、ストレージのデータと権限である。Azure には AWS 用の `management.type` を流用しない。この構成は公式資料を組み合わせた代表例で、動作検証済みの導入事例ではない。

## 8. 未確認

クラスターの起動時間、再利用の判定条件、Spark への変換方式の詳細は未確認である。コア数、TTL、パーティション数の最適値は、データ量と変換内容による。ネットワーク経路と料金は未指定である。

## 公式資料

- [Mapping data flows in Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/concepts-data-flow-overview)
- [Mapping data flow performance and tuning guide](https://learn.microsoft.com/en-us/azure/data-factory/concepts-data-flow-performance)
- [Data Flow activity in Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-execute-data-flow-activity)
