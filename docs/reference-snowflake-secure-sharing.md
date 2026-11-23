# Snowflake Secure Data Sharing の公開と失効

## 1. 共有シナリオ

卸先に注文集計を渡す例。モデルは直接共有できる配置のアカウントを対象とする。リージョンやクラウドをまたぐ場合は別途レプリケーションなどの前提を確認する。

## 2. 公開する内容

基表の全列を渡す必要はない。注文集計から配布対象アカウントに応じて行や列を制限する secure view を作成し、必要な権限を share に割り当てる。公開直前に受領側の見え方を確認する。

## 3. 受領側の読み取り

受領側は share から読み取り専用データベースを作り、自分のウェアハウスでクエリする。この構成の共有参照は基表を受領側へ複製する処理を必要としない。Reader account では費用負担などの条件が異なる。

## 4. アクセスを終了する

提供側で受領者または対象オブジェクトへの共有アクセスを取り消す。受領者がアクセス時に別途エクスポートしたデータの扱いは取り決めで管理する。

## 図で確認するシナリオ

- **限定ビューを共有して分析する** — 公開用ビューと権限を定義し、受領アカウントを指定する。 → 受領側から共有を参照するデータベースを作る。 → 受領側ウェアハウスが、許可されたデータを読む。
- **共有契約の終了** — 終了前に公開対象と利用状況を確認する。 → 対象の共有を取り消し、以後のクエリを制限する。

## 公式資料

- [Secure Data Sharing の概念](https://docs.snowflake.com/en/user-guide/data-sharing-intro)
- [共有用の secure object](https://docs.snowflake.com/en/user-guide/data-sharing-secure-views)

## 5. 実装例 Snowflake アカウント間の Direct Share

同一リージョンの 2 つの Snowflake アカウント間で、受注の公開用ビューを共有する例。

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| 提供側の管理者 | 提供者側データ管理ロール | 共有先アカウントを選択する。 |
| 提供側の注文集計 | 提供側 SALES.ORDERS_SUMMARY | 社内分析用の集計表。 |
| 共有用のアクセス制御ビュー | SALES.ORDERS_PUBLIC SECURE VIEW | 提供を許可した行・列だけを公開する。 |
| データ公開と受領者の定義・共有の取り消し | Snowflake SHARE と受領者割当 | 共有対象の権限と受領者を変更して以後の参照を制御する。 |
| 受領者の読み取り専用参照口 | 受領側 ORDERS_SHARED データベース | CREATE DATABASE FROM SHARE で作る読み取り専用の参照口。 |
| 受領側のクエリ実行資源 | 受領側の BI_WH | 受領側の計算資源で共有データをクエリする。 |

提供側で Share に受領アカウントを加え、受領側で参照権限を設定する。共有を失効させても、受領者が事前に別の対象へ出力した結果の回収はこの仕組みの対象外である。

出典 [Secure Data Sharing の概念](https://docs.snowflake.com/en/user-guide/data-sharing-intro)、[共有用の secure object](https://docs.snowflake.com/en/user-guide/data-sharing-secure-views)、[Snowflake: Create and configure shares](https://docs.snowflake.com/en/user-guide/data-sharing-provider)
