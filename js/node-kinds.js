/* モデルで指定する部品の種別と、構成図に共通の記号。 */
export const NODE_KINDS = {
  actor: { label: '関係者', shape: 'person', preferShape: true, description: '利用者、運用者、承認者など、操作する人や役割。', example: 'opa-conftest' },
  client: { label: 'クライアント', shape: 'box', description: 'Web、CLI、SDK など、要求を発行する側。', example: 'kubernetes' },
  service: { label: 'サービス', shape: 'box', description: 'API や、ほかの部品から利用される処理。', example: 'debezium' },
  worker: { label: 'ワーカー', shape: 'box', description: 'ジョブやタスクの実行を引き受けるプロセス。', example: 'spark' },
  external: { label: '外部システム', shape: 'box', description: 'モデルの管理範囲の外にある接続先。', example: 'temporal' },
  lb: { label: 'ロードバランサー', shape: 'box', description: '到達先を選び、要求や接続を振り分ける入口。', example: 'amazon-eks' },
  cdn: { label: 'CDN', shape: 'box', description: 'エッジ拠点からコンテンツを配信する部品。', example: 'ec-shop' },
  gateway: { label: 'ゲートウェイ', shape: 'box', description: '管理境界をまたぐ要求を受け付け、内部の処理へ中継する入口。', example: 'amazon-ecs' },
  host: { label: 'ホスト', shape: 'box', description: 'プロセスやコンテナを動かす物理マシン、仮想マシン、実行環境。', example: 'docker-swarm' },
  scheduler: { label: 'スケジューラー', shape: 'box', description: '待機するタスクの実行先や実行時刻を決める部品。', example: 'nomad' },
  db: { label: 'データストア', shape: 'cyl', description: 'データを永続化し、検索や読み書きの入口を提供する部品。', example: 'debezium' },
  cache: { label: 'キャッシュ', shape: 'cyl', description: '再利用する値や計算結果を一時的に保持する部品。', example: 'online-boutique' },
  queue: { label: 'キュー・ログ', shape: 'queue', description: '処理待ちのタスクや順序付きのイベントを保持する部品。', example: 'kafka-connect' },
  segment: { label: 'ファイル内区画', shape: 'slab', preferShape: true, description: 'ファイル内のブロック、行グループ、メタデータなどの区画。', example: 'parquet-internals' },
  catalog: { label: 'カタログ', shape: 'catalog', preferShape: true, description: '資産、スキーマ、テーブルなどを登録・検索・解決する台帳。', example: 'data-catalog-architecture' },
  file: { label: 'ファイル・成果物', shape: 'file', preferShape: true, description: 'マニフェスト、設定ファイル、出力ファイルなど個別の成果物。', example: 'opa-conftest' },
  table: { label: 'テーブル', shape: 'table', preferShape: true, description: 'ファクト、ディメンション、集計表など、データの表。', example: 'dwh-star-schema' },
  policy: { label: 'ポリシー', shape: 'policy', preferShape: true, description: 'アクセスや配備を許可する条件、またはそれを適用する機能。', example: 'cilium-hubble' },
  workflow: { label: 'ワークフロー制御', shape: 'workflow', preferShape: true, description: 'ジョブの依存関係、状態遷移、再試行などを調整する機能。', example: 'temporal' },
  monitor: { label: '監視・観測', shape: 'monitor', preferShape: true, description: 'ログ、メトリクス、トレースを収集・集約・表示する機能。', example: 'opentelemetry' },
};

export const SHAPE_OVERRIDES = {
  plug: { label: 'プラグ', description: '入力・出力や接続口を強調する形状。' },
  crate: { label: 'コンテナ箱', description: 'ファイルやパッケージなどのまとまりを示す形状。' },
};

const GLYPHS = {
  client: '<rect x="3" y="4" width="18" height="13" rx="1"/><path d="M8 21h8m-4-4v4M7 8l3 2.5L7 13m5 0h4"/>',
  service: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M7 8h10m-10 4h10m-10 4h6"/>',
  worker: '<path d="m14 3-9 10h6l-1 8 9-11h-6l1-7Z"/>',
  external: '<path d="M11 5H5v14h14v-6M13 5h6v6m0-6-8 8"/>',
  lb: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v5m-7 5v-5h14v5"/>',
  cdn: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18m-9-9a16 16 0 0 1 0 18 16 16 0 0 1 0-18z"/>',
  gateway: '<path d="M4 4h7v5m0 6v5H4m10-8h7m-3-3 3 3-3 3M4 12h10"/>',
  host: '<rect x="4" y="4" width="16" height="7" rx="1"/><rect x="4" y="13" width="16" height="7" rx="1"/><path d="M7 7.5h1m-1 9h1m4-9h5m-5 9h5"/>',
  scheduler: '<rect x="4" y="5" width="16" height="16" rx="1"/><path d="M8 3v4m8-4v4M4 10h16m-8 3v3l2 1"/>',
  cache: '<path d="M4 5h16v14H4zM7 3v2m5-2v2m5-2v2M7 19v2m5-2v2m5-2v2M8 9h8v6H8z"/>',
  plug: '<path d="M8 7h4a5 5 0 0 1 0 10H8zM3 9.5h5M3 14.5h5M17 12h4"/>',
  crate: '<path d="M3 4h18v4H3zM4 8v12h16V8M8 11v6m4-6v6m4-6v6"/>',
  cyl: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12a7 3 0 0 0 14 0V6M5 12a7 3 0 0 0 14 0"/>',
  queue: '<path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Zm-9 9 9 4.5 9-4.5M3 16.5l9 4.5 9-4.5"/>',
  person: '<circle cx="12" cy="7" r="3"/><path d="M5 20v-2a7 5 0 0 1 14 0v2Z"/>',
  slab: '<path d="M3 9h18v6H3zM8 9v6m5-6v6m4-6v6"/>',
  box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9"/>',
  catalog: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M9 4v16m3-11h5m-5 4h5"/>',
  file: '<path d="M6 3h8l4 4v14H6zm8 0v5h4m-9 4h6m-6 4h6"/>',
  table: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 14h18m-12-4v9m6-9v9"/>',
  policy: '<path d="m12 3 8 3v6c0 4-3 7-8 9-5-2-8-5-8-9V6zM8.5 12.5l2.5 2.5 4.5-5"/>',
  workflow: '<rect x="2.5" y="4" width="6" height="6" rx="1"/><rect x="15.5" y="14" width="6" height="6" rx="1"/><path d="M8.5 7h4v10h3m-1.5-1.5 1.5 1.5-1.5 1.5"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="1"/><path d="M8 21h8m-4-4v4M6 11h3l2-3 2 6 2-3h3"/>',
};

export function nodeShape(kind, serviceShape) {
  const type = Object.hasOwn(NODE_KINDS, kind) ? NODE_KINDS[kind] : null;
  return type?.preferShape ? type.shape : serviceShape || type?.shape || 'box';
}

export function nodeGlyph(shape, kind) {
  if (Object.hasOwn(NODE_KINDS, kind)) {
    return Object.hasOwn(GLYPHS, kind) ? GLYPHS[kind] : GLYPHS[NODE_KINDS[kind].shape];
  }
  return Object.hasOwn(GLYPHS, shape) ? GLYPHS[shape] : GLYPHS.box;
}
