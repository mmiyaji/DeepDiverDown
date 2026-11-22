# モデル仕様（v0）

```js
window.MODEL = {
  name: 'システム名',
  source: 'docs/xxx.md',            // 元になった設計書
  tiers: [ {id:'edge',label:'エッジ'}, {id:'app',label:'アプリ'}, {id:'data',label:'データ'} ], // 配列の先頭が最上階
  nodes: {
    order: {
      label: '注文サービス',
      kind: 'service',              // client | cdn | lb | service | worker | db | queue | cache | external
      tier: 'app', x: 3, y: 1,      // フロア上のグリッド座標
      replicas: 2,                  // 冗長台数（SPOF 判定に使用）
      metrics: { p95: 180, cost: 420, rps: 120 },  // ms / USD月 / req/s
      src: '§3.2',                  // 設計書の該当箇所
    },
  },
  links: [
    { id:'o2p', from:'order', to:'payment', sync:true, protocol:'HTTPS', timeoutMs:3000, retry:2, label:'決済依頼' },
  ],
  scenarios: [
    { id:'checkout', label:'注文確定', steps:[ { links:['web2o'], note:'説明' } ] },
  ],
};

window.ACTUAL = {   // 実環境から取得した構成（任意）
  nodes: { order:{replicas:1} , debug:{label:'踏み台', kind:'service', tier:'app', x:8,y:3} },
  links: [ ['order','payment'] ],   // [from, to] または {from, to}
};
```

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
