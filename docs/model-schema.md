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

## 指摘ルール（js/lint.js）
| ID | 内容 |
|---|---|
| SPOF | client / external 以外で replicas < 2 |
| NO_TIMEOUT | 同期リンクに timeoutMs がない |
| SYNC_CHAIN | クライアントから同期呼び出しが 4 段以上続く |
| CYCLE | 同期呼び出しが循環している |
| SHARED_DB | 1つの DB に複数サービスが直接アクセス |
| RETRY_STORM | retry ありで下流の timeout が上流より長い |
