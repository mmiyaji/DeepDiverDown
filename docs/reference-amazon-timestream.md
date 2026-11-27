# Amazon Timestream（Timestream for LiveAnalytics）の基本アーキテクチャ

## 1. 概要と図の対象

Amazon Timestream は AWS のマネージド時系列データベースである。この図の対象は **Amazon Timestream for LiveAnalytics** である。AWS は 2025 年 6 月 20 日付で LiveAnalytics の新規顧客の受け付けを終了した。既存の顧客のワークロードは影響を受けず、有効な支払いアカウントの既存顧客は、そのアカウントの下でユーザーとリンクアカウントを追加できる。AWS は新規顧客に Timestream for InfluxDB を検討するよう案内している。2026 年 11 月 27 日に公式ページを取得した時点でも、この記載のままだった。

[Amazon Timestream for LiveAnalytics availability change](https://docs.aws.amazon.com/timestream/latest/developerguide/AmazonTimestreamForLiveAnalytics-availability-change.html)

LiveAnalytics の終了（サポート終了）日は、取得した公式ページに記載がなく未確認。

## 2. LiveAnalytics と InfluxDB の関係

Timestream for InfluxDB は別のエンジンで、オープンソース InfluxDB の 2.x ブランチを DB インスタンスとして動かす。インスタンスは VPC に置き、既定のポートは 8086、Multi-AZ ではスタンバイを別の AZ に 1 台置く。LiveAnalytics はサーバーレスでインスタンスを持たない。この図は LiveAnalytics だけを描き、InfluxDB は描かない。InfluxDB 3 系を Timestream が提供しているかは、取得した公式ページで確認できず未確認。InfluxDB の資料には、古いデータを LiveAnalytics に書き出して長期保存する案が書かれているが、公式の連携機能かどうかは未確認。

[Timestream for InfluxDB](https://docs.aws.amazon.com/timestream/latest/developerguide/timestream-for-influxdb.html)

## 3. メモリストアとマグネティックストア

ストレージは 2 層である。メモリストアは高スループットの書き込みと、直近のデータへの高速なクエリ向けである。マグネティックストアは遅れて届くデータの書き込み、長期保存、分析クエリ向けである。どちらも同じリージョンの複数の AZ にレプリケートされ、書き込みはディスクに保存してから完了を返す。データは転送中も保存時も暗号化され、マグネティックストアには AWS KMS のカスタマー管理キーを指定できる。

[Storage](https://docs.aws.amazon.com/timestream/latest/developerguide/storage.html)

## 4. 保持期間

保持期間はテーブルごとに設定する。データの経過時間はデータポイントのタイムスタンプで計算する。メモリストアの保持期間を過ぎたデータは自動でマグネティックストアへ移り、マグネティックストアの保持期間を過ぎると完全に削除される。両方の合計が、データが保存される期間になる（例：メモリ 1 週間とマグネティック 1 年なら、到着から 1 年と 1 週間）。保持期間を延ばしても、マグネティックストアからメモリストアへデータは戻らない。

| 設定 | 最小 | 最大 | 既定 |
| --- | --- | --- | --- |
| メモリストア | 1 時間 | 8,766 時間 | 6 時間 |
| マグネティックストア | 1 日 | 73,000 日（約 200 年） | 73,000 日 |

[Quotas](https://docs.aws.amazon.com/timestream/latest/developerguide/ts-limits.html)

## 5. 取り込み

書き込みは WriteRecords API で行う。AWS SDK、CLI のほか、AWS Lambda、AWS IoT Core、Amazon Managed Service for Apache Flink、Amazon Kinesis、Amazon MSK、Telegraf からも書ける。バッチロード機能もある。事前のスキーマ定義は不要で、ディメンションと測定値から列が自動で検出される。既定では先着優先で重複は拒否され、バージョンを指定した upsert もできる。1 リクエストは最大 100 レコードで、将来側は現在時刻から 15 分先まで受け付ける。

メモリストアの保持期間より古い遅延データは、テーブルでマグネティックストア書き込みを有効にした場合だけ書ける。有効化には、テーブル作成時に拒否データの保存先として S3 バケット（MagneticStoreRejectedDataLocation）を指定し、呼び出し側に `s3:PutObject` の権限が必要である。マグネティックストアへの書き込みから読み取りまでの遅延は最大 6 時間で、メモリストアはサブ秒である。読み取りは結果整合である。

[Writes](https://docs.aws.amazon.com/timestream/latest/developerguide/writes.html)

## 6. クエリ

クエリエンジンは、保存場所を指定せずにメモリストアとマグネティックストアのデータをまとめて読む。問い合わせは SQL で、平滑化・近似・補間の時系列関数、ウィンドウ関数、配列や行の型を使える。Grafana、Amazon Quick、JDBC 経由の BI ツールで可視化できる。1 回のクエリの実行時間は最大 1 時間である。スケジュールクエリと UNLOAD の仕組みは quota 表に項目があるが、動作の詳細は今回確認しておらず未確認。

[What is Amazon Timestream for LiveAnalytics?](https://docs.aws.amazon.com/timestream/latest/developerguide/what-is-timestream.html)

## 7. 管理区分

LiveAnalytics はサーバーレスで、容量のプロビジョニングは不要である（クエリ側の TCU 上限設定はある）。基盤は AWS が運用する。利用者が制御できるのは、データベース・テーブル、保持期間、マグネティックストア書き込みの有効化、KMS キー、IAM の権限、拒否データ用 S3 バケットである。内部のノード構成は公開資料で確認しておらず、図には描かない。

## 8. 実装例：AWS 上の LiveAnalytics

| 機能 | 具体的な担い手 |
| --- | --- |
| 書き込み元 | アプリ、IoT デバイス、Telegraf など（AWS 外のクライアント） |
| 取り込み | WriteRecords API |
| 直近データ・履歴データ | メモリストア、マグネティックストア |
| 保持期間 | テーブルの保持ポリシー |
| 拒否データの保存先 | 利用者の S3 バケット |
| 暗号化 | KMS カスタマー管理キー |
| 読み出し | Timestream のクエリエンジン、BI ツール |

提供元は AWS のみである。公式資料を組み合わせた代表的な構成であり、導入事例や動作検証済みの構成ではない。2026 年 11 月時点では新規顧客はこの構成を新しく作れない。
