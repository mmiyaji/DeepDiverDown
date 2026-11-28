# Materialize の概要（ストリーミング SQL・増分ビュー・クラスタ）

資料の取得日は 2026年11月28日。公式資料は materialize.com/docs と GitHub のライセンスファイルで確かめた。取得できなかった論点は「未確認」と書く。

## 1. 概要とライセンス

Materialize は、外部のデータ源の変更を SQL で継続的に処理し、ビューの結果を増分で保つストリーミングデータベースである。公式資料はインデックス付きビューとマテリアライズドビューを「ビューの結果を増分で保つ」ものと説明する。クライアントの接続は pgwire（PostgreSQL 互換）と HTTP で、接続を受ける balancerd がそのプロキシにあたる。

ライセンスは Business Source License 1.1（BSL）で、ソースコードは公開されている。ただし OSI の定義するオープンソースではない。GitHub の LICENSE の記載は次のとおり。

- Change Date: 2030年11月28日。この日に Apache License 2.0 へ切り替わる（Change License）。
- Additional Use Grant: 1 つのインストールで、全クラスタのメモリ上限の合計が 24 GiB 未満、ディスク上限の合計が 48 GiB 未満なら使える。1 つのアプリケーションを複数のインストールに分けて上限を回避することはできない。第三者が定義するビューを作らせる「Database Service」として商用提供することも許可されない。
- 上限を超える自前運用の条件は、取得した資料では未確認。

- [Materialize LICENSE](https://github.com/MaterializeInc/materialize/blob/main/LICENSE)
- [Materialize concepts](https://materialize.com/docs/concepts/)

## 2. コンポーネント（自前の Kubernetes 運用）

自前運用は Kubernetes 上で行う。Helm チャートが Materialize Operator（`orchestratord`）を配置し、Operator が Materialize のカスタムリソースからインスタンスを作って管理する。構成要素は次の 4 つ。

- balancerd: pgwire と HTTP のプロキシで、クライアント接続を environmentd へ振り分ける。Deployment で動く。
- environmentd: データベースの制御プレーン。StatefulSet で動く。
- clusterd: 計算資源。StatefulSet で動く。
- console: Web の管理画面。Deployment で動く。

AWS・Azure・GCP 向けの Terraform モジュールと導入手順、ローカルの Kind 向け手順がある。メタデータの保存先と永続化の置き場所（PostgreSQL・S3 互換ストレージなど）は、取得したページに記載がなく未確認。ライセンスキーの要否も未確認。

- [Self-managed deployments](https://materialize.com/docs/self-managed-deployments/)

## 3. クラスタとレプリカ

クラスタは CPU・メモリ・スクラッチディスクの計算資源のまとまりで、ソース、シンク、インデックス、マテリアライズドビュー、`SELECT` と `SUBSCRIBE` が動く。クラスタ同士は計算資源が分かれ、障害も独立する。同じクラスタ内の処理は資源を取り合う。

レプリカは同じ処理を同じデータに対して行う冗長なコピーで、シャードではない。レプリケーション係数でレプリカ数を決め、1 つが使えれば処理を続ける。係数を上げても処理能力は上がらず、能力を上げるにはクラスタのサイズ（`25cc`、`50cc` など）を上げる。クラウド版ではレプリカごとにサイズ×係数で秒単位に課金される。

- [Clusters](https://materialize.com/docs/concepts/clusters/)

## 4. ソースと取り込み

ソースは Materialize が読む外部システムの定義で、`CREATE SOURCE` で作る。対応は次のとおり。

- ネイティブの CDC: PostgreSQL、MySQL、SQL Server
- Kafka コネクタ経由: CockroachDB の changefeed、MongoDB（Debezium）
- メッセージブローカー: Kafka、Redpanda
- Webhook: Amazon EventBridge、Segment、HubSpot、Stripe など

推奨の書き方は `CREATE TABLE ... FROM SOURCE` で、上流の列の追加・削除を停止なしで扱える。旧来の `FOR` 構文はサブソースを自動で作る。テーブルとサブソースは読み取り専用で、上流の変更から Materialize が埋める。作成時に、その時点で読める上流データのスナップショットを取り、完了までテーブルへのクエリはブロックされる。ソースには専用のクラスタを割り当てることが推奨されている。

- [Sources](https://materialize.com/docs/concepts/sources/)

## 5. ビュー・インデックス・ハイドレーション

ビューは保存したクエリで、インデックス付きビューとマテリアライズドビューが結果を増分で保つ。インデックスは結果をメモリに置く。インデックスとマテリアライズドビューを保つメモリ上のデータ構造が Arrangement である。ハイドレーションは、オブジェクトのメモリ上の状態を Materialize のストレージ層と既存のインデックスから作り直す処理で、上流のシステムは読まない。

資料は「反応時間」を、データの鮮度とクエリの遅延の合計と定義する。

マテリアライズドビューの結果をどのストレージに置くか、タイムスタンプの付け方、一貫性の保証（厳密なシリアライザビリティなど）、内部の計算モデル（Differential Dataflow など）は、取得した資料に記載がなく未確認。

- [Materialize concepts](https://materialize.com/docs/concepts/)

## 6. 処理の流れ

1. クライアントが balancerd に接続し、environmentd へ渡る。
2. 上流のデータ源の変更を、ソースを動かすクラスタが取り込む。作成時はスナップショットを取る。
3. クラスタが、インデックスとマテリアライズドビューを増分で更新する。
4. クライアントは、そのクラスタ上で `SELECT` や `SUBSCRIBE` を実行して結果を読む。
5. シンクが、結果を外部のシステムへ書き出す。

## 7. 実装例：Kubernetes 上の自前運用

| 機能 | 具体的な担い手 |
| --- | --- |
| クライアント | pgwire 対応のクライアント、console |
| 接続の振り分け | balancerd の Deployment |
| 制御プレーン | environmentd の StatefulSet |
| インスタンスの管理 | Materialize Operator（orchestratord） |
| 計算・ビュー・インデックス | clusterd の StatefulSet |
| ストレージ層 | 実体は未確認 |
| 上流・下流 | 外部のデータ源とシンクの宛先 |

利用者が自前のサーバー群で Kubernetes と Materialize を運用する構成。公式資料に基づく代表例であり、導入事例や動作検証済みの構成ではない。ストレージ層の実体、台数、ノードサイズ、ネットワークは未確認。Materialize のクラウド版（利用者が運用しない提供形態）の内部構成は、今回は取得しておらず図にしていない。
