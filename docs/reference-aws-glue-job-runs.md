# AWS Glue：ジョブの実行とワーカー

## 1. 対象

Glue の Spark ETL ジョブ 1 回分の実行を扱う。起動要求、ワーカーの確保、入力の読み取りと出力、ジョブブックマークの更新、ログと指標を追う。Crawler と Data Catalog は別の図（AWS Glue：Data Catalog とクローラー）で扱う。

## 2. 起動と設定

ジョブ定義はスクリプトの S3 パス、IAM ロール、AWS Glue バージョン、ワーカータイプ、ワーカー数、ブックマーク、リトライ回数（0〜10）、タイムアウトを持つ。実行はこの定義と、起動時に上書きしたパラメーターで始まる。同時実行数の既定は 1 で、上限に達すると実行はエラーになる。ジョブ実行のキューイングを有効にすると、リソース不足時に失敗せず待機する。タイムアウトに達した実行は再試行されない。出典 [Spark ジョブのプロパティ](https://docs.aws.amazon.com/glue/latest/dg/add-job.html)

## 3. ワーカーと DPU

1 DPU は 4 vCPU・16 GB のメモリである。ワーカータイプごとの DPU は G.1X が 1、G.2X が 2、G.4X が 4、G.8X が 8 で、いずれもワーカー 1 台に Spark Executor が 1 個載る。G.025X は 0.25 DPU で、Glue 3.0 以降のストリーミングジョブ向けである。G.12X、G.16X、R.1X〜R.8X は起動遅延が大きく、利用できるリージョンも限られる。Glue 2.0 以降のジョブは Maximum capacity を使わず、ワーカータイプと台数で指定する。課金は使った DPU の数と時間に基づく。ドライバーが載るワーカーの割り当ては公式資料で確認できておらず、図でも別部品として扱う。

## 4. ジョブブックマーク

ブックマークはジョブ名ごとの状態で、source・transformation・sink の各要素を `transformation_ctx` で区別して保存する。スクリプトの `job.init` で最新の状態を取得し、`job.commit` で保存する。S3 入力ではオブジェクトの最終更新時刻で新規ファイルを判定するため、更新されたファイルは再処理される。JDBC 入力は主キーなどのブックマークキーで判定する。

設定は Enable、Disable（既定）、Pause の 3 つである。Pause は状態を更新しない。リセットや巻き戻しでも出力先のファイルは削除されないため、重複を避けるには出力先を分ける。ジョブを削除するとブックマークも消える。出典 [ジョブブックマーク](https://docs.aws.amazon.com/glue/latest/dg/monitor-continuations.html)

## 5. 結果とログ

Executor が出力先へ書く。CloudWatch への指標はジョブ設定の Job metrics で有効にする。継続的ログを有効にしないと、ログは完了後にしか見られない。Spark UI はログの出力先を指定して有効にする。出典 [Spark ジョブのプロパティ](https://docs.aws.amazon.com/glue/latest/dg/add-job.html)

## 6. シナリオ

`run-and-bookmark` を順に選ぶ。起動要求と設定からワーカーが確保され、ドライバーがブックマークを取得し、Executor が未処理の入力を読んで出力する。成功時にブックマークが進み、次回の実行は新しい入力だけを読む。

## 7. 実装例：AWS Glue の Spark ジョブ

Glue の Spark ジョブを G.1X ワーカーで実行する代表例である。S3 の入力を読み、ブックマークを有効にして新しいファイルだけを処理し、別の S3 プレフィックスへ書く。公式資料を組み合わせた構成で、実動作は未検証である。

| 機能 | 担い手 |
| --- | --- |
| 実行の起動要求 | Glue Trigger または手動・API による実行 |
| スクリプトと実行設定 | S3 上のスクリプトとジョブ定義 |
| ジョブ実行の管理 | Glue のジョブ実行（Job Run） |
| Spark ドライバー、Executor | Glue が管理する実行基盤のワーカー |
| ジョブブックマーク | Glue のジョブ単位の状態 |
| 入力データ、出力先 | Amazon S3 |
| ログと指標 | Amazon CloudWatch Logs と指標 |

実装で加わる部品は IAM 実行ロールである。ワーカーとジョブ基盤は AWS が確保・運用し、利用者は内部を直接操作できない。利用者はジョブ定義、ワーカータイプ、台数、スクリプト、権限、データを管理する。Glue 内部の基盤構成は公開資料で確認できておらず、図に描き足していない。[AWS 共有責任](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html)

## 8. 未確認

ドライバーの載るワーカー、ワーカー確保にかかる時間、ブックマークの保存場所の詳細、実環境の動作は未確認である。

## 公式資料

- [Configuring job properties for Spark jobs in AWS Glue](https://docs.aws.amazon.com/glue/latest/dg/add-job.html)
- [Tracking processed data using job bookmarks](https://docs.aws.amazon.com/glue/latest/dg/monitor-continuations.html)
- [AWS Glue How it works](https://docs.aws.amazon.com/glue/latest/dg/how-it-works.html)
- [Logging and monitoring in AWS Glue](https://docs.aws.amazon.com/glue/latest/dg/logging-and-monitoring.html)
