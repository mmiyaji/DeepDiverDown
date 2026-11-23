# DeepDiverDown

設計書・IaC・コードを「根拠付きの構造化モデル」に落とし、3D 図解・動き・指摘・点検で
人間が設計上の問題点と「どこがまだ確かめられていないか」を把握しやすくする実験プロジェクト。

> [!IMPORTANT]
> **個人の学習用プロジェクトです。動作・正確性・継続的な保守を含め、いかなる保証もしません。**
> - 指摘・点検・確度判定の結果は参考情報であり、設計レビューや監査の代わりにはなりません。誤検出・見落としがあります
> - 収録しているモデル・設計書・IaC はすべて説明用のサンプルです（`online-boutique` 以外は架空。Terraform の state も架空）
> - 次の機能は、設計書・回答・モデルの内容を外部の AI サービスに送信します。機密情報を含む資料に使う場合は、各自の責任で利用規約・社内規程を確認してください
>   - 抽出 CLI（`npm run extract`）：Anthropic の Claude API
>   - AI 設計支援（`npm run serve:ai`）：Claude Code CLI 経由で Anthropic、Codex CLI 経由で OpenAI
> - 公式アイコンは同梱していません。各社の配布物を手元に置いて使う場合は、各社の利用規約に従ってください
> - 予告なく仕様変更・公開停止することがあります。Issue / PR への対応も約束しません

## 現状（2026-11 時点）
| 項目 | 状態 |
|---|---|
| 3D ビューア（3D / 2D、3 ビュー × 8 モード・検索・比較・共有・書き出し・設定・スマホ対応） | 動作確認済み |
| 解析（指摘 15 ルール・障害伝播・確度判定・網羅率・点検・索引・比較・ビュー変換） | 単体テスト 27 件 |
| 対応クラウド | AWS、Google Cloud、Microsoft Azure、Oracle Cloud、Cloudflare、オンプレミス、Kubernetes |
| 自動配置 | 動作するが、同じ列に部品が多いと縦に長くなる |
| Terraform / Kubernetes 取り込み | サンプルで確認。実際の本番 state では未検証 |
| 抽出 CLI（Claude API） | `--dry-run` のみ確認。実 API 呼び出しは未検証 |
| GitHub Actions（CI） | main の既存 CI は成功。今回の変更はローカルで確認 |

既知の課題：大きなモデル（100 部品超）での表示性能・ラベルの重なり、画面上での部品の編集、日本語フォントは OS 標準に依存。

## 起動
```
npm ci                                       # 依存を取得。postinstall で vendor/ を生成（git 管理外）
                                             # --ignore-scripts で実行した場合は続けて npm run vendor
python -m http.server 8124 --bind 0.0.0.0   # → http://localhost:8124/#/m/ec-shop/struct
npm run gates                                # 点検（不合格なら exit 1）
npm run index                                # models/<id>/index.json（ID 索引・逆引き索引）を生成
```

## 構成
```
docs/             設計書（サンプル）・モデル仕様・AI エージェント向けルール（AGENTS.md）
prompts/          抽出（書き手）/ 検証（検証役）プロンプト
models/<id>/      model.yaml（唯一の正）・actual.yaml（実環境スナップショット）・index.json（生成物）
js/analyze.js     指摘ルール・障害伝播・確度判定・網羅率・点検・索引（ブラウザと Node で共用）
js/scene3d.js     Three.js 描画（回転・拡大縮小・移動、ラベル、パケット）
js/app.js         画面（モード・パネル）
tools/            gates.mjs（点検 CLI）・build-index.mjs（索引生成）・vendor.mjs（同梱物の生成）
vendor/           （生成物・git 管理外）three.js・js-yaml・欧文フォント。ライセンス文付き。画面は外部通信なしで動作
```

## パイプライン（Reverse Spec Flow の考え方を取り入れたもの）
```
設計書 / IaC / コード
   │ prompts/extract-model.md（書き手）── 根拠必須・推測禁止・2 層（構成 / 要件）
   ▼
models/<id>/model.yaml
   │ prompts/verify-model.md（別セッションの検証役）── 根拠が本当に裏付けているか
   ▼
tools/gates.mjs ── 網羅率・参照切れ・未登録の不明・ずれ・要件の紐付け・重大な指摘 → exit 0/1
   ▼
3D ビューア ── 構造 / シナリオ / 障害 / 指摘 / メトリクス / 根拠と確度 / 要件
```

## 画面
| 場所 | 機能 |
|---|---|
| ヘッダー | 検索（部品・ID・要件・根拠の参照先）、開く（YAML）、共有（視点込みのリンクをコピー）、画像（PNG / SVG）、レポート（Markdown）、ヘルプ、設定 |
| サイドバー | 設計モデル一覧と分野別のアーキテクチャリファレンス、表示モード、フロアの表示切替、選択部品の周辺だけ表示 |
| 構成図 | 3D / 2D、画面内最大化、回転 / 移動の切替、視点（斜め・真上・横・裏側）、クリックで選択 |
| 詳細パネル | モードごとの一覧・詳細。狭い画面では下から出るシート |

ビュー：論理構成（機能配置）/ 物理構成（サービス）/ 物理構成（ネットワーク）。`V` キーで切り替え（詳細は docs/model-schema.md）

表示モード：構造 / シナリオ / 障害シミュレーション / 指摘 / メトリクス / 根拠と確度 / 要件 / 比較

- **2D のラベル**：重なる場合は選択中の部品名と他の部品名を優先します。拡大すると、収まるラベルが再表示されます。
- **画像の書き出し**：ヘッダーの「PNG」「SVG」で、現在の視点と表示中のラベルを保存します。2D の「SVG 全体」は、ズームや移動に関係なく、現在のビューと表示設定で描画される図全体を保存します。書き出し用にラベルの重なりを計算し直します。SVG の図形と文字は編集でき、アイコンは PNG として SVG 内に埋め込まれます。
- **URL**：`#/m/<model>/<mode>?s=<部品>&…` で画面の状態を表す。2D は `d=2`。「共有」は視点（`v=`）も含める
- **YAML の読み込み**：画面へドラッグ＆ドロップ、または「開く」。ブラウザ内（localStorage）に最大 5 件保存し、外部には送信しない。比較モードでドロップすると比較対象として読み込む
- **比較**：`models/registry.json` の `compare` か、読み込んだ YAML と比べる。CLI は `npm run compare -- old.yaml new.yaml`
- **設定**：テーマ・ラベルの大きさ・パケットの速さ・初期の表示（3D / 2D）・視点・ドラッグの既定・公式アイコン・点検しきい値・ルールの有効/無効（ブラウザに保存）

| キー | 操作 |
|---|---|
| `/` | 検索 |
| `R` / `M` | ドラッグを回転 / 移動に |
| `F` / `N` | 選択部品に寄る / 周辺だけ表示 |
| `1`〜`8` | 表示モード |
| `←` `→` | シナリオのステップ |
| `[` | サイドバーの開閉 |
| `V` | ビューの切り替え |
| `D` | 3D / 2D の切り替え |
| `?` / `Esc` | ヘルプ / 閉じる・選択解除 |

## 要件定義・設計モード

ヘッダーの「設計」から、やりたいことを1行に1件書くと、要件の下書きになります。設計名を省略した場合は最初の要件名を使います。受け入れ条件や配置などの詳細は後から追記でき、必要に応じて構成部品、接続、未決事項を追加できます。要件には関連する部品や接続を紐付けられます。「レビュー」では未紐付け要件と既存の点検ルールによる指摘を確認できます。

下書きはブラウザ内に保存されます。「構成図で確認」を押すとモデル一覧に追加され、同じモデルを再び「設計」から編集できます。「YAML を保存」で通常のモデルファイルとして持ち出せます。入力した設計案は「主張」として扱い、実装済みかどうかは別途確認します。

### Claude Code CLI / Codex CLI と設計する

`claude auth login` または `codex login` で使う CLI にログインしたPCで `npm run serve:ai` を実行します。そのPCで [AI 対話用のビューア](http://127.0.0.1:8125/) を開き、「設定」→「AI 支援」→「実行先」で使う CLI を選びます。「設計」→「AI と設計する」でやりたいことを送信します。LAN 用の静的ビューアは従来どおり `npm run serve` で起動でき、AI 用とは別に下書きを保存します。

AI は回答によって設計が変わる質問を一問ずつ出し、要件・構成部品・接続の案を下書きに追加・更新します。「未定」は未決事項に残ります。途中で他の工程を開いて編集でき、人が編集した項目は AI の更新対象から外れます。対話用のサーバーは起動PCからだけ利用できます。AI に送信すると目的・回答履歴・現在の設計案が 選択した CLI を通じて外部へ送られます。

### 設計書の取り込みと指摘への対応

AI 用ビューアの「設計」→「AI で設計書を取り込む」で、Markdown・テキストのファイルを選ぶか本文を貼り付けます。原文の引用を確認し、取り込み案を下書きに反映できます。根拠が特定できない項目は取り込まず、確認が必要な点は未決事項に残します。

点検で出た指摘を選択して「AI に対応を相談」すると、対応案とモデル差分を確認できます。反映前に同じ指摘が再点検で残るかを表示します。既存モデルから始めた場合は対応案の下書きを作り、元のモデルは書き換えません。この点検はモデル上の判定です。実環境への変更と確認は別途行ってください。

## 取り込みと抽出（CLI）
| コマンド | 内容 |
|---|---|
| `npm run import:tf -- state.json --out models/<id>/actual.yaml` | `terraform show -json`（または tfstate v4）から実環境スナップショットと IaC 在庫を作る。AWS、Google Cloud、Azure、OCI、Cloudflare の対応リソースと、state から分かる台数・AZ を取り出す |
| `npm run import:k8s -- manifests.yaml --out models/<id>/actual.yaml` | Kubernetes マニフェスト（または `kubectl get -o yaml`）からワークロード・LoadBalancer Service・台数・接続（`*_ADDR` などの環境変数）を作る。宛先のない参照は `unresolved` |
| `npm run extract -- --id <id> --doc docs/x.md [--actual …]` | Claude API（claude-opus-5-5）で 書き手→形式チェック→検証役→点検。`ant auth login` か `ANTHROPIC_API_KEY` が必要。`--dry-run` で API を呼ばずに確認 |

- モデルの部品と取り込んだ部品は、同じ ID か、根拠の `{ type: iac, ref: <アドレス> }` で対応付く
- 座標（x, y）を省いた部品は自動配置される（`layout: auto` で全部並べ直し）

### 公開サンプルでの試行（online-boutique）
公開デモ [Online Boutique](https://github.com/GoogleCloudPlatform/microservices-demo)（Apache-2.0）の README を要約した設計書（`docs/sample-online-boutique.md`）だけからモデルを起こし、
公開マニフェストを参考に再構成した `samples/online-boutique/kubernetes-manifests.yaml` を取り込んで突き合わせた。
設計書から読み取れなかった接続 4 件、設計書の推測が誤っていた接続 1 件、存在しないサービスへの参照 1 件、全サービスが 1 台構成であることを検出した。

## 公式アイコン

公式アイコンはリポジトリに同梱しません。各社の利用条件に従って、手元の SVG / PNG を `icons/<provider>/` に展開し、`npm run icons` で対応表 `icons/manifest.json` を生成してください。対応表がある場合は設定で「公式アイコンを使う」を切り替えられます。対応する画像がないサービスは略称で表示します。

手元の AWS PowerPoint ツールキット（`.pptx`）は `icons/aws/` に置いて `npm run icons` を実行するか、次のようにファイルを指定できます。

```powershell
npm run icons -- --aws-pptx "C:\path\to\AWS-Toolkit.pptx"
```

画像の名前・代替テキスト・同じグループのラベルをカタログと照合し、確認できた埋め込み SVG / PNG を `icons/aws/pptx-icons/` に保存します。スライド内のネイティブ図形や、名前が特定できないアイコンには、公式配布ページの **Icon package** にある SVG / PNG を使ってください。SVG / PNG を直接配置した場合はそちらが優先されます。

- `aws` [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/)
- `gcp` [Google Cloud Product Icons](https://cloud.google.com/icons)
- `azure` [Azure Architecture Icons](https://learn.microsoft.com/azure/architecture/icons/)・[Microsoft Entra architecture icons](https://learn.microsoft.com/en-us/entra/architecture/architecture-icons)
- `oci` [OCI Architecture Diagram Toolkits](https://docs.oracle.com/iaas/Content/General/Reference/graphicsfordiagrams.htm)
- `cloudflare` [Cloudflare Developers の製品アイコン](https://github.com/cloudflare/cloudflare-docs/tree/production/src/icons)・[利用条件](https://github.com/cloudflare/cloudflare-docs/blob/production/LICENSE)・[商標ガイドライン](https://www.cloudflare.com/trademark/)
- `k8s` [Kubernetes Community Icons](https://github.com/kubernetes/community/tree/main/icons)

## テスト・CI
`npm test`（`node --test`）で解析処理の単体テスト。`.github/workflows/ci.yml` で push / PR 時に実行（点検はサンプルが意図的に不合格なので報告のみ）。

## 確度
| 状態 | 意味 | 図での表現 |
|---|---|---|
| 事実 | IaC・コード・実環境で確認 | 通常 / 実線 |
| 主張 | 設計書の記述のみ | 半透明・破線 |
| 不明 | 根拠なし（`unknowns` に登録して残す） | ほぼ透明・「？不明」 |
| ずれ | 資料どうしが食い違う | 朱の輪郭・「ずれ」 |

## 収録モデル
| ID | 内容 |
|---|---|
| `ec-shop` | EC サイト注文基盤（設計書 + 実環境スナップショット） |
| `aws-web` | AWS Web 構成（VPC / AZ / サブネット、IaC 根拠、IaC 在庫） |
| `cicd` | CI/CD パイプライン（ワークフロー定義を根拠に） |
| `online-boutique` | 公開デモ Online Boutique（GKE クラスタ、設計書要約 + Kubernetes 取り込み、自動配置） |
| `hybrid` | 架空のハイブリッド受注基盤（Azure・OCI・Google Cloud・Cloudflare・オンプレミス） |

## アーキテクチャリファレンス

初回は一覧用の登録情報と、表示する1件のモデル・根拠資料・実環境ファイル（ある場合）を読み込みます。サイドバーの点検結果も表示中の設計モデルにだけ表示します。別の設計モデルやリファレンスの本体は選んだとき、比較用モデルは比較やレポートに使うときに読み込みます。

公式資料に基づく解説モデルです。サイドバーの「アーキテクチャリファレンス」から分野別に探せます。各リファレンスは構成図・シナリオ・学習目標・公式資料を持てます。追加手順は [モデル仕様の「アーキテクチャリファレンス」](docs/model-schema.md#アーキテクチャリファレンス) を参照してください。

| ID | 内容 |
|---|---|
| `spark` | Apache Spark のクラスタ構成、バッチ処理、Shuffle、パーティション再計算。解説は [docs/reference-spark.md](docs/reference-spark.md) |
| `kafka` | Apache Kafka のパーティション、書き込み・複製・消費、リーダー切り替え。解説は [docs/reference-kafka.md](docs/reference-kafka.md) |
| `kafka-connect` | 外部DBから Kafka を経由する取り込み、保存と再開。解説は [docs/reference-kafka-connect.md](docs/reference-kafka-connect.md) |

| 分野 | 追加リファレンス |
|---|---|
| データ取り込み | [Debezium](docs/reference-debezium.md)、[Airbyte](docs/reference-airbyte.md)、[Fivetran](docs/reference-fivetran.md) |
| ストリーム処理 | [Spark Structured Streaming](docs/reference-spark-structured-streaming.md)、[Spark Streaming（DStreams）](docs/reference-spark-streaming.md)、[Apache Flink](docs/reference-flink.md)、[Kafka Streams](docs/reference-kafka-streams.md) |
| 構成概念 | [メダリオン](docs/reference-medallion.md)、[データレイクハウス](docs/reference-data-lakehouse.md)、[データクリーンルーム](docs/reference-data-clean-room.md)、[ETL と ELT](docs/reference-etl-elt.md) |
| テーブル形式とカタログ | [Apache Iceberg](docs/reference-apache-iceberg.md)、[Delta Lake](docs/reference-delta-lake.md)、[Apache Hudi](docs/reference-apache-hudi.md)、[Iceberg REST Catalog](docs/reference-iceberg-rest-catalog.md) |
| 変換とオーケストレーション | [dbt](docs/reference-dbt.md)、[Apache Airflow](docs/reference-apache-airflow.md)、[AWS Glue](docs/reference-aws-glue.md)、[Azure Data Factory](docs/reference-azure-data-factory.md)、[Google Cloud Dataflow](docs/reference-google-cloud-dataflow.md) |
| クラウド分析基盤 | [Snowflake](docs/reference-snowflake.md)、[Databricks](docs/reference-databricks.md)、[Google BigQuery](docs/reference-bigquery.md)、[Amazon Redshift](docs/reference-redshift.md)、[Microsoft Fabric](docs/reference-microsoft-fabric.md) |
| SQL エンジン | [Trino](docs/reference-trino.md) |
| 運用とガバナンス | [OpenLineage](docs/reference-openlineage.md) |

### コンテナオーケストレーション

Kubernetes、主要なディストリビューション・マネージドサービス、独自 API のオーケストレーターを、注文 API の配置と復旧の流れで比較します。[コンテナオーケストレーションのリファレンス一覧](docs/reference-container-orchestration-overview.md)

### データカタログ

[データカタログの責務と連携](docs/reference-data-catalog-architecture.md)から、Iceberg のテーブル解決とコミット、資産の発見、列リネージ、公開承認、アクセス制御を別々の責務として追えます。

- テーブルカタログは [Apache Polaris](docs/reference-apache-polaris.md) と [Project Nessie](docs/reference-project-nessie.md) で比較できます。
- 組織横断のメタデータは [DataHub](docs/reference-datahub.md) と [OpenMetadata](docs/reference-openmetadata.md) で比較できます。
- クラウド製品は [Amazon DataZone](docs/reference-amazon-datazone.md)、[Microsoft Purview](docs/reference-microsoft-purview.md)、[Fabric OneLake catalog](docs/reference-fabric-onelake-catalog.md)、[Google Cloud Knowledge Catalog](docs/reference-google-cloud-knowledge-catalog.md)、[Snowflake Horizon Catalog](docs/reference-snowflake-horizon-catalog.md)、[Databricks Unity Catalog](docs/reference-databricks-unity-catalog.md) を参照できます。製品の移行や提供条件も各資料に記載しています。

### Snowflake と Databricks の詳細図

| 機能 | Snowflake | Databricks |
|---|---|---|
| 取り込みと変換 | [Snowpipe・Streams／Tasks・Dynamic Tables](docs/reference-snowflake-ingestion-cdc.md) | [Lakeflow Connect・Auto Loader・宣言型パイプライン・Jobs](docs/reference-databricks-lakeflow.md) |
| SQL と性能 | [マイクロパーティション・ウェアハウス・結果再利用](docs/reference-snowflake-query-performance.md) | [SQL Warehouse・Photon・Liquid clustering・プロファイル](docs/reference-databricks-sql-performance.md) |
| ガバナンス | [Horizon Catalog](docs/reference-snowflake-horizon-catalog.md) | [Unity Catalog](docs/reference-databricks-unity-catalog.md) |
| 外部共有 | [Secure Data Sharing](docs/reference-snowflake-secure-sharing.md) | [OpenSharing（Delta Sharing）](docs/reference-databricks-open-sharing.md) |
| 製品固有のシナリオ | [Time Travel・クローン・Fail-safe](docs/reference-snowflake-time-travel.md) | [MLflow・モデル登録・Model Serving](docs/reference-databricks-mlflow-serving.md) |

### DWH 設計パターン

[DWH 設計パターンの選び方](docs/reference-dwh-design-patterns.md)を入口に、同じ受注データでメダリオン、Inmon CIF、Data Vault、Kimball バス、スター／スノーフレーク、SCD、ファクトの型、ワイドテーブル、集約と指標定義を比較できます。

### 大規模データ分析の基本概念

同じ受注データを使って、保存時の配置、読み取り、書き換え、分散実行のどこで各手法が効くかを比較できます。

| どこで使うか | リファレンス | 比較するポイント |
|---|---|---|
| 保存と振り分け | [パーティショニングとシャーディング](docs/reference-partitioning-sharding.md) | 日付で読み取り範囲を区切る。顧客キーで書き込み先を振り分ける |
| 読み取り | [ソートとプルーニング](docs/reference-sorting-pruning.md) | 保存順序と統計を使い、スキャンしなくてよい範囲を判断する |
| 保存の保守 | [コンパクション](docs/reference-compaction.md) | 小ファイルをまとめ、ファイルを開く負荷と書き換えコストを比較する |
| 分散実行 | [シャッフルとデータスキュー](docs/reference-shuffle-skew.md) | 結合キーで再配分し、作業が一部のタスクに偏る理由を追う |

ClickHouse と DuckDB の物理読み取り比較、PostgreSQL の WAL、Paimon、スキーマ互換性、基盤運用の追加項目は [追加調査と対応リファレンス](docs/reference-modern-data-stack-candidates.md#追加調査と対応リファレンス) に整理しています。

詳細は `docs/model-schema.md`。

## 動作環境
Node.js 22 以上（CLI・テスト）、Python 3（静的ファイルの配信。他のサーバーでも可）、WebGL が使えるブラウザ。

## クレジット・ライセンス
- 依存ライブラリ：[three.js](https://threejs.org/)（MIT）、[js-yaml](https://github.com/nodeca/js-yaml)（MIT）、[Inter](https://rsms.me/inter/) / [IBM Plex Mono](https://github.com/IBM/plex)（SIL OFL 1.1）、[Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)（MIT）。`npm ci` 時に `vendor/` へ各ライセンス文とともに配置
- `docs/sample-online-boutique.md` と `samples/online-boutique/` は [GoogleCloudPlatform/microservices-demo](https://github.com/GoogleCloudPlatform/microservices-demo)（Apache-2.0）の公開情報をもとに独自に要約・再構成したもの（原本の複製ではない）
- 「根拠と確度」の考え方は AWS の [Reverse Spec Flow](https://aws.amazon.com/jp/blogs/news/aidm-introducing-reverse-spec-flow/) の記事を参考にした
- このリポジトリ自体のライセンスは未設定（現時点では著作権者に権利が留保される）
