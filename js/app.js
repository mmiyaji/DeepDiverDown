/* DeepDiverDown viewer：アプリの枠組み（ヘッダー・サイドバー・パネル）、3D 図、各モード、設定・検索・共有・書き出し */
import { Scene3D } from './scene3d.js?v=card-icons';
import { loadSettings, saveSettings, applyAppearance, once, DEFAULTS, AI_PROVIDERS } from './settings.js?v=3d-styles';
import * as L from './loader.js';
import { openDesign } from './design.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FH = 4; // フロア 1 段の高さ（ワールド単位）

/* ================= 設定・ルーティング・データ読込 ================= */
const S = loadSettings();
applyAppearance(S);
if (!S.sidebar) document.body.classList.add('nav-closed');

function parseRoute() {
  const h = decodeURIComponent(location.hash.slice(1));
  const m = h.match(/^\/m\/([^/?]+)(?:\/([^/?]+))?(?:\?(.*))?$/);
  if (!m) return { id: h.split('?')[0], mode: null, q: {} }; // 旧形式 #ec-shop
  return { id: m[1], mode: m[2] || null, q: Object.fromEntries(new URLSearchParams(m[3] || '')) };
}
const ROUTE = parseRoute();
const [REGISTRY, ICONS] = await Promise.all([
  L.loadRegistry(),
  fetch('icons/manifest.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
]);
const iconDirectory = new URL('icons/', location.href);
const icons = Object.fromEntries(Object.entries(ICONS || {}).flatMap(([id, path]) => {
  if (typeof path !== 'string' || !URL.canParse(path, location.href)) return [];
  const url = new URL(path, location.href);
  return url.origin === iconDirectory.origin && url.pathname.startsWith(iconDirectory.pathname) ? [[id, url.href]] : [];
}));
Catalog.setIcons(icons);
const hasIcons = Object.keys(icons).length > 0;
const ENTRY = REGISTRY.find(r => r.id === ROUTE.id) || REGISTRY[0], KEY = ENTRY.id;
const { model: M, actual: A, docs: DOCS } = await L.loadEntry(ENTRY);
const OPTS = { disabled: S.disabledRules, gates: S.gates };

const PIPE = M.type === 'pipeline';
const METRICS = M.metrics || [['p95', 'p95 レイテンシ', 'ms'], ['cost', '月額コスト', '$'], ['rps', 'RPS', 'rps']];
const ISSUES = Analyze.lint(M, OPTS), DIFF = Analyze.diff(M, A);
const GATES = Analyze.gates(M, A, DOCS, OPTS), CLS = GATES.cls, COV = GATES.cov, IDX = Analyze.index(M);
let CMP = null, CMPR = null, comparisonLoad;
function ensureComparison() {
  return comparisonLoad ||= L.loadCompare(KEY, ENTRY).then(candidate => {
    CMP = candidate;
    CMPR = CMP ? Analyze.compareModels(CMP.model, M) : null;
    PROJKEY = '';
  }).catch(() => {});
}
const REQ_KIND = { usecase: 'ユースケース', rule: '業務ルール', state: '状態遷移', nfr: '非機能要件' };
const ROLES = {
  user: { label: '利用者', c: '#2E73B8' }, dev: { label: '開発者', c: '#3F8624' }, approver: { label: '承認者', c: '#C98A12' },
  ops: { label: '運用者', c: '#8C4FFF' }, admin: { label: '管理者', c: '#6d6a63' }, attacker: { label: '攻撃者', c: '#C8321F' },
};


const MODES = [
  ['struct', '構造'], ['scenario', 'シナリオ'], ['fail', '障害シミュレーション'], ['lint', '指摘', ISSUES.length],
  ['metric', 'メトリクス'], ['evidence', '根拠と確度', GATES.results.filter(r => !r.pass).length], M.requirements && ['req', '要件', M.requirements.length],
  ['compare', '比較'],
].filter(mode => mode && (!ENTRY.reference || ['struct', 'scenario'].includes(mode[0])));

const VIEWS = Views.available(M);
const st = {
  dimension: ['2', '3'].includes(ROUTE.q.d) ? ROUTE.q.d : S.dimension,
  view: VIEWS.includes(ROUTE.q.w) ? ROUTE.q.w : VIEWS.includes(M.views?.default) ? M.views.default : 'cloud',
  mode: MODES.some(m => m[0] === ROUTE.mode) ? ROUTE.mode : 'struct',
  sel: M.nodes[ROUTE.q.s] ? ROUTE.q.s : null, nbr: ROUTE.q.n === '1',
  hidden: new Set((ROUTE.q.h || '').split(',').filter(Boolean)),
  scen: +ROUTE.q.sc || 0, step: +ROUTE.q.st || 0, down: (ROUTE.q.down || (['2', '3'].includes(ROUTE.q.d) ? '' : ROUTE.q.d) || '').split(',').filter(id => M.nodes[id]),
  issue: ROUTE.q.i != null ? +ROUTE.q.i : null, req: ROUTE.q.r || null, metric: METRICS.some(x => x[0] === ROUTE.q.m) ? ROUTE.q.m : METRICS[0][0], play: null,
};
if (!M.scenarios?.[st.scen]) st.scen = 0;

/* 現在の状態 → URL（共有リンク）。withView で視点も含める */
function routeHash(withView) {
  const q = new URLSearchParams();
  if (st.view !== 'cloud') q.set('w', st.view);
  if (st.dimension === '2' || S.dimension === '2' || withView) q.set('d', st.dimension);
  if (st.sel) q.set('s', st.sel);
  if (st.nbr) q.set('n', '1');
  if (st.hidden.size) q.set('h', [...st.hidden].join(','));
  if (st.mode === 'scenario') { q.set('sc', st.scen); q.set('st', st.step); }
  if (st.mode === 'fail' && st.down.length) q.set('down', st.down.join(','));
  if (st.mode === 'lint' && st.issue != null) q.set('i', st.issue);
  if (st.mode === 'req' && st.req) q.set('r', st.req);
  if (st.mode === 'metric') q.set('m', st.metric);
  if (withView) { const v = scene.getView(); q.set('v', [...v.p, ...v.t, v.z].join('_')); }
  const s = q.toString();
  return `#/m/${KEY}/${st.mode}${s ? '?' + s : ''}`;
}
const syncUrl = () => history.replaceState(null, '', routeHash(false));
addEventListener('hashchange', () => { if (parseRoute().id !== KEY || parseRoute().q.v) location.reload(); });

/* ================= ビュー（論理 / サービス / ネットワーク） =================
 * 解析・モードの状態は物理モデル（allNodes / allLinks）で計算し、描画だけ VW() の部品に写す */
let PROJ = null, PROJKEY = '';
function VW() {
  const key = `${st.view}|${st.mode === 'evidence' ? 'e' : st.mode === 'compare' ? 'c' : ''}`;
  if (key !== PROJKEY) { PROJ = Views.project({ tiers: M.tiers, groups: M.groups || [], nodes: allNodes(), links: allLinks() }, M, st.view); PROJKEY = key; }
  return PROJ;
}
/* 物理部品 ID → いまのビューでそれを表す部品 ID */
const viewIdOf = id => { const P = VW(); return P.nodes[id] ? id : Object.keys(P.from).find(k => P.from[k].includes(id)); };

/* ================= 座標 ================= */
const TI = id => VW().tiers.find(t => t.id === id) || {};
const zOf = tier => { const S = VW().tiers.filter(t => t.z == null); return TI(tier).z ?? (S.length - 1 - S.findIndex(t => t.id === tier)); };
const off = tier => TI(tier).origin || [0, 0];
const sizeOf = tier => TI(tier).size || [10, 4];
const style3D = () => st.dimension === '3' ? (S.nodeStyle3D === 'flow' ? 'flow' : 'components') : null;
const W = (gx, gy, tier) => {
  const [ox, oz] = off(tier);
  const z = zOf(tier), flat = st.dimension === '2';
  const tiers = VW().tiers;
  const depth = flat ? Math.max(...tiers.map(t => off(t.id)[1] + sizeOf(t.id)[1])) - Math.min(...tiers.map(t => off(t.id)[1])) + 3 : 0;
  return [gx + ox, flat ? 0 : z * (style3D() === 'flow' ? FH * 1.45 : FH), gy + oz - z * depth];
};
const visible = n => n && !st.hidden.has(n.tier);

function allNodes() {
  let N = M.nodes;
  if (st.mode === 'evidence') N = { ...N, ...DIFF.extraNodes };
  if (st.mode === 'compare' && CMPR) N = { ...N, ...CMPR.removedNodes };
  return N;
}
function allLinks() {
  let ls = M.links;
  if (st.mode === 'evidence') ls = [...ls, ...DIFF.extraLinks];
  if (st.mode === 'compare' && CMPR) ls = [...ls, ...CMPR.removedLinks];
  const N = allNodes();
  return ls.filter(l => N[l.from] && N[l.to]);
}
const linkById = id => allLinks().find(l => l.id === id);
const linkLabel = l => `${allNodes()[l.from]?.label ?? l.from} → ${allNodes()[l.to]?.label ?? l.to}`;

function route(l) {
  const P = VW(), a = P.nodes[l.from], b = P.nodes[l.to];
  const [ax, ay, az] = W(a.x, a.y, a.tier), [bx, by, bz] = W(b.x, b.y, b.tier);
  const o = P.links.some(x => x.from === l.to && x.to === l.from) && l.from > l.to ? 0.25 : 0, Y = 0.04;
  let p;
  if (ay === by) p = ax === bx || az === bz ? [[ax, ay, az], [bx, by, bz]] : [[ax, ay, az], [(ax + bx) / 2, ay, az], [(ax + bx) / 2, by, bz], [bx, by, bz]];
  else p = [[ax, ay, az], [bx, ay, az], [bx, ay, bz], [bx, by, bz]];
  return p.map(([x, y, z]) => [x + o, y + Y, z + o]);
}

/* ================= モード → 見た目 ================= */
function decorate() {
  const N = allNodes(), ns = {}, ls = {};
  Object.keys(N).forEach(id => ns[id] = {});
  allLinks().forEach(l => ls[l.id] = {});
  const focus = (nodes = [], links = []) => {
    Object.keys(ns).forEach(id => nodes.includes(id) ? ns[id].outline = true : ns[id].dim = true);
    allLinks().forEach(l => links.includes(l.id) ? Object.assign(ls[l.id], { on: true, color: '--accent' }) : ls[l.id].dim = true);
  };
  Object.entries(N).forEach(([id, n]) => { if ((n.replicas ?? 1) > 1 && n.replicas < 99) ns[id].badge = { text: `×${n.replicas}` }; });

  if (st.mode === 'scenario' && M.scenarios?.length) {
    const sc = M.scenarios[st.scen], used = new Set(sc.steps.flatMap(s => s.links)), cur = sc.steps[st.step].links;
    allLinks().forEach(l => { if (!used.has(l.id)) ls[l.id].dim = true; });
    cur.forEach(id => ls[id] && Object.assign(ls[id], { on: true, color: '--ink', packets: true }));
    const touch = new Set([...used].flatMap(id => { const l = linkById(id); return l ? [l.from, l.to] : []; }));
    Object.keys(ns).forEach(id => { if (!touch.has(id)) ns[id].dim = true; });
    cur.forEach(id => { const l = linkById(id); if (l) ns[l.to].outline = true; });
  }
  if (st.mode === 'fail') {
    const r = Analyze.impact(M, st.down);
    st.down.forEach(id => Object.assign(ns[id], { fill: 'down', badge: { text: PIPE ? '失敗' : '停止', tone: 'acc' } }));
    r.impacted.forEach(id => Object.assign(ns[id], { fill: 'impact', badge: { text: PIPE ? '未実行' : '影響', tone: 'acc' } }));
    r.delayed.forEach(id => Object.assign(ns[id], { fill: 'delay', badge: { text: '滞留' } }));
    M.links.forEach(l => { if (l.sync && (st.down.includes(l.to) || r.impacted.includes(l.to))) Object.assign(ls[l.id], { on: true, color: '--accent', dashed: 'dash', packets: true }); });
  }
  if (st.mode === 'lint') {
    Object.keys(ns).forEach(id => { const c = ISSUES.filter(i => i.nodes[0] === id || (i.rule === 'SPOF' && i.nodes.includes(id))).length; if (c) ns[id].badge = { text: `! ${c}`, tone: 'acc' }; });
    if (st.issue != null && ISSUES[st.issue]) focus(ISSUES[st.issue].nodes, ISSUES[st.issue].links);
  }
  if (st.mode === 'metric') {
    const max = Math.max(...Object.values(N).map(n => n.metrics?.[st.metric] ?? 0), 1);
    Object.entries(N).forEach(([id, n]) => {
      const v = n.metrics?.[st.metric];
      if (v == null) return ns[id].dim = true;
      Object.assign(ns[id], { heat: v / max, h: 0.3 + (v / max) * 2.6, badge: { text: fmt(st.metric, v) } });
    });
  }
  if (st.mode === 'evidence') {
    Object.keys(N).forEach(id => {
      const s = CLS.nodes[id]?.status || 'drift';
      ns[id].status = s;
      if (s === 'unknown') ns[id].badge = { text: '？不明', tone: 'warn' };
      if (s === 'drift') ns[id].badge = { text: DIFF.extraNodes[id] ? '設計書にない' : 'ずれ', tone: 'acc' };
    });
    allLinks().forEach(l => {
      const s = CLS.links[l.id]?.status || 'drift';
      Object.assign(ls[l.id], s === 'drift' ? { on: true, color: '--accent' } : s === 'claim' ? { dashed: 'dash' } : s === 'unknown' ? { dashed: 'dot', color: '--warn', on: true } : { on: true, color: '--ink' });
    });
  }
  if (st.mode === 'req' && st.req) {
    const q = M.requirements.find(x => x.id === st.req), sc = q?.scenario && M.scenarios.find(s => s.id === q.scenario);
    if (q) {
      const links = [...(q.links || []), ...(sc ? sc.steps.flatMap(s => s.links) : [])];
      const nodes = [...(q.nodes || []), ...links.flatMap(id => { const l = linkById(id); return l ? [l.from, l.to] : []; })];
      focus(nodes, links);
      links.forEach(id => ls[id] && (ls[id].packets = true));
    }
  }
  if (st.mode === 'compare' && CMPR) {
    const T = { added: { badge: { text: '＋追加', tone: 'ok' }, outline: true }, removed: { ghost: true, badge: { text: '削除', tone: 'acc' } }, changed: { badge: { text: '変更', tone: 'warn' }, outline: true } };
    Object.entries(CMPR.nodes).forEach(([id, k]) => ns[id] && Object.assign(ns[id], T[k]));
    Object.entries(CMPR.links).forEach(([id, k]) => ls[id] && Object.assign(ls[id], k === 'added' ? { on: true, color: '--ok' } : k === 'removed' ? { dashed: 'dash', color: '--accent', on: true } : { on: true, color: '--warn' }));
  }
  /* 選択部品の周辺だけ */
  if (st.nbr && st.sel && ns[st.sel]) {
    const near = new Set([st.sel]);
    allLinks().forEach(l => { if (l.from === st.sel) near.add(l.to); if (l.to === st.sel) near.add(l.from); });
    Object.keys(ns).forEach(id => { if (!near.has(id)) ns[id].dim = true; });
    allLinks().forEach(l => { if (l.from !== st.sel && l.to !== st.sel) ls[l.id].dim = true; else if (!ls[l.id].on) Object.assign(ls[l.id], { on: true, color: '--ink' }); });
  }
  if (st.sel && ns[st.sel]) ns[st.sel].outline = true;
  return { ns, ls };
}
const fmt = (k, v) => { const u = (METRICS.find(x => x[0] === k) || [])[2] || ''; return u === '$' ? `$${v}` : `${v}${u}`; };

/* ================= 3D 描画 ================= */
const scene = new Scene3D($('view'), { onPick: id => onPick(id) });
scene.speed = S.packetSpeed;
scene.initialView = S.defaultView;

const serviceLabel = svc => svc && `${svc.name}｜${svc.providerLabel}`;

function nodeSpec(id, n, s) {
  const svc = Catalog.lookup(n.svc);
  const shape = n.kind === 'actor' ? 'person' : (svc?.shape ?? (['db', 'cache'].includes(n.kind) ? 'cyl' : n.kind === 'queue' ? 'queue' : 'box'));
  const flat = st.dimension === '2';
  const solidStyle = style3D();
  const flatStyle = flat ? (S.nodeStyle2D === 'silhouette' ? 'silhouette' : 'card') : null;
  const ext = n.kind === 'external' && !svc;
  let color = scene.color('--paper'), opacity = s.dim ? 0.15 : 1, dashed = ext;
  if (n.kind === 'actor') color = scene.mix((ROLES[n.role] || ROLES.user).c, '--paper', 0.5);
  else if (svc) color = scene.mix(svc.color, '--paper', 0.42);
  else if (['db', 'queue', 'cache'].includes(n.kind)) color = scene.color('--dark');
  if (flatStyle === 'silhouette' && !svc && n.kind !== 'actor') {
    const tint = n.shape3D === 'crate' ? '#348573'
      : { cyl: '#477786', queue: '#397972', box: '#526885' }[shape];
    color = scene.mix(tint, '--paper', 0.48);
  }
  if (solidStyle === 'components' && !svc && n.kind !== 'actor') {
    const tint = n.shape3D === 'crate' ? '#348573'
      : { cyl: '#32778f', queue: '#258477', box: n.kind === 'worker' ? '#3e718b' : '#627c96' }[shape];
    color = scene.mix(tint, '--paper', 0.82);
  } else if (solidStyle === 'flow') color = scene.color('--paper');
  if (ext) opacity = Math.min(opacity, 0.35);
  if (s.fill === 'down') color = scene.color('--accent');
  if (s.fill === 'impact') color = scene.mix('--accent', '--paper', 0.38);
  if (s.fill === 'delay') color = scene.mix('--warn', '--paper', 0.38);
  if (s.heat != null) color = scene.mix('--accent', '--paper', s.heat * 0.85);
  if (s.status === 'claim') { opacity = Math.min(opacity, 0.55); dashed = true; }
  if (s.status === 'unknown') { opacity = Math.min(opacity, 0.22); dashed = true; }
  if (s.status === 'drift') s.outline = true;
  if (s.ghost) { opacity = Math.min(opacity, 0.3); dashed = true; }
  return {
    id, shape, shape3D: n.shape3D, kind: n.kind, flat, flatStyle, solidStyle, color, cardTint: s.fill || s.heat != null ? color.getStyle() : null, opacity, dashed, outline: !!s.outline, h: s.h || (n.kind === 'client' ? 0.7 : 1), pos: W(n.x, n.y, n.tier),
    icon: S.officialIcons ? svc?.iconUrl : null,
    label: n.label, selected: VW().from[id].includes(st.sel), labelAccent: s.fill === 'down', badge: s.badge, abbr: svc && { text: svc.abbr, color: svc.color },
    sub: svc && { text: serviceLabel(svc), color: svc.providerColor },
  };
}

/* 物理部品の状態 → ビューの部品の状態 */
function projectState(ns, ls) {
  const P = VW(), nsV = {}, lsV = {};
  for (const [vid, parts] of Object.entries(P.from)) {
    const s = nsV[vid] = Views.mergeNode(parts.map(p => ns[p]));
    const n = P.nodes[vid];
    if (st.view === 'network' && s.badge?.text?.startsWith('×') && n.replicas < 99) s.badge = { text: `×${n.replicas}` }; // AZ ごとの台数
    if (parts.length > 1 && !s.badge) s.badge = { text: `${parts.length} 部品` };
    if (st.sel && (vid === st.sel || parts.includes(st.sel))) s.outline = true;
  }
  for (const l of P.links) {
    const s = lsV[l.id] = Views.mergeLink((P.linkFrom[l.id] || []).map(p => ls[p]));
    if (l.crossAz && !s.on && !s.dim) Object.assign(s, { on: true, color: '--warn' }); // AZ をまたぐ通信
  }
  return { nsV, lsV };
}

function draw() {
  const d = decorate(), { nsV: ns, lsV: ls } = projectState(d.ns, d.ls), P = VW(), N = P.nodes;
  scene.begin();
  for (const t of P.tiers) {
    if (st.hidden.has(t.id)) continue;
    const [w, h] = sizeOf(t.id), [ox, y, oz] = W(0, 0, t.id);
    const x0 = ox - 1.2, x1 = ox + w + 0.4, z0 = oz - 1.2, z1 = oz + h + 0.2;
    scene.floor({ style: style3D(), insetLabel: st.dimension === '2', x0, z0, x1, z1, y, origin: t.kind === 'origin', label: t.label, labelAt: t.origin ? [x0, y, z1] : [x1, y, z0] });
  }
  for (const gr of P.groups || []) for (const t of [].concat(gr.tier)) {
    if (st.hidden.has(t) || !P.tiers.some(x => x.id === t)) continue;
    const [ox, y, oz] = W(0, 0, t);
    let { x0, y0, x1, y1 } = gr;
    if (![x0, y0, x1, y1].every(Number.isFinite)) {
      const members = Object.entries(N).filter(([id, n]) => n.tier === t &&
        (!gr.nodes || P.from[id].some(source => gr.nodes.includes(source))) &&
        (gr.kind !== 'az' || !gr.az || n.az?.includes(gr.az))).map(([, n]) => n);
      if (!members.length) continue;
      const xs = members.map(n => n.x), ys = members.map(n => n.y);
      const padding = { cloud: 1.2, region: 1.0, cluster: 0.8, namespace: 0.6 }[gr.kind] ?? 0.8;
      x0 = Math.min(...xs) - padding; x1 = Math.max(...xs) + padding;
      y0 = Math.min(...ys) - padding; y1 = Math.max(...ys) + padding;
    }
    const provider = Catalog.PROVIDERS[gr.provider];
    const label = gr.kind === 'cloud' && provider && !gr.label?.includes(provider.label)
      ? [provider.label, gr.label].filter(Boolean).join('｜') : gr.label;
    scene.group({ y, kind: gr.kind, label, color: provider?.color,
      pts: [[x0 + ox, y0 + oz], [x1 + ox, y0 + oz], [x1 + ox, y1 + oz], [x0 + ox, y1 + oz]] });
  }
  for (const l of P.links) {
    if (!visible(N[l.from]) || !visible(N[l.to])) continue;
    const s = ls[l.id] || {};
    const crossFloor = N[l.from].tier !== N[l.to].tier;
    const solid = !!style3D();
    scene.link({ points: route(l), solid, arrow: solid && !crossFloor, color: s.color || (s.on ? '--ink' : solid ? '--diagram-link' : '--mute'), thick: !!s.on, packets: !!s.packets,
      dashed: s.dashed || (style3D() === 'flow' && crossFloor && !s.on ? 'dot' : !l.sync ? 'dash' : null),
      opacity: s.dim ? 0.12 : s.on ? 1 : solid ? (crossFloor ? 0.68 : 0.9) : 0.55 });
  }
  for (const [id, n] of Object.entries(N)) if (visible(n)) scene.node(nodeSpec(id, n, ns[id] || {}));
  scene.end(st.dimension === '2');
  renderSidebar(); renderStats(); renderPanel(); syncUrl();
}

/* ================= サイドバー ================= */
function modelLink(entry) {
  const selected = entry.id === KEY;
  const marker = entry.design ? '設計案' : entry.local ? 'ローカル' : '';
  const coverage = COV.total ? Math.round(COV.covered / COV.total * 100) : 100;
  const detail = selected && !entry.reference
    ? `<span class="tag ${GATES.pass ? 'ok' : 'high'}">${GATES.pass ? '合格' : '不合格'}</span> 網羅 ${coverage}%` : '';
  return `<a href="#/m/${encodeURIComponent(entry.id)}/struct" class="mitem ${selected ? 'on' : ''}" ${selected ? 'aria-current="page"' : ''}>
    <span class="mname">${esc((selected && M.name) || entry.name || entry.id)}${marker ? ` <small class="loc">${marker}</small>` : ''}</span>
    ${detail ? `<span class="mmeta">${detail}</span>` : ''}</a>`;
}

function renderLibrary() {
  $('mlist').innerHTML = REGISTRY.filter(entry => !entry.reference).map(modelLink).join('') +
    '<button class="b small" data-act="open">＋ YAML を開く</button>';

  const groups = new Map();
  for (const entry of REGISTRY.filter(r => r.reference)) {
    const category = entry.reference.category || 'その他';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(entry);
  }
  $('reference-section').hidden = !groups.size;
  $('reference-list').innerHTML = [...groups].map(([category, entries], index) =>
    `<details class="reference-category"${entries.some(entry => entry.id === KEY) || (!ENTRY.reference && index === 0) ? ' open' : ''}>
      <summary>${esc(category)}</summary><div class="mlist">${entries
        .sort((a, b) => (a.reference.order ?? Number.MAX_SAFE_INTEGER) - (b.reference.order ?? Number.MAX_SAFE_INTEGER))
        .map(modelLink).join('')}</div></details>`).join('');
}

function renderSidebar() {
  $('modes').innerHTML = MODES.map(([k, n, count], i) => {
    const c = k === 'compare' ? CMPR?.changes.length : count;
    return `<button data-mode="${k}" class="${st.mode === k ? 'on' : ''}" ${st.mode === k ? 'aria-current="true"' : ''} title="${n}（${i + 1}）"><span>${n}</span>${c ? `<small>${c}</small>` : ''}</button>`;
  }).join('');
  $('views').innerHTML = VIEWS.map(v => `<button data-viewmode="${v}" class="${st.view === v ? 'on' : ''}" aria-pressed="${st.view === v}" title="${Views.VIEWS[v].label}（${Views.VIEWS[v].sub}）・V キーで切替"><b>${Views.VIEWS[v].label}</b><small>${Views.VIEWS[v].sub}</small></button>`).join('');
  $('floors').innerHTML = VW().tiers.map(t => `<label><input type="checkbox" data-tier="${t.id}" ${st.hidden.has(t.id) ? '' : 'checked'}> ${esc(t.label)}</label>`).join('');
  $('nbr').checked = st.nbr;
  $('nbr').disabled = !st.sel;
}

/* ================= 統計・凡例 ================= */
const stat = (lab, v, bad) => `<div class="stat ${bad ? 'bad' : ''}"><small>${lab}</small><b>${v}</b></div>`;
const count = (o, s) => Object.values(o).filter(r => r.status === s).length;
function renderStats() {
  let h = '';
  if (st.mode === 'struct') h = stat('ノード', Object.keys(M.nodes).length) + stat('同期 / 非同期', `${M.links.filter(l => l.sync).length} / ${M.links.filter(l => !l.sync).length}`) + stat('指摘', ISSUES.length, ISSUES.length) + stat('点検', GATES.pass ? '合格' : '不合格', !GATES.pass);
  if (st.mode === 'struct' && ENTRY.reference) h = stat('構成部品', Object.keys(M.nodes).length) + stat('接続', M.links.length);
  if (st.mode === 'scenario' && M.scenarios?.length) { const sc = M.scenarios[st.scen], p = syncP95(sc); h = stat('シナリオ', esc(sc.label)) + stat('ステップ', `${st.step + 1} / ${sc.steps.length}`) + (PIPE || ENTRY.reference ? '' : stat('同期経路 p95 合計', `${p} ms`, p > 1000)); }
  if (st.mode === 'fail') { const r = Analyze.impact(M, st.down); h = stat('停止', st.down.length, st.down.length) + stat('影響', r.impacted.length, r.impacted.length) + stat('滞留', r.delayed.length) + stat('止まるシナリオ', `${r.brokenScenarios.length} / ${M.scenarios?.length || 0}`, r.brokenScenarios.length); }
  if (st.mode === 'lint') h = stat('重大', ISSUES.filter(i => i.sev === 'high').length, 1) + stat('注意', ISSUES.filter(i => i.sev === 'mid').length) + stat('無効にしたルール', S.disabledRules.length);
  if (st.mode === 'metric') { const vs = Object.values(M.nodes).map(n => n.metrics?.[st.metric]).filter(v => v != null), sum = ['cost', 'duration'].includes(st.metric); h = stat('指標', METRICS.find(x => x[0] === st.metric)[1]) + (vs.length ? stat(sum ? '合計' : '最大', fmt(st.metric, sum ? vs.reduce((a, b) => a + b, 0) : Math.max(...vs))) : ''); }
  if (st.mode === 'evidence') { const all = { ...CLS.nodes, ...CLS.links }; h = stat('事実', count(all, 'fact')) + stat('主張', count(all, 'claim')) + stat('不明', count(all, 'unknown'), count(all, 'unknown')) + stat('ずれ', CLS.drifts.length, CLS.drifts.length) + stat('網羅率', `${COV.total ? Math.round(COV.covered / COV.total * 100) : 100}%`, COV.covered < COV.total); }
  if (st.mode === 'req') h = Object.entries(REQ_KIND).map(([k, n]) => stat(n, M.requirements.filter(q => q.kind === k).length)).join('');
  if (st.mode === 'compare') h = CMPR ? stat('比較対象', esc(CMP.label)) + ['added', 'removed', 'changed'].map(k => stat({ added: '追加', removed: '削除', changed: '変更' }[k], CMPR.changes.filter(c => c.kind === k).length)).join('') : stat('比較対象', 'なし');
  $('stats').innerHTML = h;
  const leg = {
    evidence: '<span><i></i>事実（実装で確認）</span><span><i class="dash"></i>主張（設計書のみ）</span><span><i class="dot warn"></i>不明</span><span><i class="acc"></i>ずれ</span>',
    compare: '<span><i class="ok"></i>追加</span><span><i class="dash acc"></i>削除</span><span><i class="warn"></i>変更</span>',
    fail: '<span><i></i>同期</span><span><i class="dash"></i>非同期</span><span><i class="acc"></i>失敗する呼び出し</span>',
  };
  $('legend').innerHTML = ENTRY.reference ? '<span>線は処理・データの流れを示します</span>' : leg[st.mode] || '<span><i></i>同期</span><span><i class="dash"></i>非同期</span>';
}
function syncP95(sc) {
  const ids = new Set(sc.steps.flatMap(s => s.links).map(linkById).filter(l => l?.sync).map(l => l.to));
  return [...ids].reduce((s, id) => s + (M.nodes[id].metrics?.p95 || 0), 0);
}

/* ================= パネル ================= */
const tag = s => `<span class="tag st-${s}">${Analyze.STATUS[s]}</span>`;
const evList = ev => (ev || []).map(e => `<div class="ev"><span class="mono">${esc(e.type)}</span> ${esc(e.at || e.ref)}${e.quote ? `<blockquote>${esc(e.quote)}</blockquote>` : ''}${e.says ? ` <span class="mono acc-t">says ${esc(JSON.stringify(e.says))}</span>` : ''}</div>`).join('') || '<div class="sub">根拠なし</div>';
const none = '<div class="sub">なし</div>';

/* 論理構成でまとめた機能（複数の物理部品） */
function componentDetail(id) {
  const P = VW(), c = P.nodes[id]; if (!c) return '';
  const parts = P.from[id] || [], ins = P.links.filter(l => l.to === id), outs = P.links.filter(l => l.from === id);
  const iss = ISSUES.filter(i => i.nodes.some(n => parts.includes(n)));
  const ln = l => `${esc(P.nodes[l.from]?.label)} → ${esc(P.nodes[l.to]?.label)} <span class="mono mute">${(P.linkFrom[l.id] || []).length} 経路</span>`;
  return `<h4>選択中の機能</h4><h3>${esc(c.label)} <span class="mono mute">${esc(id)}</span></h3><div class="sub">論理構成の機能 / ${esc(TI(c.tier).label || '')}</div>
    ${c.description ? `<p>${esc(c.description)}</p>` : ''}
    <div class="row"><button class="b small" data-focus="${id}">この機能に寄る（F）</button><button class="b small" data-viewmode="cloud">物理構成で見る</button><button class="b small" data-sel="">選択を解除</button></div>
    <h4>担う物理部品（${parts.length}）</h4>${parts.map(p => `<div class="item">${esc(M.nodes[p]?.label || p)} <span class="mono mute">${esc(p)}</span> ${CLS.nodes[p] ? tag(CLS.nodes[p].status) : ''}</div>`).join('')}
    <h4>呼び出し元</h4>${ins.map(l => `<div class="item" data-sel="${l.from}">${ln(l)}</div>`).join('') || none}
    <h4>呼び出し先</h4>${outs.map(l => `<div class="item" data-sel="${l.to}">${ln(l)}</div>`).join('') || none}
    ${iss.length ? '<h4>関連する指摘</h4>' + iss.map(i => `<div class="item"><span class="tag ${i.sev}">${esc(i.title)}</span><p>${esc(i.msg)}</p></div>`).join('') : ''}`;
}

function nodeDetail(id) {
  if (!allNodes()[id]) return componentDetail(id);
  const n = allNodes()[id];
  const ins = allLinks().filter(l => l.to === id), outs = allLinks().filter(l => l.from === id);
  const iss = ISSUES.filter(i => i.nodes.includes(id)), c = CLS.nodes[id];
  const kind = n.kind === 'actor' ? `登場人物：${(ROLES[n.role] || ROLES.user).label}${n.team ? `（${esc(n.team)}・${n.headcount ?? 1}名）` : ''}` : esc(serviceLabel(Catalog.lookup(n.svc)) || n.kind);
  const ln = l => `${esc(linkLabel(l))} <span class="mono mute">${l.sync ? 'sync' : 'async'}${l.timeoutMs ? ' ' + l.timeoutMs / 1000 + 's' : ''}${l.retry ? ' retry' + l.retry : ''}</span> ${CLS.links[l.id] ? tag(CLS.links[l.id].status) : ''}`;
  const reqs = (M.requirements || []).filter(q => q.nodes?.includes(id));
  return `<h4>選択中の部品</h4><h3>${esc(n.label)} <span class="mono mute">${esc(id)}</span></h3><div class="sub">${kind}${n.az ? ` / AZ ${n.az.join(',')}` : ''}${n.subnet ? ` / ${esc(n.subnet)} subnet` : ''} / ${esc(TI(n.tier).label || '')}</div>
    ${n.description ? `<p>${esc(n.description)}</p>` : ''}
    <div class="row"><button class="b small" data-focus="${id}">この部品に寄る（F）</button><button class="b small ${st.nbr ? 'on' : ''}" data-nbr>周辺だけ表示（N）</button><button class="b small" data-sel="">選択を解除</button></div>
    ${c ? `<div class="row">${tag(c.status)}<span class="sub m0">${esc(c.why)}</span></div>` : ''}
    <table class="kv"><tr><td>台数</td><td>${n.replicas ?? '—'}</td></tr>${Object.entries(n.metrics || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${fmt(k, v)}</td></tr>`).join('')}</table>
    <h4>根拠</h4>${evList(n.evidence)}
    <h4>呼び出し元</h4>${ins.map(l => `<div class="item" data-sel="${l.from}">${ln(l)}</div>`).join('') || none}
    <h4>呼び出し先</h4>${outs.map(l => `<div class="item" data-sel="${l.to}">${ln(l)}</div>`).join('') || none}
    ${reqs.length ? '<h4>関係する要件</h4>' + reqs.map(q => `<div class="item" data-req="${q.id}"><b class="mono">${q.id}</b> ${esc(q.title)}</div>`).join('') : ''}
    ${iss.length ? '<h4>関連する指摘</h4>' + iss.map(i => `<div class="item"><span class="tag ${i.sev}">${esc(i.title)}</span><p>${esc(i.msg)}</p></div>`).join('') : ''}`;
}

function evidencePanel() {
  const group = s => [...Object.entries(CLS.nodes).filter(([, r]) => r.status === s).map(([id, r]) => ({ label: M.nodes[id].label, why: r.why, sel: id })),
    ...Object.entries(CLS.links).filter(([, r]) => r.status === s).map(([id, r]) => { const l = M.links.find(x => x.id === id); return { label: linkLabel(l), why: r.why, sel: l.from }; })];
  const list = s => group(s).map(x => `<div class="item" data-sel="${x.sel}">${tag(s)}<b>${esc(x.label)}</b> <span class="sub">${esc(x.why)}</span></div>`).join('') || none;
  return `<h3>根拠と確度</h3><div class="sub">すべての要素に根拠を付け、実装（IaC・コード・実環境）で裏が取れたものだけを「事実」とする。合否は点検（gates）で判定。</div>
    <h4>点検 ${GATES.pass ? '<span class="tag ok">合格</span>' : '<span class="tag high">不合格</span>'}</h4>
    ${GATES.results.map(r => `<details class="gate"><summary><span class="tag ${r.pass ? 'ok' : 'high'}">${r.pass ? 'OK' : 'NG'}</span>${esc(r.label)} <span class="sub">${esc(r.detail)}</span></summary>${r.items.map(x => `<p>${esc(x)}</p>`).join('') || '<p class="sub">該当なし</p>'}</details>`).join('')}
    <h4>網羅率 ${COV.covered} / ${COV.total}</h4><div class="bar" style="width:${COV.total ? COV.covered / COV.total * 100 : 100}%"></div>
    ${COV.missing.map(x => `<div class="item"><span class="tag mid">未対応</span>${esc(x.label)} <span class="sub">${esc(x.kind)}</span></div>`).join('')}
    <h4>ずれ</h4>${CLS.drifts.map(d => `<div class="item">${tag('drift')}<p>${esc(d.msg)}</p></div>`).join('') || none}
    <h4>不明（登録済み）</h4>${(M.unknowns || []).map(u => `<div class="item"><b class="mono">${esc(u.id)}</b> ${esc(u.text)} <span class="sub">${esc((u.refs || []).join(', '))}</span></div>`).join('') || none}
    <h4>主張（設計書の記述のみ）</h4>${list('claim')}
    <details class="gate"><summary>逆引き索引（参照先 → 要素）</summary>${Object.entries(IDX.byRef).map(([k, ids]) => `<p><span class="mono">${esc(k)}</span><br>→ ${esc(ids.join(', '))}</p>`).join('')}</details>`;
}

function reqPanel() {
  const q = st.req && M.requirements.find(x => x.id === st.req);
  if (q) {
    const c = CLS.reqs[q.id];
    return `<button class="b small" data-req="">← 一覧</button><h4>${REQ_KIND[q.kind] || q.kind}</h4><h3><span class="mono">${esc(q.id)}</span> ${esc(q.title)}</h3>
      <div class="row">${tag(c.status)}<span class="sub m0">${esc(c.why)}</span></div><div class="note">${esc(q.text)}</div>
      ${q.states ? `<h4>状態</h4><div class="states">${q.states.map(s => `<span>${esc(s)}</span>`).join('<i>→</i>')}</div>` : ''}
      <h4>根拠</h4>${evList(q.evidence)}
      <h4>紐付く構成要素</h4>${[...(q.nodes || []).map(id => ({ t: M.nodes[id]?.label, s: id })), ...(q.links || []).map(id => { const l = linkById(id); return l && { t: linkLabel(l), s: l.from }; }), q.scenario && { t: `シナリオ：${M.scenarios.find(s => s.id === q.scenario)?.label}` }].filter(Boolean).map(x => `<div class="item" ${x.s ? `data-sel="${x.s}"` : ''}>${esc(x.t)}</div>`).join('') || none}
      ${(M.unknowns || []).filter(u => u.refs?.includes(q.id)).map(u => `<div class="item"><span class="tag mid">不明</span>${esc(u.text)}</div>`).join('')}`;
  }
  return `<h3>要件（技術に依存しない層）</h3><div class="sub">業務ルール・ユースケース・状態遷移・非機能要件。作り直しや移行のときは、構成ではなくこちらを入力にする。クリックで関係する構成を強調。</div>` +
    Object.entries(REQ_KIND).map(([k, n]) => { const qs = M.requirements.filter(x => x.kind === k); return qs.length ? `<h4>${n}</h4>` + qs.map(x => `<div class="item" data-req="${x.id}"><b class="mono">${esc(x.id)}</b> ${esc(x.title)} ${tag(CLS.reqs[x.id].status)}</div>`).join('') : ''; }).join('');
}

function comparePanel() {
  if (!CMPR) return `<h3>比較</h3><div class="sub">2 つのバージョンのモデルを比べ、追加・削除・変更を色分けします。</div>
    <p>比較対象（以前のバージョンなど）の YAML を読み込んでください。git の履歴と比べる場合は CLI も使えます。</p>
    <div class="row"><button class="b" data-act="open-compare">比較対象の YAML を読み込む</button></div>
    <pre class="code">git show HEAD~1:models/${esc(KEY)}/model.yaml &gt; old.yaml
npm run compare -- old.yaml models/${esc(KEY)}/model.yaml</pre>`;
  const sel = c => c.type === 'node' ? c.id : (allLinks().find(l => l.id === c.id)?.from || '');
  return `<h3>比較：${esc(CMP.label)} → 現在</h3><div class="sub">比較対象から現在のモデルへの変化。削除された部品は半透明で表示。</div>
    <div class="row"><button class="b small" data-act="open-compare">比較対象を変更</button>${CMP.own ? '<button class="b small" data-act="clear-compare">読み込んだ比較対象を解除</button>' : ''}</div>
    ${['added', 'removed', 'changed'].map(k => { const cs = CMPR.changes.filter(c => c.kind === k); return `<h4>${{ added: '追加', removed: '削除', changed: '変更' }[k]}（${cs.length}）</h4>` + (cs.map(c => `<div class="item" data-sel="${sel(c)}"><span class="tag cmp-${k}">${c.type === 'node' ? '部品' : '接続'}</span>${esc(c.msg)}</div>`).join('') || none); }).join('')}`;
}

function referenceDetails() {
  if (!ENTRY.reference) return '';
  const { objectives = [], sources = [] } = M.reference || {};
  const links = sources.filter(source => /^https?:\/\//i.test(source.url));
  return `${objectives.length ? `<h4>学べること</h4><ul>${objectives.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
    ${links.length ? `<h4>公式資料</h4><ul>${links.map(source =>
      `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a></li>`).join('')}</ul>` : ''}`;
}

function renderPanel() {
  let h = '';
  if (st.mode === 'struct') h = st.sel ? nodeDetail(st.sel) : `<h3>${esc(M.name)}</h3><div class="sub">${(M.sources || []).map(s => `<a href="${esc(s)}" target="_blank">${esc(s)}</a>`).join(' ') || (ENTRY.local ? 'ブラウザに読み込んだモデル' : '')}</div>
      ${M.description ? `<p>${esc(M.description)}</p>` : ''}${ENTRY.reference && M.scenarios?.length ? '<button type="button" class="b on" data-mode="scenario">処理の流れを見る</button>' : ''}${referenceDetails()}<p>左のサイドバーで表示モードやフロアを切り替え、部品をクリックすると詳細を表示します。上の検索（<kbd>/</kbd>）で部品・ID・根拠の参照先を探せます。</p>
      ${M.review?.length ? '<h4>抽出時のレビューメモ</h4>' + M.review.map(r => `<div class="item"><p>${esc(r)}</p></div>`).join('') : ''}`;
  if (st.mode === 'scenario') {
    if (!M.scenarios?.length) h = '<h3>シナリオ</h3><div class="sub">このモデルにはシナリオがありません。</div>';
    else {
      const sc = M.scenarios[st.scen], s = sc.steps[st.step];
      h = `<div class="row">${M.scenarios.map((x, i) => `<button class="b ${i === st.scen ? 'on' : ''}" data-scen="${i}">${esc(x.label)}</button>`).join('')}</div>
        <div class="num">${String(st.step + 1).padStart(2, '0')}</div><div class="sub">${esc(sc.label)}</div><div class="note">${esc(s.note)}</div>
        <div class="row mt"><button class="b" data-step="-1" ${st.step ? '' : 'disabled'}>← 前へ</button><button class="b" data-play>${st.play ? '❚❚ 停止' : '▶ 再生'}</button><button class="b" data-step="1" ${st.step < sc.steps.length - 1 ? '' : 'disabled'}>次へ →</button></div>
        <h4>ステップ</h4>${sc.steps.map((x, i) => `<div class="item ${i === st.step ? 'on' : ''}" data-goto="${i}"><b>${i + 1}.</b> ${esc(x.note)}</div>`).join('')}`;
    }
  }
  if (st.mode === 'fail') {
    const r = Analyze.impact(M, st.down);
    h = `<h3>障害シミュレーション</h3><div class="sub">${PIPE ? 'ステージをクリックして失敗させる。後続のステージは実行されなくなります。' : '部品をクリックして停止 / 復旧。同期で依存している部品に影響が伝播します。人物を止めると「不在」を表します。'}</div>
      <div class="row"><button class="b" data-reset>すべて復旧</button>${(M.failPresets || []).filter(id => M.nodes[id]).map(id => `<button class="b" data-down="${id}">${esc(M.nodes[id].label)} 停止</button>`).join('')}</div>
      <h4>停止中</h4>${st.down.map(id => `<div class="item"><b>${esc(M.nodes[id].label)}</b></div>`).join('') || none}
      <h4>${PIPE ? '実行されないステージ' : '影響を受ける（同期依存）'}</h4>${r.impacted.map(id => `<div class="item" data-sel="${id}">${esc(M.nodes[id].label)}</div>`).join('') || none}
      <h4>処理が滞留する（非同期）</h4>${r.delayed.map(id => `<div class="item" data-sel="${id}">${esc(M.nodes[id].label)}</div>`).join('') || none}
      <h4>止まるユースケース</h4>${r.brokenScenarios.map(s => `<div class="item"><span class="tag high">停止</span>${esc(s.label)}</div>`).join('') || none}`;
  }
  if (st.mode === 'lint') h = `<h3>指摘 ${ISSUES.length} 件</h3><div class="sub">モデルにルールを当てた結果。クリックで該当箇所を強調。ルールは設定で個別に無効化できます。</div>` +
    ISSUES.map((i, k) => `<div class="item ${st.issue === k ? 'on' : ''}" data-issue="${k}"><span class="tag ${i.sev}">${esc(i.title)}</span><p>${esc(i.msg)}</p>${st.issue === k ? '<button class="b small" data-act="assist-finding">AI に対応を相談</button>' : ''}</div>`).join('');
  if (st.mode === 'metric') {
    const rows = Object.entries(M.nodes).filter(([, n]) => n.metrics?.[st.metric] != null).sort((a, b) => b[1].metrics[st.metric] - a[1].metrics[st.metric]), max = rows[0]?.[1].metrics[st.metric] || 1;
    h = `<div class="row">${METRICS.map(([k, n]) => `<button class="b ${st.metric === k ? 'on' : ''}" data-metric="${k}">${n}</button>`).join('')}</div><div class="sub">値を立体の高さと色の濃さで表示。</div>` +
      (rows.map(([id, n]) => `<div class="item" data-sel="${id}"><b>${esc(n.label)}</b> <span class="mono">${fmt(st.metric, n.metrics[st.metric])}</span><div class="bar" style="width:${n.metrics[st.metric] / max * 100}%"></div></div>`).join('') || none);
  }
  if (st.mode === 'evidence') h = evidencePanel();
  if (st.mode === 'req') h = reqPanel();
  if (st.mode === 'compare') h = comparePanel();
  if (st.sel && !['struct', 'fail'].includes(st.mode)) h += '<div class="mt"></div>' + nodeDetail(st.sel);
  $('panel-body').innerHTML = h;
}

/* ================= 操作 ================= */
/* id は物理部品でもビューの部品でもよい。物理 1 つに対応するビュー部品は物理 ID で持つ */
function resolveSel(id) {
  if (!id) return null;
  if (allNodes()[id]) return id;
  const parts = VW().from[id];
  return parts ? (parts.length === 1 ? parts[0] : id) : null;
}
function select(id, { focus = false } = {}) {
  st.sel = resolveSel(id);
  if (!st.sel) st.nbr = false;
  if (focus && st.sel) {
    const vid = viewIdOf(st.sel), n = vid && VW().nodes[vid];
    if (n) { st.hidden.delete(n.tier); const p = W(n.x, n.y, n.tier); scene.focusOn([p[0], p[1] + 0.5, p[2]]); }
  }
  draw();
}
function onPick(id) {
  if (!id) { if (st.sel) select(null); return; }
  if (st.mode === 'fail') {
    const parts = (VW().from[id] || [id]).filter(p => M.nodes[p]);
    const allDown = parts.every(p => st.down.includes(p));
    st.down = allDown ? st.down.filter(x => !parts.includes(x)) : [...new Set([...st.down, ...parts])];
    return draw();
  }
  select(st.sel === resolveSel(id) ? null : id);
}
function setView(v) {
  if (!VIEWS.includes(v) || v === st.view) return;
  st.view = v; scene.fitted = false; // 配置が変わるので全体が収まるよう視点を合わせ直す
  draw();
  toast(`${Views.VIEWS[v].label}（${Views.VIEWS[v].sub}）`);
}
async function setMode(m) {
  st.mode = m; st.issue = null; st.req = null; stopPlay();
  if (m === 'compare') await ensureComparison();
  if (st.mode === m) draw();
}
const stopPlay = () => { clearInterval(st.play); st.play = null; };

let drag3D = S.dragMode;
const toggleDimension = () => setDimension(st.dimension === '2' ? '3' : '2');
function setDimension(dimension, redraw = true) {
  st.dimension = dimension;
  const flat = dimension === '2';
  document.querySelector('[data-act="svg-full"]').hidden = !flat;
  scene.controls.enableRotate = !flat;
  scene.fitted = false;
  setDrag(drag3D);
  const button = document.querySelector('[data-act="dimension"]');
  button.textContent = flat ? '2D / 3D' : '3D / 2D';
  button.setAttribute('aria-pressed', flat);
  document.querySelector('button[data-drag="rotate"]').disabled = flat;
  document.querySelectorAll('[data-view]:not([data-view="reset"]):not([data-view="top"])').forEach(b => { b.disabled = flat; });
  if (redraw) draw();
}
function setDrag(mode) {
  if (st.dimension === '2') mode = 'pan';
  else drag3D = mode;
  scene.setDragMode(mode);
  document.querySelectorAll('button[data-drag]').forEach(b => { b.classList.toggle('on', b.dataset.drag === mode); b.setAttribute('aria-pressed', b.dataset.drag === mode); });
  $('hint').textContent = st.dimension === '2' ? 'ドラッグ：移動 ／ ホイール：拡大縮小' : mode === 'rotate' ? 'ドラッグ：回転 ／ 右ドラッグ：移動 ／ ホイール：拡大縮小' : 'ドラッグ：移動 ／ 右ドラッグ：回転 ／ ホイール：拡大縮小';
}

/* トースト通知 */
let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

/* ================= 検索 ================= */
const SEARCH = [
  ...Object.entries(M.nodes).map(([id, n]) => ({ t: 'node', id, label: n.label, sub: `${id} ・ ${serviceLabel(Catalog.lookup(n.svc)) || n.kind}`, key: `${n.label} ${id} ${n.svc || ''} ${n.kind || ''} ${n.team || ''} ${serviceLabel(Catalog.lookup(n.svc)) || ''}` })),
  ...M.links.map(l => ({ t: 'link', id: l.id, label: linkLabel(l), sub: l.id, key: `${linkLabel(l)} ${l.id} ${l.label || ''}`, sel: l.from })),
  ...(M.requirements || []).map(q => ({ t: 'req', id: q.id, label: q.title, sub: q.id, key: `${q.id} ${q.title} ${q.text}` })),
  ...(M.scenarios || []).map((s, i) => ({ t: 'scenario', id: i, label: s.label, sub: 'シナリオ', key: s.label })),
  ...Object.entries(IDX.byRef).map(([ref, ids]) => ({ t: 'ref', id: ref, label: ref, sub: `→ ${ids.slice(0, 4).join(', ')}${ids.length > 4 ? '…' : ''}`, key: ref, sel: ids.find(x => M.nodes[x]) || ids.map(x => M.links.find(l => l.id === x)?.from).find(Boolean) })),
];
const T_LABEL = { node: '部品', link: '接続', req: '要件', scenario: 'シナリオ', ref: '根拠' };
let qHits = [], qIdx = 0;
function search(q) {
  const s = q.trim().toLowerCase();
  qHits = s ? SEARCH.filter(x => x.key.toLowerCase().includes(s)).slice(0, 14) : [];
  qIdx = 0; renderHits();
}
function renderHits() {
  const box = $('qres');
  box.hidden = !qHits.length && !$('q').value.trim();
  box.innerHTML = qHits.length ? qHits.map((x, i) => `<div class="hit ${i === qIdx ? 'on' : ''}" role="option" aria-selected="${i === qIdx}" data-hit="${i}"><span class="tag">${T_LABEL[x.t]}</span><b>${esc(x.label)}</b><small>${esc(x.sub)}</small></div>`).join('') : '<div class="sub pad">見つかりません</div>';
}
function openHit(x) {
  $('q').value = ''; qHits = []; renderHits(); $('qres').hidden = true; $('q').blur();
  if (x.t === 'req') { st.mode = 'req'; st.req = x.id; return draw(); }
  if (x.t === 'scenario') { st.mode = 'scenario'; st.scen = x.id; st.step = 0; return draw(); }
  select(x.t === 'node' ? x.id : x.sel, { focus: true });
}

/* ================= 書き出し・共有 ================= */
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
const exportBackground = () => getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#fff';
async function exportSvg(full = false) {
  try {
    const svg = await scene.snapshotSvg(exportBackground(), M.name, { full });
    download(`${KEY}-${st.mode}${full ? '-full' : ''}.svg`, new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    toast('SVG を書き出しました');
  } catch (error) {
    console.error(error);
    toast('SVG を書き出せませんでした');
  }
}
function exportPng() {
  const c = scene.snapshot(exportBackground());
  c.toBlob(b => { download(`${KEY}-${st.mode}.png`, b); toast('画像を書き出しました'); });
}
async function exportReport() {
  if (!ENTRY.reference) await ensureComparison();
  const ok = b => b ? '合格' : '不合格', line = s => String(s).replace(/\|/g, '\\|');
  const md = [
    `# ${M.name} レビューレポート`, '', `- モデル：\`${KEY}\`${M.sources?.length ? `（${M.sources.join(', ')}）` : ''}`, `- 生成：${new Date().toLocaleString('ja-JP')}`,
    `- 点検：**${ok(GATES.pass)}** ／ 網羅率 ${COV.covered} / ${COV.total} ／ 指摘 ${ISSUES.length} 件 ／ ずれ ${CLS.drifts.length} 件`, '',
    '## 点検', '', '| 結果 | 項目 | 詳細 |', '|---|---|---|', ...GATES.results.map(r => `| ${r.pass ? 'OK' : 'NG'} | ${line(r.label)} | ${line(r.detail)} |`), '',
    ...GATES.results.filter(r => !r.pass && r.items.length).flatMap(r => [`### ${r.label}`, ...r.items.map(x => `- ${x}`), '']),
    '## 指摘', '', ...(ISSUES.length ? ISSUES.map(i => `- **${i.sev === 'high' ? '重大' : '注意'}｜${i.title}**：${i.msg}`) : ['なし']), '',
    '## 不明（登録済み）', '', ...((M.unknowns || []).length ? M.unknowns.map(u => `- \`${u.id}\` ${u.text}（${(u.refs || []).join(', ')}）`) : ['なし']), '',
    ...(M.requirements?.length ? ['## 要件', '', '| ID | 種類 | 内容 | 確度 |', '|---|---|---|---|', ...M.requirements.map(q => `| ${q.id} | ${REQ_KIND[q.kind] || q.kind} | ${line(q.title)} | ${Analyze.STATUS[CLS.reqs[q.id].status]} |`), ''] : []),
    ...(CMPR ? [`## 比較（${CMP.label} → 現在）`, '', ...CMPR.changes.map(c => `- ${{ added: '＋', removed: '－', changed: '～' }[c.kind]} ${c.msg}`), ''] : []),
    '---', `共有リンク：${location.origin}${location.pathname}${routeHash(true)}`, '',
  ].join('\n');
  download(`${KEY}-report.md`, new Blob([md], { type: 'text/markdown' }));
  toast('レポートを書き出しました');
}
async function share() {
  const url = `${location.origin}${location.pathname}${routeHash(true)}`;
  try { await navigator.clipboard.writeText(url); toast('今の画面（視点を含む）のリンクをコピーしました'); }
  catch { prompt('このリンクをコピーしてください', url); }
}

/* ================= ファイル読み込み（モデル / 比較対象） ================= */
let fileTarget = 'model';
function pickFile(target) { fileTarget = target; $('file').value = ''; $('file').click(); }
async function readFile(file, target = fileTarget) {
  if (!/\.ya?ml$/i.test(file.name)) return toast('YAML ファイル（.yaml / .yml）を選んでください');
  const text = await file.text();
  let r;
  try { r = target === 'compare' ? L.saveCompare(KEY, text, file.name) : L.saveLocal(text, file.name); }
  catch (e) { return modal('読み込めませんでした', `<p>YAML として解釈できませんでした。</p><pre class="code">${esc(e.message)}</pre>`); }
  if (r.errors) return modal('読み込めませんでした', `<p>モデルの形式に問題があります。</p><ul>${r.errors.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="sub">形式は docs/model-schema.md を参照してください。</p>`);
  if (target === 'compare') { location.hash = `#/m/${KEY}/compare`; location.reload(); }
  else location.hash = `#/m/${r.id}/evidence`;
}
$('file').addEventListener('change', e => e.target.files[0] && readFile(e.target.files[0]));
let dragDepth = 0;
addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { dragDepth++; $('drop').hidden = false; } });
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('drop').hidden = true; } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => {
  e.preventDefault(); dragDepth = 0; $('drop').hidden = true;
  const f = e.dataTransfer.files[0]; if (f) readFile(f, st.mode === 'compare' ? 'compare' : 'model');
});

/* ================= モーダル（設定・ヘルプ） ================= */
let lastFocus;
function modal(title, body) {
  lastFocus = document.activeElement;
  $('modal-title').textContent = title; $('modal-body').innerHTML = body; $('modal').hidden = false;
  $('modal').querySelector('.close').focus();
}
function closeModal() { $('modal').hidden = true; lastFocus?.focus?.(); }

const SHORTCUTS = [['/', '検索'], ['D', '3D / 2D を切り替え'], ['R / M', 'ドラッグを回転 / 移動に切り替え'], ['F', '選択中の部品に寄る'], ['N', '選択中の部品の周辺だけ表示'], ['Esc', '選択解除・閉じる'],
  ['1〜' + MODES.length, '表示モードの切り替え'], ['← / →', 'シナリオのステップ'], ['V', 'ビュー（論理 / 物理サービス / 物理ネットワーク）の切り替え'], ['[', 'サイドバーの開閉'], ['?', 'このヘルプ']];
function openHelp(welcome) {
  modal(welcome ? 'DeepDiverDown へようこそ' : 'ヘルプ', `
    ${welcome ? '<p>設計書・IaC・コードから起こしたモデルを 3D で表示し、問題点と「どこがまだ確かめられていないか」を見つけるためのツールです。</p>' : ''}
    <h4>基本の使い方</h4><ol class="steps-list">
      <li>左のサイドバーでモデルと表示モードを選ぶ</li><li>3D 図をドラッグで回転・移動、ホイールで拡大縮小（左上で回転／移動を切替）</li>
      <li>部品をクリックすると右のパネルに詳細・根拠・関連する指摘が出る</li><li>「根拠と確度」で点検の合否と未確認の箇所を確認する</li></ol>
    <h4>確度の見方</h4><div class="row wrap">${['fact', 'claim', 'unknown', 'drift'].map(s => tag(s)).join('')}</div>
    <p class="sub">事実＝実装で確認／主張＝設計書の記述のみ／不明＝根拠なし／ずれ＝資料どうしが食い違う</p>
    <h4>ショートカット</h4><table class="kv">${SHORTCUTS.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table>
    <h4>モデルを試す</h4><p>YAML ファイルを画面にドラッグ＆ドロップするか「開く」から読み込むと、その場で表示・点検します（ブラウザ内に保存。外部には送信しません）。</p>`);
}

function openSettings() {
  const rules = Analyze.RULES;
  modal('設定', `
    <form id="settings" class="settings">
    <h4>表示</h4>
    <label class="chk"><input type="checkbox" name="officialIcons" ${S.officialIcons ? 'checked' : ''} ${hasIcons ? '' : 'disabled'}> 公式アイコンを使う</label>
    <label>テーマ <select name="theme">${[['auto', 'OS に合わせる'], ['light', 'ライト'], ['dark', 'ダーク']].map(([v, n]) => `<option value="${v}" ${S.theme === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>ラベルの大きさ <input type="range" name="labelScale" min="0.8" max="1.5" step="0.05" value="${S.labelScale}"><output>${Math.round(S.labelScale * 100)}%</output></label>
    <label>パケットの速さ <input type="range" name="packetSpeed" min="0" max="3" step="0.25" value="${S.packetSpeed}"><output>${S.packetSpeed}×</output></label>
    <label>2D の部品デザイン <select name="nodeStyle2D"><option value="card" ${S.nodeStyle2D !== 'silhouette' ? 'selected' : ''}>ラベル一体型カード</option><option value="silhouette" ${S.nodeStyle2D === 'silhouette' ? 'selected' : ''}>種類別のシルエット</option></select></label>
    <label>3D の部品デザイン <select name="nodeStyle3D"><option value="components" ${S.nodeStyle3D !== 'flow' ? 'selected' : ''}>形と色で部品を区別</option><option value="flow" ${S.nodeStyle3D === 'flow' ? 'selected' : ''}>フロアと接続を強調</option></select></label>
    <label>初期の表示 <select name="dimension"><option value="3" ${S.dimension === '3' ? 'selected' : ''}>3D</option><option value="2" ${S.dimension === '2' ? 'selected' : ''}>2D</option></select></label>
    <label>初期の視点 <select name="defaultView">${[['iso', '斜め'], ['top', '真上'], ['side', '横'], ['back', '裏側']].map(([v, n]) => `<option value="${v}" ${S.defaultView === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>左ドラッグの既定 <select name="dragMode"><option value="rotate" ${S.dragMode === 'rotate' ? 'selected' : ''}>回転</option><option value="pan" ${S.dragMode === 'pan' ? 'selected' : ''}>移動</option></select></label>
    <h4>AI 支援</h4>
    <label>実行先 <select name="aiProvider">${Object.entries(AI_PROVIDERS).map(([id, label]) => `<option value="${id}" ${(S.aiProvider === 'codex' ? 'codex' : 'claude') === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <p class="sub">実行先は AI 用ビューアでの対話・取り込み・指摘対応に適用されます。</p>
    <h4>点検のしきい値 <small class="sub">空欄はモデルの設定（gates）に従う</small></h4>
    <label>許容する「ずれ」の件数 <input type="number" name="maxDrift" min="0" value="${S.gates.maxDrift ?? ''}" placeholder="${M.gates?.maxDrift ?? 0}"></label>
    <label>許容する重大な指摘の件数 <input type="number" name="maxHigh" min="0" value="${S.gates.maxHigh ?? ''}" placeholder="${M.gates?.maxHigh ?? 0}"></label>
    <h4>指摘ルール</h4>
    <div class="rules">${rules.map(r => `<label class="chk"><input type="checkbox" name="rule" value="${r.id}" ${S.disabledRules.includes(r.id) ? '' : 'checked'}> <span class="tag ${r.sev}">${r.sev === 'high' ? '重大' : '注意'}</span>${esc(r.title)} <small class="mono mute">${r.id}${r.for ? ' / ' + r.for : ''}</small></label>`).join('')}</div>
    <h4>データ</h4>
    <div class="locals">${REGISTRY.filter(r => r.local).map(r => `<div class="item">${esc(r.name || r.id)} <button type="button" class="b small" data-rmlocal="${r.id}">削除</button></div>`).join('') || '<div class="sub">ブラウザに読み込んだモデルはありません</div>'}</div>
    <div class="row mt"><button type="button" class="b" data-act="reset-settings">設定を初期値に戻す</button><button type="button" class="b on" data-act="reload">再読み込みして点検に反映</button></div>
    <p class="sub">表示の設定はすぐに反映されます。しきい値とルールは再読み込みで反映されます。設定はこのブラウザにだけ保存されます。</p>
    </form>`);
  const f = $('settings');
  f.addEventListener('input', e => {
    const fd = new FormData(f);
    Object.assign(S, { theme: fd.get('theme'), labelScale: +fd.get('labelScale'), packetSpeed: +fd.get('packetSpeed'), defaultView: fd.get('defaultView'), dimension: fd.get('dimension'), dragMode: fd.get('dragMode') });
    S.nodeStyle3D = fd.get('nodeStyle3D') === 'flow' ? 'flow' : 'components';
    S.nodeStyle2D = fd.get('nodeStyle2D') === 'silhouette' ? 'silhouette' : 'card';
    S.aiProvider = fd.get('aiProvider') === 'codex' ? 'codex' : 'claude';
    if (hasIcons) S.officialIcons = fd.has('officialIcons');
    const g = {}; for (const k of ['maxDrift', 'maxHigh']) if (fd.get(k) !== '') g[k] = Math.max(0, +fd.get(k)); S.gates = g;
    S.disabledRules = rules.map(r => r.id).filter(id => !fd.getAll('rule').includes(id));
    f.querySelectorAll('output')[0].textContent = Math.round(S.labelScale * 100) + '%';
    f.querySelectorAll('output')[1].textContent = S.packetSpeed + '×';
    saveSettings(S); applyAppearance(S); scene.speed = S.packetSpeed;
    if (e.target.name === 'labelScale') scene.labelsDirty = true;
    if (e.target.name === 'defaultView') scene.initialView = S.defaultView;
    if (e.target.name === 'dimension') setDimension(S.dimension);
    if (e.target.name === 'dragMode') { drag3D = S.dragMode; setDrag(drag3D); }
    if (['theme', 'officialIcons', 'nodeStyle2D', 'nodeStyle3D'].includes(e.target.name)) {
      draw();
      if (e.target.name === 'nodeStyle3D' && style3D() && scene.fitView) scene.fit(scene.fitView);
    }
  });
}

/* ================= イベント ================= */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-hit],[data-act],button[data-drag],[data-viewmode],[data-view],[data-mode],[data-scen],[data-step],[data-goto],[data-play],[data-reset],[data-down],[data-issue],[data-metric],[data-req],[data-sel],[data-focus],[data-nbr],[data-rmlocal]');
  if (e.target.closest('#modal') && !e.target.closest('.dialog')) return closeModal();
  if (e.target.closest('#modal .close')) return closeModal();
  if (!t) { if (!e.target.closest('.search')) $('qres').hidden = true; return; }
  const d = t.dataset;
  if (d.hit != null) return openHit(qHits[+d.hit]);
  if (d.act) {
    const a = d.act;
    if (a === 'dimension') return toggleDimension();
    if (a === 'share') return share();
    if (a === 'png') return exportPng();
    if (a === 'svg') return exportSvg();
    if (a === 'svg-full') return exportSvg(true);
    if (a === 'report') return exportReport();
    if (a === 'open') return pickFile('model');
    if (a === 'design' || a === 'assist-finding') {
      modal('要件定義・設計', '<div id="design-editor"></div>');
      return openDesign($('design-editor'), { key: KEY, download, aiProvider: S.aiProvider,
        finding: a === 'assist-finding' ? ISSUES[st.issue] : undefined, base: M });
    }
    if (a === 'open-compare') return pickFile('compare');
    if (a === 'clear-compare') { L.clearCompare(KEY); return location.reload(); }
    if (a === 'help') return openHelp(false);
    if (a === 'settings') return openSettings();
    if (a === 'nav') {
      if (matchMedia('(max-width:900px)').matches) return document.body.classList.toggle('nav-open'); // 狭い画面は引き出しの開閉のみ
      S.sidebar = !document.body.classList.toggle('nav-closed'); return saveSettings(S);
    }
    if (a === 'reload') return location.reload();
    if (a === 'reset-settings') { saveSettings({ ...DEFAULTS }); return location.reload(); }
    return;
  }
  if (d.rmlocal) { L.removeLocal(d.rmlocal); return location.hash = '#/m/' + REGISTRY[0].id + '/struct'; }
  if (d.drag) return setDrag(d.drag);
  if (d.viewmode) return setView(d.viewmode);
  if (d.view) return scene.fit(st.dimension === '2' ? 'top' : d.view === 'reset' ? S.defaultView : d.view);
  if (d.mode) { document.body.classList.remove('nav-open'); return setMode(d.mode); }
  if (d.focus) return select(d.focus, { focus: true });
  if (d.nbr != null) { st.nbr = !st.nbr; return draw(); }
  if (d.scen != null) { st.scen = +d.scen; st.step = 0; stopPlay(); }
  else if (d.step != null) st.step += +d.step;
  else if (d.goto != null) st.step = +d.goto;
  else if (d.play != null) { if (st.play) stopPlay(); else st.play = setInterval(() => { st.step = (st.step + 1) % M.scenarios[st.scen].steps.length; draw(); }, 2500); }
  else if (d.reset != null) st.down = [];
  else if (d.down) st.down = [...new Set([...st.down, d.down])];
  else if (d.issue != null) st.issue = st.issue === +d.issue ? null : +d.issue;
  else if (d.metric) st.metric = d.metric;
  else if (d.req != null) { st.req = d.req || null; st.mode = 'req'; }
  else if (d.sel != null) return select(d.sel || null, { focus: !!d.sel });
  draw();
});
document.addEventListener('change', e => {
  if (e.target.dataset.tier) { e.target.checked ? st.hidden.delete(e.target.dataset.tier) : st.hidden.add(e.target.dataset.tier); draw(); }
  if (e.target.id === 'nbr') { st.nbr = e.target.checked; draw(); }
});
$('q').addEventListener('input', e => search(e.target.value));
$('q').addEventListener('focus', e => e.target.value && search(e.target.value));
$('q').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { qIdx = Math.min(qIdx + 1, qHits.length - 1); renderHits(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { qIdx = Math.max(qIdx - 1, 0); renderHits(); e.preventDefault(); }
  if (e.key === 'Enter' && qHits[qIdx]) openHit(qHits[qIdx]);
  if (e.key === 'Escape') { e.target.value = ''; search(''); $('qres').hidden = true; e.target.blur(); }
});
addEventListener('keydown', e => {
  if (!$('modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
  if (e.target.closest('input,select,textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === '/') { e.preventDefault(); return $('q').focus(); }
  if (k === '?') return openHelp(false);
  if (k === 'Escape') return select(null);
  if (k === 'd' || k === 'D') return toggleDimension();
  if (k === 'v' || k === 'V') return setView(VIEWS[(VIEWS.indexOf(st.view) + 1) % VIEWS.length]);
  if (k === 'r' || k === 'R') return setDrag('rotate');
  if (k === 'm' || k === 'M') return setDrag('pan');
  if ((k === 'f' || k === 'F') && st.sel) return select(st.sel, { focus: true });
  if ((k === 'n' || k === 'N') && st.sel) { st.nbr = !st.nbr; return draw(); }
  if (k === '[') return document.querySelector('[data-act="nav"]').click();
  if (/^[1-9]$/.test(k) && MODES[+k - 1]) return setMode(MODES[+k - 1][0]);
  if (st.mode === 'scenario' && M.scenarios?.length) {
    const n = M.scenarios[st.scen].steps.length;
    if (k === 'ArrowRight' && st.step < n - 1) { st.step++; draw(); }
    if (k === 'ArrowLeft' && st.step > 0) { st.step--; draw(); }
  }
});

/* ================= 起動 ================= */
document.title = `${M.name} — DeepDiverDown`;
$('mtitle').textContent = M.name;
setDimension(st.dimension, false);
renderLibrary();
if (st.mode === 'compare') await ensureComparison();
draw();
if (ROUTE.q.v) { const v = ROUTE.q.v.split('_').map(Number); if (v.length === 7 && v.every(Number.isFinite)) scene.setView({ p: v.slice(0, 3), t: v.slice(3, 6), z: v[6] }); }
if (ENTRY.id !== ROUTE.id && ROUTE.id) toast(`モデル「${ROUTE.id}」が見つからないため、${M.name} を表示しています`);
if (once('ddd.welcome')) openHelp(true);
