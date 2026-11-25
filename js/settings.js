/* 設定：ブラウザ（localStorage）に保存。読み書きできない環境では既定値で動く */
const KEY = 'ddd.settings';
export const AI_PROVIDERS = { claude: 'Claude Code CLI', codex: 'Codex CLI' };
export const DEFAULTS = {
  theme: 'auto',        // auto | light | dark
  viewAccent: 'blue', // orange | blue
  labelScale: 1,        // ラベルの大きさ
  packetSpeed: 1,       // パケットの速さ
  renderMode: 'standard', // standard | light | minimal
  aiProvider: 'claude', // AI を実行する CLI
  officialIcons: true,  // 対応表がある場合に表示
  nodeStyle3D: 'components', // components | flow
  nodeStyle2D: 'card', // card | silhouette
  dimension: '3',      // 初期表示（3D / 2D）
  defaultView: 'iso',   // 初期の視点
  dragMode: 'rotate',   // 左ドラッグの既定
  disabledRules: [],    // 無効にした指摘ルール
  gates: {},            // 点検しきい値の上書き { maxDrift, maxHigh }
  sidebar: true,        // サイドバーを開く
};

export function loadSettings() {
  try {
    const settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    if (!['standard', 'light', 'minimal'].includes(settings.renderMode)) settings.renderMode = DEFAULTS.renderMode;
    return settings;
  } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 保存できない環境 */ } }

export function applyAppearance(s) {
  const r = document.documentElement;
  if (s.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = s.theme;
  r.dataset.viewAccent = s.viewAccent === 'orange' ? 'orange' : 'blue';
  r.style.setProperty('--lbl-scale', s.labelScale);
}

/* 一度だけ表示するもの（初回案内など） */
export function once(key) {
  try { if (localStorage.getItem(key)) return false; localStorage.setItem(key, '1'); return true; } catch { return false; }
}
