# 引き継ぎ方針書（2026-11-22 時点）

Claude Code から Codex へ作業を引き継ぐためのメモ。まずこのファイルと `README.md`・`docs/model-schema.md`・`docs/AGENTS.md` を読むこと。

---

## 1. プロジェクトの目的と前提
- 設計書・IaC・コードから「根拠付きの構造化モデル（YAML）」を起こし、3D 図解・動き・指摘・点検で、設計上の問題点と未確認箇所を人間が把握しやすくする。
- **個人学習用・無保証**（README 冒頭の免責事項を維持すること）。
- 公開リポジトリ：https://github.com/mmiyaji/DeepDiverDown （main に push 済み）

## 2. 作業の約束事（必ず守る）
| 項目 | 内容 |
|---|---|
| 言語 | 応答・コミットメッセージ・ドキュメントは日本語 |
| コミット | 種類は `add`（新機能）/ `update`（改善）/ `fix`（バグ）/ `refactor`。`Co-Authored-By` は付けない |
| ブランチ | `feature/<内容>` などで切る。main に直接コミットしない。マージは `--no-ff` |
| 作成者メール | このリポジトリは `git config user.email` を GitHub の noreply（`763537+mmiyaji@users.noreply.github.com`）に設定済み。個人メールを公開履歴に入れない |
| push・公開 | ユーザーの許可があるときだけ |
| 検証 | 変更後に `npm test` と、画面に関わる変更はブラウザで確認。確認していないことは「未確認」と報告する |
| 依存 | `vendor/`・`icons/`・`node_modules/` は git 管理外（`npm ci` の postinstall で `vendor/` を生成） |
| 公式アイコン | 各社の規約があるため**リポジトリに同梱しない・代わりにダウンロードしない**（ユーザーが手元の `icons/` に置く） |
| 改行 | Windows 環境。Node で書き換えるときは改行コードに注意 |

## 3. 起動と主なコマンド
```
npm ci                                      # 依存取得 + vendor/ 生成
python -m http.server 8124 --bind 0.0.0.0   # 画面 → http://localhost:8124/#/m/ec-shop/struct
npm test                                    # 単体テスト（node --test、現在 24 件すべて成功）
npm run gates                               # 点検（サンプルは意図的に不合格 → exit 1 が正常）
npm run index                               # models/<id>/index.json を再生成
npm run import:tf -- state.json --out models/<id>/actual.yaml
npm run import:k8s -- manifests.yaml --out models/<id>/actual.yaml
npm run extract -- --id <id> --doc docs/x.md [--dry-run]   # Claude API。未検証（認証情報なし）
node tools/icons.mjs                        # icons/ のアイコンから icons/manifest.json を作る（新規・未接続）
```

## 4. コード構成（要点）
| ファイル | 役割 |
|---|---|
| `js/catalog.js` | **新規（作業中）**。マルチクラウドのサービスカタログ `window.Catalog`。`svc: "gcp:gke"` 形式、接頭辞なしは AWS。互換のため `window.AWS` / `window.AWS_CAT` も定義 |
| `js/analyze.js` | 指摘ルール（15）・障害伝播・確度判定（fact/claim/unknown/drift）・網羅率・点検・索引・比較。ブラウザと Node（`tools/load.mjs` の vm）で共用 |
| `js/views.js` | ビュー変換（logical / cloud / network）と状態の合成 |
| `js/layout.js` | 座標のない部品の自動配置 |
| `js/scene3d.js` | Three.js 描画（正射影カメラ・OrbitControls・CSS2D ラベル・パケット・PNG 書き出し） |
| `js/app.js` | 画面全体（ルーティング・モード・パネル・検索・設定・共有・比較）。解析は物理モデルで行い、`VW()` でビューに写して描く |
| `js/loader.js` / `js/settings.js` | モデル読込（registry・ローカル YAML・比較対象）/ 設定（localStorage） |
| `tools/*.mjs` | 点検・索引・比較・取り込み（tf / k8s）・抽出（Claude API）・vendor・icons |
| `models/<id>/` | `model.yaml`（正）・`actual.yaml`（実環境スナップショット）・`index.json`（生成物）。一覧は `models/registry.json` |

## 5. 現在のブランチの状態
- `main`：ビュー切り替えまでマージ・push 済み（CI 成功）。
- `feature/multi-cloud`：**作業途中**（このファイルと一緒に WIP としてコミット）。テスト 24 件成功・画面はエラーなしで動く状態。
  - 済：`js/catalog.js`（AWS / Google Cloud / Azure / OCI / Cloudflare / オンプレ / Kubernetes のサービス・カテゴリ色・プロバイダー色・基盤フラグ・アイコン検索キーワード）
  - 済：`js/aws.js` を削除し `catalog.js` に置換（index.html・tools/load.mjs）
  - 済：`views.js` の基盤判定にカタログの `infra` を利用、`analyze.js` の PUBLIC_DATA をカタログ参照に
  - 済：新ルール `CROSS_CLOUD_SYNC`（プロバイダーをまたぐ同期呼び出し、注意）
  - 済：`tools/icons.mjs`（icons/<provider>/ を走査して manifest.json を作る）、`.gitignore` に `icons/`
  - 未：以下 6 章の残作業

## 6. 残作業（優先順）
ユーザーの要望：「Google Cloud・Azure・Oracle Cloud・Cloudflare・オンプレに対応」「GKE と書いてあるだけでは分からない（どのクラウド・どのクラスタの中かを図で示す）」「公式アイコンセットを使えるように」「3D と 2D を切り替えたい」。

### 6.1 app.js をカタログに切り替える（小）
- `nodeSpec`（`window.AWS?.[n.svc]` / `AWS_CAT`）・`nodeDetail` の種別表示・検索の `sub` を `Catalog.lookup(n.svc)` に置き換える。
- 種別表示は「`GKE｜Google Cloud`」のように **サービス名＋プロバイダー名** を出す。
- `shape` は `lookup.shape`、なければ `kind`（db / cache → cyl、queue → queue）。k8s のエントリは shape を持たないので kind で決まる。

### 6.2 プロバイダーが図で分かるようにする（中）
- **部品の下にサブラベル**：`scene3d.js` の `node()` に `sub`（例 `GKE｜Google Cloud`）を追加し、名前ラベルの下に小さく表示（CSS クラス `n-sub` を追加。色はプロバイダー色）。
- **境界の枠**：`groups` に新しい種類を追加し、プロバイダー色で描く。
  - `cloud`（プロバイダー／アカウント・プロジェクト：実線・プロバイダー色・ラベル左上にプロバイダー名）、`region`（破線）、`cluster`（K8s クラスタ：一点鎖線・#326CE5）、`namespace`（点線）、`datacenter`（オンプレ DC：実線・灰）、`vnet` / `vcn`（VPC と同じ扱い）。
  - `group.provider` で色を決める。`scene3d.group()` に色の引数を追加。
  - **枠の自動範囲**：`x0` などを省略し `nodes: [...]`（または省略で同じ tier の全部品）を指定したら、描画時に所属部品の座標から範囲を計算（±0.8）。自動配置のモデルでも枠を描けるようにするため。
- ビューごとの表示：`cloud` ビューでは `cloud / region / cluster / vpc / vnet / vcn / datacenter` を出し、`az / subnet / namespace` は出さない。`network` ビューは全部。`logical` は出さない（`views.js` の `cloud()` のフィルタを更新）。

### 6.3 取り込みの対応（中）
- `tools/import-tfstate.mjs` の `TYPES` に追加（キーは `provider:svc`）：
  - Google：`google_container_cluster`→`gcp:gke`、`google_cloud_run_v2_service`→`gcp:cloudrun`、`google_sql_database_instance`→`gcp:cloudsql`、`google_pubsub_topic`→`gcp:pubsub`、`google_storage_bucket`→`gcp:gcs`、`google_compute_global_forwarding_rule`→`gcp:clb`、`google_redis_instance`→`gcp:memorystore`
  - Azure：`azurerm_kubernetes_cluster`→`azure:aks`、`azurerm_linux_web_app`→`azure:appservice`、`azurerm_mssql_database`→`azure:sqldb`、`azurerm_servicebus_namespace`→`azure:servicebus`、`azurerm_key_vault`→`azure:keyvault`、`azurerm_application_gateway`→`azure:appgw`、`azurerm_cdn_frontdoor_profile`→`azure:frontdoor`、`azurerm_storage_account`→`azure:storage`、`azurerm_redis_cache`→`azure:redis`
  - OCI：`oci_containerengine_cluster`→`oci:oke`、`oci_database_autonomous_database`→`oci:adb`、`oci_load_balancer_load_balancer`→`oci:lb`、`oci_objectstorage_bucket`→`oci:objectstorage`、`oci_core_instance`→`oci:compute`
  - Cloudflare：`cloudflare_zone`→`cloudflare:dns`、`cloudflare_worker_script`→`cloudflare:workers`、`cloudflare_r2_bucket`→`cloudflare:r2`、`cloudflare_tunnel`→`cloudflare:tunnel`
  - 台数は分かる範囲で（AKS：`default_node_pool[0].node_count` など）。テストを `tests/import.test.mjs` に追加。
- `tools/import-k8s.mjs`：ワークロードに `svc: k8s:deployment`（StatefulSet は `k8s:statefulset`）を付ける。`type: LoadBalancer` の Service は部品 `service/<名前>`（`svc: k8s:service`、`tier: app`）にし、宛先ワークロードへの接続を追加。

### 6.4 Online Boutique を GKE 構成として描く（中）
- `models/online-boutique/model.yaml`：
  - 各サービスに `svc: k8s:deployment`、Redis は `kind: cache`（形は円柱のまま）。
  - 外部公開の `frontend-external`（`svc: gcp:clb`、根拠 doc §2.2 と `{ type: iac, ref: service/frontend-external }`）を追加し、利用者 → LB → frontend に変更。
  - `groups`：`{ kind: cloud, provider: gcp, label: "Google Cloud（プロジェクト）", tier: [app, data] }`、`{ kind: cluster, provider: gcp, label: "GKE クラスタ", tier: [app, data] }`、`{ kind: namespace, label: "namespace: default", tier: [app, data] }`（範囲は 6.2 の自動計算）。
  - フロア名「アプリケーション（GKE）」→「アプリケーション」。
- `actual.yaml` は 6.3 後に `npm run import:k8s -- samples/online-boutique/kubernetes-manifests.yaml --out models/online-boutique/actual.yaml` で再生成。

### 6.5 ハイブリッド構成のサンプル（中）
新規 `models/hybrid/`（`registry.json` に追加）。座標は手書きでよい。例：
- エッジ（横並びゾーン）：Cloudflare DNS / WAF / CDN
- Azure（`cloud` 枠）：Application Gateway → AKS（zones 1/2/3）→ Azure SQL、Service Bus、Key Vault
- OCI（`cloud` 枠）：Autonomous Database（基幹 ERP の DB）、FastConnect
- オンプレ（`datacenter` 枠）：FW → 基幹サーバー（2 台）→ オンプレ DB（1 台）、VPN 装置、運用者（社内 VPN）
- Google Cloud（`cloud` 枠）：BigQuery（分析。Azure SQL から非同期でエクスポート）
- 狙い：`CROSS_CLOUD_SYNC`（AKS → OCI ADB、Service Bus → オンプレ）や、VPN 1 台・オンプレ DB 1 台の単一障害点が指摘されること。設計書 `docs/sample-hybrid.md`（架空）と requirements / unknowns も付ける。

### 6.6 公式アイコン（中）
- 画面：起動時に `icons/manifest.json` を fetch（なければ無視）→ `Catalog.setIcons()`。
- `nodeSpec` の `abbr` の代わりに、アイコンがあれば `icon: url` を渡し、`scene3d.node()` で CSS2D の `<img class="n-icon">`（26px 程度）を部品の上に表示。PNG 書き出し（`snapshot()`）で `<img>` も `drawImage` する。
- 設定に「公式アイコンを使う」（既定 ON、manifest があるときだけ有効）。
- README に各社の配布ページと「同梱しない・規約に従う」旨を記載：
  - AWS Architecture Icons：https://aws.amazon.com/architecture/icons/
  - Google Cloud：https://cloud.google.com/icons
  - Azure Architecture Icons：https://learn.microsoft.com/azure/architecture/icons/
  - OCI：https://docs.oracle.com/iaas/Content/General/Reference/graphicsfordiagrams.htm
  - Cloudflare：公式のブランド資料（利用条件を確認）
  - Kubernetes：https://github.com/kubernetes/community/tree/master/icons
- `catalog.js` の `icon` キーワードは推測で書いたもの。実際の配布物で `node tools/icons.mjs` を実行し、「見つからなかった」に出たものを調整する。

### 6.7 3D / 2D の切り替え（中）
- 2D：真上からの正射影で回転を禁止（`controls.enableRotate = false`、`fit('top')`）。
- 積み重ねたフロアは真上から見ると重なるので、2D では **フロアを縦（奥行き方向）に並べ直す**：`W()` の Y を 0 にし、z に「フロアの段 × (最大フロア奥行き + 余白)」を足す。横並びゾーン（origin）はそのまま。
- 部品は高さを小さく（0.25 程度）、ラベルはそのまま。リンクのフロア間の縦線は 2D では水平線になる。
- 切り替え UI は 3D ビューの左上（回転／移動の隣）に「3D / 2D」、キー `D`。URL に `d=2`、設定に既定値。2D のときは回転／移動の切替を「移動」に固定。

### 6.8 仕上げ
- `docs/model-schema.md`（svc 形式・プロバイダー・新しい groups の種類・アイコン・2D）と README（現状表・対応クラウド・公式アイコン）を更新。
- テスト追加：`Catalog.lookup`（接頭辞あり／なし）、`CROSS_CLOUD_SYNC`、k8s の LoadBalancer 部品、tfstate の他クラウド、`views` の cloud ビューでの枠の出し分け。
- ブラウザで各モデル × 3 ビュー × 3D/2D を確認 → `feature/multi-cloud` を main にマージ（`--no-ff`）→ ユーザーの許可を得て push。

## 7. 既知の課題（今回の範囲外）
- 自動配置で同じ列に部品が多いと縦長になる（Online Boutique）。
- 抽出 CLI（Claude API）は実 API で未検証。Terraform 取り込みは架空の state でのみ確認。
- 大規模モデル（100 部品超）の表示性能・ラベル重なり、画面上での編集は未対応。
- リポジトリのライセンスは未設定（README に明記済み。ユーザーの判断待ち）。
