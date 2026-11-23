# モデル仕様（v1・YAML）

モデルは `models/<id>/model.yaml`、実環境スナップショットは `models/<id>/actual.yaml`。
`models/registry.json` に `{ "id": "...", "name": "一覧での表示名", "actual": true|false }` を追加すると画面に出る。
一覧はモデル YAML を取得せずに表示するため、登録時は `name` に YAML と同じ表示名を指定する。省略時は ID を表示する。

```yaml
name: システム名
sources: [docs/xxx.md]            # 網羅の分母になる設計書（番号付き見出し ## 3.2 … が節になる）
evidence:                          # モデル全体の根拠（概要の節など）
  - { type: doc, ref: "docs/xxx.md#§1" }
inventory:                         # 網羅の分母になる IaC リソース等
  - { type: iac, ref: aws_ecs_service.api }
tiers: [...]                       # 後述
nodes:
  order:
    label: 注文サービス
    kind: service                  # client | cdn | lb | service | worker | db | queue | cache | external | actor
    shape3D: plug                  # 任意。3D 案1と 2D のシルエット・カード内アイコンの形状を指定（plug | crate）
    tier: app
    x: 3
    y: 1
    replicas: 2
    metrics: { p95: 180, cost: 420, rps: 120 }
    evidence:                      # 根拠（必須）。type: doc | iac | code | actual
      - { type: doc, ref: "docs/xxx.md#§3.2" }
      - { type: iac, ref: aws_ecs_service.order, at: "infra/ecs.tf:18", says: { replicas: 1 } }  # says が食い違えば「ずれ」
    # status: unknown              # 判定を明示で上書きしたいときだけ
links:
  - { id: o2p, from: order, to: payment, sync: true, timeoutMs: 3000, retry: 2, evidence: [...] }
scenarios:
  - { id: checkout, label: 注文確定, evidence: [...], steps: [ { links: [w2o], note: 説明 } ] }
requirements:                      # 技術に依存しない層
  - { id: BR-01, kind: rule, title: 在庫引当は決済より前, text: ..., links: [o2i, o2p], evidence: [...] }
  # kind: usecase（scenario: で紐付け）| rule | state（states: [...]）| nfr
unknowns:                          # 確かめられなかったこと。推測で埋めずにここへ
  - { id: UNK-01, text: Web → 注文 のタイムアウト値が不明, refs: [w2o] }
gates: { maxDrift: 0, maxHigh: 0 } # 点検のしきい値
```

## 確度の判定（js/analyze.js `classify`）
1. `status` があればそれ
2. `evidence[].says` の値が要素と食い違う → **ずれ**
3. `actual.yaml` と比べて欠落・台数差 → **ずれ**、一致 → **事実**
4. `iac` / `code` / `actual` の根拠あり → **事実**
5. `doc` の根拠のみ → **主張**
6. 根拠なし → **不明**

## 点検（tools/gates.mjs・画面の「根拠と確度」）
| ID | 合格条件 |
|---|---|
| COVERAGE | 設計書の全節・inventory・実環境の部品が、どこかの要素の根拠になっている |
| BROKEN_REF | 根拠が指す設計書の節が存在する |
| UNKNOWN_ACK | 不明な要素はすべて `unknowns` に登録されている |
| DRIFT | ずれが `gates.maxDrift` 件以下 |
| REQ_TRACE | 要件がすべて構成要素・シナリオに紐付いている |
| HIGH_ISSUES | 重大な指摘が `gates.maxHigh` 件以下 |

## 索引（tools/build-index.mjs → models/<id>/index.json）
- `byId`：ID → 種類・ラベル・確度
- `byRef`：参照先（`docs/xxx.md#§3.2`、`docs/xxx.md`、IaC リソース、`infra/ecs.tf`）→ ID の配列（逆引き。影響調査に使う）

## 3D / 2D 表示
左上の「回転／移動」（R / M キー）で左ドラッグの役割を切り替え。右ドラッグはもう一方の操作、ホイールで拡大縮小。右上のボタンで 斜め / 真上 / 横 / 裏側 に切り替え。

`D` キーまたは左上のボタンで 3D / 2D を切り替える。2D は真上から表示し、積層フロアを高さごとに縦に並べる。同じ高さのゾーンは `origin` に従って配置される。URL の `d=2` で 2D、`d=3` で 3D を指定する。障害シミュレーションの停止部品は `down=` に入る。

## フロアの配置（tiers）
```js
tiers: [
  { id:'internet', label:'インターネット', kind:'origin', z:1, origin:[-11,0], size:[1,3] }, // アクセス元（点線のゾーン）
  { id:'office',   label:'社内（VPN）',    kind:'origin', z:0, origin:[-11,0], size:[1,3] },
  { id:'edge',     label:'エッジ',         z:1, origin:[-7.6,0], size:[4,3] },           // アプリと同じ高さで手前に並べる
  { id:'app',      label:'アプリケーション', z:1 },
  { id:'data',     label:'データ',         z:0 },
]
```
- `z`：高さ（大きいほど上）。省略したフロアは配列順に積む
- `origin`：グリッド上のずらし量。x をマイナスにすると処理の流れ（左上→右下）の上流側に並ぶ
- `size`：床の大きさ（既定 10×4）
- `kind:'origin'`：利用者・運用者がどこからアクセスするかを示すゾーン

## 複数モデルの登録
`models/registry.json` に登録し、サイドバーまたは `#/m/<id>/struct` で切り替える。

## アーキテクチャリファレンス

1件につき `models/<id>/model.yaml` に構成部品・接続・シナリオを保持し、`docs/reference-<id>.md` に番号付きの解説を書く。部品や接続の `evidence` から解説の節を参照する。

`models/registry.json` の登録例

```json
{ "id": "spark", "name": "Apache Spark の基本アーキテクチャ", "actual": false, "reference": { "category": "バッチ処理", "order": 10 } }
```

- `name` はモデルを開く前に一覧に出す表示名。設計モデルにも指定でき、省略時は ID を表示する。
- `category` はサイドバー上の分野名。同じ分野を使うリファレンスは同じ文字列で登録する。分野は登録一覧での初出順。
- `order` は同じ分野内の表示順。小さい数字から表示し、省略時は末尾に置く。
- モデル YAML の `reference` には学習目標と公式資料を保持できる。次のフィールドは解説文の根拠を指すトップレベルの `sources` と独立している。

```yaml
reference:
  objectives:
    - Driver と Executor の役割を区別する。
  sources:
    - title: Apache Spark Cluster Mode Overview
      url: https://spark.apache.org/docs/latest/cluster-overview.html
```

`npm run index` で分野・順序・学習目標・資料リンクも索引に格納する。点検は参照先やモデル形式の確認に使える。運用を想定したルールは、個別の運用環境を定義しない解説モデルにも適用される。

## クラウド構成の表現（js/catalog.js）
- `node.svc` は `gcp:gke`、`azure:aks`、`oci:adb`、`cloudflare:waf`、`onprem:fw`、`k8s:deployment` のように指定する。`ecs` のように接頭辞を省略すると AWS として扱う。
- カタログからサービス名とプロバイダー名、カテゴリ色、略称、形状を得る。形状の指定がない場合は `kind` に従う。
- `node.provider` はカタログでサービスを特定できない部品のプロバイダーを指定するときに使う。
- `icons/manifest.json` に `provider:service` の対応があると、設定に従い略称の代わりに画像を表示する。導入手順は README の「公式アイコン」を参照。
- `node.az`：`['a','c']` のように配置 AZ。1つだけだと SINGLE_AZ 指摘
- `node.subnet`：`public` / `private`。データストアが public だと PUBLIC_DATA 指摘
- `groups` の `tier` にはフロア ID または配列を指定する。`x0, y0, x1, y1` でフロア内の範囲を固定できる。座標を省略すると `nodes` に列挙した部品から範囲を求める。`nodes` も省略すると対象フロアの全部品が対象になる。クラウドなどが重なる場合は境界の種類に応じて余白が異なる。
- `group.provider` には `aws` / `gcp` / `azure` / `oci` / `cloudflare` / `onprem` / `k8s` を指定できる。

| 枠の種類 | 表示 |
|---|---|
| `cloud` | プロバイダーやアカウント・プロジェクト。プロバイダー色の実線 |
| `region` | リージョン。破線 |
| `cluster` | Kubernetes クラスタ。青の一点鎖線 |
| `namespace` | Kubernetes 名前空間。点線 |
| `datacenter` | オンプレミス拠点。灰色の実線 |
| `vpc` / `vnet` / `vcn` | 仮想ネットワーク。破線 |
| `az` / `subnet` | 可用性ゾーン / サブネット |

## CI/CD パイプライン（type: 'pipeline'）
- フロア = 環境（例：CI → stg → 本番）。`node.stage`：`source` `build` `test` `artifact` `deploy` `approval` `env` `monitor`
- `metrics.duration`（分）でリードタイムを計算。`leadTimeLimit` が目標値
- 障害シミュレーションは下流へ伝播（実行されない）。`node.join:'any'` は別経路が生きていれば実行される
- 監視からの自動ロールバックは `{ from:'alarm', to:'deploy', kind:'rollback' }` で表す

## 登場人物（kind: 'actor'）
```js
lead: { label:'テックリード', kind:'actor', role:'approver', team:'決済チーム', headcount:1, tier:'prod', x:2, y:0 }
```
- `role`：`user`（利用者）`dev`（開発者）`approver`（承認者）`ops`（運用者）`admin`（管理者）`attacker`（攻撃者）。色分けした人型で描く
- `team` / `headcount`：職務分掌・属人化の指摘に使う
- 人物からのリンクは操作（push・承認・手動ロールバックなど）。障害シミュレーションで人物を「停止」すると不在を表せる
- 人物は SPOF 判定・実環境との差分の対象外

## 指摘ルール（js/analyze.js）
| ID | 内容 |
|---|---|
| SPOF | client / external 以外で replicas < 2 |
| NO_TIMEOUT | 同期リンクに timeoutMs がない |
| SYNC_CHAIN | クライアントから同期呼び出しが 4 段以上続く |
| CYCLE | 同期呼び出しが循環している |
| SHARED_DB | 1つの DB に複数サービスが直接アクセス |
| RETRY_STORM | retry ありで下流の timeout が上流より長い |
| SINGLE_AZ | AZ が1つだけ |
| CROSS_CLOUD_SYNC | 異なるクラウドやオンプレミス間を同期で呼び出す |
| PUBLIC_DATA | データストアがパブリックサブネット |
| NO_APPROVAL | 承認を経ずに本番デプロイへ到達できる（pipeline） |
| NO_TEST | テストを経ずにデプロイへ到達できる（pipeline） |
| NO_ROLLBACK | 本番デプロイに自動ロールバック経路がない（pipeline） |
| SLOW_PIPELINE | 最長経路の所要時間が目標を超える（pipeline） |
| SOD | 承認者が自分 / 同じチームのコードを承認できる（職務分掌） |
| SINGLE_PERSON | 運用・承認などの担当が 1 名（属人化） |

## ビュー（views）
同じモデルを 3 つの見せ方で表示する。指摘・点検・確度は常に物理モデルで計算し、表示だけをビューの部品にまとめる。

| ビュー | 内容 | 条件 |
|---|---|---|
| `logical` 論理構成（機能配置） | 基盤部品（CDN・LB・NAT・WAF・Route 53・Secrets Manager など）を隠し、通り抜けた接続を機能どうしの接続にする。配置は自動 | 常に |
| `cloud` 物理構成（サービス） | クラウドサービス単位。クラウド・リージョン・クラスタ・仮想ネットワーク・データセンターの枠。既定 | 常に |
| `network` 物理構成（ネットワーク） | すべての境界の枠と、複数 AZ の部品を AZ ごとの実体（`ecs@a`）に展開。台数は AZ で割る。AZ をまたぐ接続は黄色 | AZ / サブネット / 名前空間の情報があるとき |

```yaml
groups:
  - { kind: az, label: AZ-a, az: a, tier: [app, data], x0: -0.8, y0: -0.8, x1: 7.2, y1: 1.4 }  # az: で AZ を指定
views:
  default: cloud          # 初期表示（省略時 cloud）
  logical:
    tiers: [...]          # 省略時は物理のフロアから空になったものを除く
    components:           # 省略時は基盤以外の部品をそのまま機能とみなす
      order: { label: 注文・決済, tier: app, realizedBy: [checkoutservice, paymentservice], description: … }
```
- 基盤として隠したくない部品は、モデル側で `role` を変えるか components に含める（`role: infra` で明示的に隠すこともできる）
- 画面ではサイドバーの「ビュー」か `V` キーで切り替え。URL は `?w=logical` など

## 並列表現（分散・並列処理）
分散・並列で動く部分を図で分かるようにする。数値は説明用の例でよい（実際の数が設定で変わる場合は `N`）。

```yaml
nodes:
  executor: { label: Executor, kind: worker, tier: workers, parallel: N, slots: 4 }  # 同じ実行単位が並列 / 同時 4 Task
  input:    { label: 入力データ, kind: db, tier: storage, partitions: 6 }            # 6 分割されたデータ
groups:
  - { kind: parallel, label: Executor を並列に実行, tier: workers, nodes: [executor-a, executor-b] }
```
| 項目 | 図での表現 |
|---|---|
| `parallel` | 部品の後ろに写しを重ねて描き、「×N 並列」のバッジを付ける。単一障害点の指摘からは外す |
| `slots` | 上面に小さな立方体を並べ、同時に走る Task を示す。部品の下に「同時 N Task」 |
| `partitions` | データストアを分割数の段（帯）で描く。部品の下に「N 分割」 |
| `groups` の `kind: parallel` | 並列に動く部品群を、色付きの破線の枠と淡い塗りで囲む（範囲は部品から自動計算） |

## ドリルダウン（drill / parent）

- 部品に `drill: <モデルID>` を書くと、その部品の内部構造を表す別モデルへ移れる。図にバッジ「▼ 詳細図」が付き、詳細パネルのボタンか、部品のダブルクリックで開く。
- モデルに `parent: {model: <モデルID>, node: <部品ID>}` を書くと、ヘッダーに「↑ 上位の図」のパンくずが出て、上位の図のその部品を選んだ状態で戻れる。
- 例：物理ファイルフォーマットの Parquet → Parquet ファイルの内部、Iceberg 分散スキャンの metadata.json → Iceberg カタログ経由の読み取り → Data Files → Parquet ファイルの内部。

## ファイルの解剖図（fileLayout）と区画（kind: segment）

- 部品の `kind: segment` は、ファイル内の区画（ヘッダー、Row Group、ページ、フッターなど）を表す。3D では薄い板、2D では帯のアイコンで描き、単一障害点の指摘の対象外になる。
- モデルの `fileLayout` は 1 つの物理ファイルを、バイト順・大きさの比率どおりの帯で描く。
  - `file`：ファイル名、`note`：注記
  - `segments[]`：`id`、`label`、`bytes`（省略すると子の合計）、`kind`（magic / header / rowgroup / chunk / dict / page / index / footer で色分け）、`node`（対応する部品の ID。選ぶと図の部品も選ばれる）、`description`、`sample`（中身の例）、`children`（入れ子の区画）
- シナリオのステップに `read: [区画 ID]` を書くと、再生中にその範囲が帯の上で光る。読んだバイト数と全体に占める割合を表示し、最後のステップでは読まなかった範囲を灰色にする。

### 書き込みと位置の印（fileLayout の拡張）

- ステップの `write: [区画 ID]` は書き込み中の範囲をアクセント色で光らせる。
- `markers`（モデル）とステップの `marks` は、帯の上の位置の印。`[{label, at, tone}]` の形で書き、`at` はバイト数か `[区画 ID, 区画内の割合]`。`tone` は end／hw／consumer／retention／pos。ステップでは最新の `marks` を使う。
- 例：Kafka のパーティションログで、LEO・High Watermark・Consumer の位置を示す。

## メタデータの木（treeLayout）

- `treeLayout: {title, unit, levels, note, root}` で、左から右へ枝分かれする木を描く。各ノードは `id`・`label`・`kind`（meta／snapshot／list／manifest／data／delete）・`node`・`sub`・`description`・`sample`・`children`。
- ステップの `prune: [ID]` はその枝を除外（そのステップでは取り消し線、以後は灰色）、`read: [ID]` は読む葉を光らせる。除外した葉の件数を表示する。

## 分布（distribution）

- `distribution: {title, unit, maxNote, scaleMax, note, bars}` で棒グラフを描き、中央値と最大値の線、最大÷中央値の倍率を表示する。
- ステップの `highlight: [ID]` は棒を強調し、`bars: [...]` は分布を差し替える（例：AQE によるパーティション分割の前後）。`scaleMax` を書くと縦軸を固定して前後を比べやすくする。

- 分布に `summary: files` と `target`（目標サイズ）を書くと、ファイルサイズの集計（個数・合計・目標未満の個数）と目標線を表示する（コンパクションの前後比較）。

## 表（grid）

- `grid: {title, rowLabel, colLabel, unit, node, rows, cols, values, cellNote, note}` で、行×列のマス目（パーティション×保存ブロックなど）を描く。値の大きさで濃淡を付ける。
- ステップの `prune` / `read` は `row:行ID`、`col:列ID`、`行ID:列ID` で指定する。除外したマスと読むデータ量の割合を表示する。

## タイムライン（timeline）

- `timeline: {title, current, note, commits: [{id, label, time, kind, node, description, sample}]}` で、コミット（スナップショット）を時間順に並べる。`kind` は append／overwrite／delete／compact。
- ステップの `current`（現在の版）、`travel`（時点指定で読む版）、`expire`（失効した版）、`highlight` を反映する。

- 分布の棒に `from: [元の棒の ID]` を書くと、ステップの切り替えで動きが付く。複数を指定すると元の棒が飛んできて積み重なり 1 本にまとまり（結合）、1 本を指定すると元の棒から切り出されて移動する（分割）。同じ ID の棒は新しい位置へ滑る。前のステップに戻ると逆向きに動く。OS の「視差効果を減らす」設定では動かさない。

## ブロックの移動（blocks）と見取り図のタブ

- `blocks`（1 つ、または配列）で、箱（Worker・Consumer・ノード・層など）の間をデータの塊が動く図を描く。`{id, title, note, unit, legend: {色番号: 説明}, lanes: [{id, label, sub, node, optional}], items: {箱 ID: [塊]}}`。塊は `{id, label, k（色 0〜7）, w（幅）, from, note}`。
- ステップの `blocks: {箱 ID: [塊]}` で配置を差し替える。同じ ID の塊は新しい箱へ移動し、`from` が複数なら元の塊が飛んできて 1 つに結合、元が残っていれば複製、元が消えれば分割として動く。消えた塊はその場で沈んで消える。前のステップに戻ると逆向きに動く。
- ステップの `lanes: {箱 ID: {label, sub, tone}}` で箱の見出しや状態（tone: down／new／cold）を変え、`highlight` で塊を強調する。`optional: true` の箱は塊が入ったときだけ表示する。
- 見取り図が複数あるモデルでは、図の下の欄にタブが出る。シナリオに `visual: <見取り図の ID>`（file／tree／distribution／grid／timeline、または blocks の id）を書くと、再生時にその見取り図へ切り替わる。
