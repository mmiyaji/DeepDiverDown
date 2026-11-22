// 実環境（AWS / IaC）から取得した構成のサンプル。実運用では Terraform state や API から生成する想定。
window.ACTUAL = {
  capturedAt: '2026-11-22 09:00',
  nodes: {
    user: {}, cdn: { replicas: 99 }, alb: { replicas: 2 },
    web: { replicas: 3 }, order: { replicas: 1 },          // 設計 2 台 → 実際 1 台
    inv: { replicas: 2 }, pay: { replicas: 1 }, notify: { replicas: 1 },
    psp: {}, mail: {}, db: { replicas: 1 },                 // Multi-AZ 未設定
    kafka: { replicas: 3 },
    // redis が存在しない（ElastiCache 未作成）
    batch: { label: '集計バッチ', kind: 'worker', tier: 'app', x: 0, y: 3, replicas: 1 }, // 設計書にない
  },
  links: [
    ['user','cdn'],['cdn','alb'],['alb','web'],['web','order'],['order','inv'],['inv','order'],
    ['order','pay'],['pay','psp'],['order','db'],['inv','db'],['order','kafka'],['kafka','notify'],['notify','mail'],
    ['batch','db'],                                         // 設計書にない接続
  ],
};
