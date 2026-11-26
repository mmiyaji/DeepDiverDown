# BigQuery：Capacitor とストレージの最適化

2026 年 11 月時点の公式資料に基づく。取得資料に記述がない箇所は「未確認」と書く。

## 1. 範囲
BigQuery の管理ストレージにテーブルを置くとき、列指向の保存、パーティションとクラスタリングによる読み取りの絞り込み、保持と課金の設定がどう関わるかを示す。クエリの実行は [BigQuery：クエリ実行とスロット](reference-bigquery-dremel-slots.md) で扱う。

## 2. 書き込み
データはバッチロードや Storage Write API でテーブルへ書き込まれる。ストレージは自動的に割り当てられ、複数ゾーンへ複製される。公式資料は年間耐久性 99.999999999% を記載している（自己申告の設計値）。保存データは自動で暗号化され、顧客管理の鍵も選べる。

出典 [Overview of BigQuery storage](https://docs.cloud.google.com/bigquery/docs/storage_overview)

## 3. Capacitor
BigQuery のストレージは列指向で、形式は Capacitor と呼ばれる。列ごとにまとめて保存するため、クエリは参照した列だけを読める。ファイル構造と Colossus との関係は取得資料に記述がなく未確認。

出典 [Overview of BigQuery storage](https://docs.cloud.google.com/bigquery/docs/storage_overview)

## 4. パーティションとクラスタリング
資料はパーティションとクラスタリングを、ストレージの最適化の手段として挙げている。パーティションは日付などの列で区画に分け、クラスタリングは指定した列で並びをそろえる（Iceberg 管理テーブルの資料には最大 4 列とある）。どちらもクエリの条件で読む範囲を絞る目的で使う。詳細な条件と効果は取得資料では未確認。

出典 [Overview of BigQuery storage](https://docs.cloud.google.com/bigquery/docs/storage_overview)

## 5. 読み取り
クエリのステージは READ ステップでテーブルを読む。読み取り量を減らす設定は、条件に使う列がパーティション列かクラスタリング列かで効き方が変わる。効果の大きさは未検証。

出典 [Query plan and timeline](https://docs.cloud.google.com/bigquery/docs/query-plan-explanation)

## 6. 自動の再配置
書き込みで崩れたクラスタリングの順序を Google が自動で整える機能があるとされるが、取得資料に記述がなく、条件と費用は未確認。Iceberg 管理テーブルでは、適応的なファイルサイズ調整、自動クラスタリング、ガベージコレクション、メタデータ最適化が記載されている（[Iceberg レイクハウス](reference-bigquery-lakehouse-iceberg.md) を参照）。

## 7. 保持と課金
タイムトラベルとフェイルセーフの保持はデータセットの設定で決まる。フェイルセーフの期間は変更できない。日数は取得資料に記載がなく未確認。課金は論理（非圧縮、既定）と物理（圧縮）をデータセット単位で選ぶ。変更は反映まで 24 時間かかり、再変更は 14 日後まで行えない。物理課金ではタイムトラベルとフェイルセーフの保存が別に課金される。

出典 [Overview of BigQuery storage](https://docs.cloud.google.com/bigquery/docs/storage_overview)

## 8. 実装例 パーティション・クラスタリング済みの管理表
| 機能 | 担い手 | 設定 |
|---|---|---|
| 取り込み | Storage Write API を使うアプリ | 受注行を書き込む |
| テーブル | orders テーブル | 日付パーティション、顧客 ID クラスタリング |
| 列指向ファイル | BigQuery の管理ストレージ | Google が運用し、直接アクセスはない |
| 読み取りの絞り込み | クエリ条件 | 日付と顧客 ID で絞る |
| 保持と課金 | データセットの設定 | タイムトラベルの期間、物理課金 |

利用者はテーブル定義、データセット設定、IAM を操作する。ストレージの内部と自動再配置は Google が運用する。読み取り量の削減効果は未検証で、公式資料を組み合わせた構成例である。

## 9. 未確認
- Capacitor のファイル構造、Colossus との関係、自動再クラスタリングの条件。
- タイムトラベルとフェイルセーフの日数。
- ストレージ書き込み最適化の挙動。

## 10. 参考資料
- [Overview of BigQuery storage](https://docs.cloud.google.com/bigquery/docs/storage_overview)
- [Query plan and timeline](https://docs.cloud.google.com/bigquery/docs/query-plan-explanation)
