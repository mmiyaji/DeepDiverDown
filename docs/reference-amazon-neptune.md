# Amazon Neptune の基本アーキテクチャ

## 1. 概要

Amazon Neptune は AWS のフルマネージドなグラフデータベースである。プロパティグラフ（openCypher、Gremlin）と RDF（SPARQL）を扱い、1 つのクラスターにライター 1 台とリーダー最大 15 台が接続する。データは 3 つの AZ にまたがるクラスターボリュームに置く。2026 年 11 月時点の公式資料に基づく。

[What Is Amazon Neptune?](https://docs.aws.amazon.com/neptune/latest/userguide/intro.html)

## 2. データモデルとクエリ言語

プロパティグラフは openCypher と Gremlin の両方で同じグラフにアクセスできる。W3C の RDF モデルは SPARQL でアクセスする。内部の基本単位は subject・predicate・object・graph の 4 つ組（クアッド）で、graph の位置は RDF では名前付きグラフの識別子、Gremlin ではエッジ ID に使う。プロパティグラフと RDF を同じグラフで混在させられるかは今回の資料で未確認。

[Neptune Graph Data Model](https://docs.aws.amazon.com/neptune/latest/userguide/feature-overview-data-model.html)

## 3. ライターとリーダー

クラスターはプライマリ DB インスタンス（ライター）1 台と、読み取り専用のリードレプリカ（リーダー）最大 15 台で構成する。書き込みはすべてライターが調整し、ライターは読み取りも受ける。全インスタンスが同じボリュームを共有するため、リーダーの結果はレプリケーション遅延が小さく、通常は 100 ミリ秒よりかなり短い。ライターが落ちるとリーダーの 1 台へ自動フェイルオーバーする。リーダーがない場合は、ライターの再作成までクラスターが使えない。クエリスレッド数は vCPU の 2 倍で、待ち行列は約 8000 件。

[DB Clusters and Instances](https://docs.aws.amazon.com/neptune/latest/userguide/feature-overview-db-clusters.html)

## 4. エンドポイント

クラスターエンドポイントは現在のライターへ接続し、書き込みに使う。リーダーエンドポイントはリーダーへラウンドロビンで接続する。DNS の向き先を切り替える方式で、接続後は同じホストに固定される。インスタンスごとのエンドポイントと、最大 5 つのカスタムエンドポイントもある。ポートの例は 8182。Neptune はクエリ単位の負荷分散をしないため、必要ならアプリ側で行う。

[Neptune endpoints](https://docs.aws.amazon.com/neptune/latest/userguide/feature-overview-endpoints.html)

## 5. クラスターボリューム

データは NVMe SSD ベースの単一の仮想ボリューム（クラスターボリューム）に置く。1 つの AWS リージョン内の 3 つの AZ にコピーを持ち、最大 128 TiB（中国リージョンと GovCloud は 64 TiB）まで拡張する。書き込みは 6 つのコピーのうち 4 つが応答した時点で永続化とみなす。ディスク障害はバックグラウンドで自己修復する。連続バックアップは S3 に取る。保存時の暗号化は AWS KMS の鍵で行い、ネットワークは VPC で分離する。ボリュームの内部構成は利用者から直接操作できない。セグメントの大きさなど内部の詳細は未確認。

[Storage, reliability and availability](https://docs.aws.amazon.com/neptune/latest/userguide/feature-overview-storage.html)

## 6. Neptune Analytics との違い

Neptune Database はクラスターボリュームに永続化し、クエリ数の多い OLTP 向けで、Multi-AZ とリードレプリカで可用性を確保する。Neptune Analytics はメモリ最適化の分析エンジンで、グラフをメモリに載せてグラフアルゴリズムとベクトル検索を実行する。データは S3 または Neptune Database から読み込む。Analytics は openCypher を使う。計算資源はグラフの大きさに応じて自動で確保される。別サービスのため、本図の Analytics は Database のクラスターの外に置く。Analytics が SPARQL や Gremlin に対応するか、課金単位（m-NCU）の詳細は今回の資料で未確認。

[Neptune Analytics vs Neptune Database](https://docs.aws.amazon.com/neptune-analytics/latest/userguide/neptune-analytics-vs-neptune-database.html)

[Neptune Analytics Features](https://docs.aws.amazon.com/neptune-analytics/latest/userguide/neptune-analytics-features.html)

## 7. 提供状況

Neptune Database は米国 4 リージョン、アフリカ 1、アジア太平洋 11、カナダ 2、欧州 7、イスラエル 1、中東 2、南米 1、GovCloud 2 の 31 リージョンのサービスエンドポイントが公開されている（東京 ap-northeast-1、大阪 ap-northeast-3 を含む）。Neptune Analytics の提供リージョンは今回の資料で未確認。Serverless と Global Database は今回の取得範囲になく未確認。

[Amazon Neptune endpoints and quotas](https://docs.aws.amazon.com/general/latest/gr/neptune.html)

## 8. 実装例：AWS 上の Neptune Database クラスター

| 機能 | 具体的な担い手 |
| --- | --- |
| アプリ | 利用者のアプリケーション（Gremlin・openCypher・SPARQL クライアント） |
| 書き込み | ライター（プライマリ DB インスタンス）とクラスターエンドポイント |
| 読み取り | リーダー（リードレプリカ）とリーダーエンドポイント |
| 保存 | クラスターボリューム（3 AZ、6 コピー） |
| バックアップ | S3 への連続バックアップ |
| 分析 | Neptune Analytics のグラフ |

代表的な構成であり、導入事例や動作検証済みの構成ではない。ノード数、インスタンスクラス、VPC・サブネットの構成は未確認。
