# モデル仕様（v1・YAML）

モデルは `models/<id>/model.yaml`、実環境スナップショットは `models/<id>/actual.yaml`。
`models/registry.json` に `{ "id": "...", "actual": true|false }` を追加すると画面に出る。

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

## 3D ビュー
ドラッグで回転、右ドラッグ / Shift+ドラッグで移動、ホイールで拡大縮小。右上のボタンで 斜め / 真上 / 横 / 裏側 に切り替え。

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
各モデルファイルは `window.MODELS['<id>'] = { model, actual }` に登録し、`index.html` に `<script>` を1行足す。
画面上部のセレクタ、または `#<id>` で切り替える。

## AWS 構成の表現（js/aws.js）
- `node.svc`：`ecs` `lambda` `aurora` `sqs` など。形状・カテゴリ色・略称が自動で付く
- `node.az`：`['a','c']` のように配置 AZ。1つだけだと SINGLE_AZ 指摘
- `node.subnet`：`public` / `private`。データストアが public だと PUBLIC_DATA 指摘
- `groups`：`{ kind:'vpc'|'az'|'subnet', label, tier:'app' | ['app','data'], x0,y0,x1,y1 }` で範囲を描く

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
| PUBLIC_DATA | データストアがパブリックサブネット |
| NO_APPROVAL | 承認を経ずに本番デプロイへ到達できる（pipeline） |
| NO_TEST | テストを経ずにデプロイへ到達できる（pipeline） |
| NO_ROLLBACK | 本番デプロイに自動ロールバック経路がない（pipeline） |
| SLOW_PIPELINE | 最長経路の所要時間が目標を超える（pipeline） |
| SOD | 承認者が自分 / 同じチームのコードを承認できる（職務分掌） |
| SINGLE_PERSON | 運用・承認などの担当が 1 名（属人化） |
