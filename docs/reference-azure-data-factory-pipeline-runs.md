# Azure Data Factory：パイプライン実行と Integration Runtime

## 1. 対象

トリガーがパイプライン実行を開始し、アクティビティが Integration Runtime（IR）に割り当てられるまでを扱う。IR は Azure IR、セルフホステッド IR、Azure-SSIS IR の 3 種類である。制御フローの経路と、データが通る経路を分けて示す。

## 2. トリガーとパイプライン実行

トリガーはスケジュールやイベントなどの条件でパイプライン実行を開始する。実行ごとに実行 ID が付き、パイプラインに定義したアクティビティが実行される。

## 3. アクティビティの種類

アクティビティはデータ移動、データ変換、制御の 3 系統に分かれる。制御アクティビティは、依存条件、分岐、繰り返しでパイプラインの進行を決める。コピーアクティビティはデータ移動に当たり、実行時に IR へ割り当てられる。

## 4. Integration Runtime の役割

Linked Service は、接続先に到達する IR を指定する。IR ごとの役割は次のとおり。

| IR | 主な担当 |
| --- | --- |
| Azure IR | パブリックに到達できるストア間のコピー、Data Flow の実行、アクティビティのディスパッチ |
| セルフホステッド IR | 私設ネットワーク内のストアを対象にしたコピーとディスパッチ。利用者が用意したマシンで動く |
| Azure-SSIS IR | SSIS パッケージの実行 |

## 5. 制御フローとデータ移動の経路

制御フローはトリガー、パイプライン実行、アクティビティの順に進み、IR の選択で終わる。データはアクティビティを経由せず、割り当てられた IR とデータストアの間を通る。図では、私設側を読んでクラウドへ書くセルフホステッド IR の経路と、クラウド間コピーの Azure IR の経路を描く。

## 6. シナリオ

社内データベースの表をクラウドのストレージへコピーする。トリガーが実行を開始し、依存条件を満たしたコピーアクティビティが、Linked Service の指定に従ってセルフホステッド IR に割り当てられる。

## 7. 実装例：ADF と 3 種類の IR

Azure 側の Data Factory にトリガー、パイプライン、Linked Service を定義する。クラウド間のコピーは Azure IR、自前ネットワークの読み取りは、利用者が用意したマシン上のセルフホステッド IR が担う。SSIS パッケージは Azure-SSIS IR に割り当てる。

| 機能 | 担い手 |
| --- | --- |
| トリガー、パイプライン実行、制御アクティビティ、Linked Service | ADF のトリガーとパイプライン |
| コピーアクティビティ | ADF のコピーアクティビティ |
| Azure IR | Azure IR |
| セルフホステッド IR | 自前ネットワークの IR マシン |
| Azure-SSIS IR | Azure-SSIS IR |
| クラウドのデータストア | Azure Blob Storage |
| 私設ネットワーク内のデータストア | 社内のデータベース |

Microsoft が運用するのは、Azure IR のコンピューティングを含む ADF のサービス基盤である。利用者が管理するのは、パイプラインと Linked Service の定義、IR の設定、セルフホステッド IR のマシンとその更新、ストアのデータと権限である。Azure には AWS 用の `management.type` を流用しない。この構成は公式資料を組み合わせた代表例で、動作検証済みの導入事例ではない。

## 8. 未確認

アクティビティを IR に割り当てる内部方式、並列度、IR とストア間のネットワーク経路、料金は未確認である。Azure-SSIS IR からデータストアへの経路は図に描いていない。

## 公式資料

- [Pipeline execution and triggers in Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipeline-execution-triggers)
- [Integration runtime in Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/concepts-integration-runtime)
- [Create a self-hosted integration runtime](https://learn.microsoft.com/en-us/azure/data-factory/create-self-hosted-integration-runtime)
