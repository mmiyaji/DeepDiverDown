/* DeepDiverDown viewer：アプリの枠組み（ヘッダー・サイドバー・パネル）、3D 図、各モード、設定・検索・共有・書き出し */
import { enhanceSelect } from './dropdown.js';
import { Scene3D } from './scene3d.js?v=perf9';
import { buildDiagramLayout, overviewScale } from './diagram-layout.js?v=perf9';
import { implementation3D, platformFootprint, platformNeedsMemberBounds } from './implementation-3d.js?v=platform-boundary1';
import { legendState, showGroup, showLink } from './legend-visibility.js';
import { comparisonCandidates, renderReferenceComparison } from './reference-compare.js?v=performance-compare1';
import { NODE_KINDS, nodeShape } from './node-kinds.js';
import { loadServiceIcons } from './service-icons.js';
import { loadSettings, saveSettings, applyAppearance, once, DEFAULTS, AI_PROVIDERS } from './settings.js?v=render-mode1';
import * as L from './loader.js?v=nc1';
import { openDesign } from './design.js?v=objects1';
import { FileMap } from './filemap.js?v=review1';
import { initResize } from './resize.js?v=rz3';
import { productOf, productName, isConcept, shortName, PRODUCT_ALSO } from './products.js?v=4';
import { CATEGORY_INFO, CATEGORY_DOCS } from './categories.js?v=table1';
import { drawThumbnail } from './home-thumbnail.js';
import { lab } from './lab.js';
import { labLayout } from './lab-layout.js';
import { TreeMap, DistMap, GridMap, TimelineMap, BlockMap } from './datavis.js?v=detail-hint1';

const $ = id => document.getElementById(id);
// 一覧のスクロールは内側の領域で行う。古いブラウザーでも外枠の横ずれを戻す。
const sidebar = $('sidebar');
sidebar.addEventListener('scroll', () => { if (sidebar.scrollLeft) sidebar.scrollLeft = 0; });
sidebar.scrollLeft = 0;
// 折り返し位置に関係なく、開いたメニューを画面内に収める。
function fitToolbarMenu(details) {
  const menu = details.querySelector(':scope > .menu-list');
  if (!menu || !details.open) return;
  menu.style.transform = '';
  const r = menu.getBoundingClientRect();
  const offset = Math.max(0, -r.left) - Math.max(0, r.right - innerWidth);
  if (offset) menu.style.transform = `translateX(${offset}px)`;
}
const toolbarMenus = document.querySelectorAll('.stage-head details.tb-menu');
toolbarMenus.forEach(details => details.addEventListener('toggle', () => fitToolbarMenu(details)));
addEventListener('resize', () => toolbarMenus.forEach(fitToolbarMenu));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ================= 設定・ルーティング・データ読込 ================= */
const S = loadSettings();
applyAppearance(S);
if (!S.sidebar) document.body.classList.add('nav-closed');

function parseRoute() {
  const h = location.hash.slice(1);
  const c = h.match(/^\/c\/([^/?]+)\/([^/?]+)/);
  if (c) {
    const dec = x => { try { return decodeURIComponent(x); } catch { return x; } };
    let last = ''; try { last = sessionStorage.getItem('ddd.lastModel') || ''; } catch {}
    return { id: last, mode: null, q: {}, cat: { domain: dec(c[1]), category: dec(c[2]) } };
  }
  const m = h.match(/^\/m\/([^/?]+)(?:\/([^/?]+))?(?:\?(.*))?$/);
  const encodedId = m?.[1] ?? h.split('?')[0]; // 旧形式 #ec-shop も受け付ける
  let id = encodedId;
  try { id = decodeURIComponent(encodedId); } catch { /* 不正なエンコードは未知の ID として扱う */ }
  return { id, mode: m?.[2] || null, q: Object.fromEntries(new URLSearchParams(m?.[3] || '')) };
}
const ROUTE = parseRoute();
const PREVIEW = window.parent !== window && new URLSearchParams(location.search).get('preview') === 'reference';
if (PREVIEW) document.body.classList.add('reference-preview');
const compareViewport = document.createElement('div');
compareViewport.className = 'diagram-viewport';
$('view').before(compareViewport);
compareViewport.append($('view'));
let readableDiagram = false;
function updateDiagramScale() {
  const view = $('view'), button = document.querySelector('[data-act="readable-diagram"]');
  const applicable = !PREVIEW && st.dimension === '2' && compareViewport.classList.contains('compare-viewport');
  button.hidden = !applicable;
  button.setAttribute('aria-pressed', String(applicable && readableDiagram));
  button.textContent = readableDiagram ? '全体を表示' : '文字を拡大';
  let scale = 1;
  if (applicable && !readableDiagram) {
    const width = parseFloat(view.style.minWidth) || compareViewport.clientWidth;
    const height = parseFloat(view.style.minHeight) || compareViewport.clientHeight;
    scale = overviewScale(compareViewport.clientWidth, compareViewport.clientHeight, width, height);
  }
  const value = scale === 1 ? '' : String(scale);
  if (view.style.zoom !== value) view.style.zoom = value;
}
const [REGISTRY, icons] = await Promise.all([L.loadRegistry(), loadServiceIcons()]);
Catalog.setIcons(icons);
const hasIcons = Object.keys(icons).length > 0;
const ENTRY = REGISTRY.find(r => r.id === ROUTE.id) || REGISTRY[0], KEY = ENTRY.id;
function previewRoles() {
  if (!PREVIEW) return null;
  const data = JSON.parse(window.frameElement?.dataset.comparison || 'null');
  return data?.model === KEY ? { parts: new Map(data.parts), active: data.active } : null;
}
let compared = previewRoles();
if (ENTRY.reference && !PREVIEW) {
  $('graph-entry').href = 'knowledge-graph.html?model=' + encodeURIComponent(KEY);
  $('graph-entry').hidden = false;
}
const peers = comparisonCandidates(REGISTRY, KEY);
if (ENTRY.reference && !PREVIEW && peers.length) {
  const section = $('related-models'), list = $('related-models-list');
  const ordered = [...peers].sort((a, b) => {
    const rank = p => p.topics.some(t => t === '全体構成との対応' || t === '詳細構成との対応') ? 0 : 1;
    return rank(a) - rank(b);
  });
  function makeList(items) {
    const ul = document.createElement('ul');
    for (const { entry, topics } of items) {
      const li = document.createElement('li'), link = document.createElement('a'), reason = document.createElement('span');
      link.href = `index.html#/m/${encodeURIComponent(entry.id)}/struct`;
      link.textContent = entry.name;
      reason.textContent = [...new Set(topics)].join(' / ');
      li.append(link, reason); ul.append(li);
    }
    return ul;
  }
  list.append(makeList(ordered.slice(0, 4)));
  if (ordered.length > 4) {
    const more = document.createElement('details'), summary = document.createElement('summary');
    summary.textContent = `ほか ${ordered.length - 4} 件を表示`;
    more.append(summary, makeList(ordered.slice(4))); list.append(more);
  }
  $('related-models-graph').href = 'knowledge-graph.html?model=' + encodeURIComponent(KEY);
  section.hidden = false;
}
if (peers.length && !PREVIEW) {
  $('compare-entry').hidden = false;
  $('compare-entry').textContent = `比較対象（${peers.length}件）`;
}
const { model: M, actual: A, docs: DOCS } = labLayout(await L.loadEntry(ENTRY));
window.viewerLoading.drawing();
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
  ['compare', 'バージョン比較'],
].filter(mode => mode && (!ENTRY.reference || ['struct', 'scenario'].includes(mode[0])));

const VIEWS = Views.available(M);
const initialView = VIEWS.includes(ROUTE.q.w) ? ROUTE.q.w : VIEWS.includes(M.views?.default) ? M.views.default : 'cloud';
const initialSelection = ROUTE.q.s;
const initialImplNodes = Views.implOf(M, initialView)?.nodes || {};
const st = {
  cmpOnly: false, cmpKinds: new Set(["added", "removed", "changed"]), minimap: S.minimap ?? true,
  dimension: ['2', '3'].includes(ROUTE.q.d) ? ROUTE.q.d : PREVIEW ? '2' : S.dimension,
  expanded: ROUTE.q.spread === '1',
  view: initialView,
  mode: MODES.some(m => m[0] === ROUTE.mode) ? ROUTE.mode : 'struct',
  sel: Object.hasOwn(M.nodes, initialSelection) || Object.hasOwn(initialImplNodes, initialSelection) ? initialSelection : null,
  nbr: ROUTE.q.n === '1',
  hidden: new Set((ROUTE.q.h || '').split(',').filter(Boolean)),
  scen: +ROUTE.q.sc || 0, step: +ROUTE.q.st || 0, down: (ROUTE.q.down || (['2', '3'].includes(ROUTE.q.d) ? '' : ROUTE.q.d) || '').split(',').filter(id => M.nodes[id]),
  issue: ROUTE.q.i != null ? +ROUTE.q.i : null, edge: null, req: ROUTE.q.r || null, metric: METRICS.some(x => x[0] === ROUTE.q.m) ? ROUTE.q.m : METRICS[0][0], play: null,
};
const legendVisibility = { '2': legendState(S.legendVisibility?.['2']), '3': legendState(S.legendVisibility?.['3']) };
const legendCurrent = () => legendVisibility[st.dimension];
if (!M.scenarios?.[st.scen]) st.scen = 0;
if (!Number.isInteger(st.step) || !M.scenarios?.[st.scen]?.steps?.[st.step]) st.step = 0;

/* 現在の状態 → URL（共有リンク）。withView で視点も含める */
function routeHash(withView) {
  const q = new URLSearchParams();
  if (st.view !== 'cloud') q.set('w', st.view);
  if (st.dimension === '2' || S.dimension === '2' || withView) q.set('d', st.dimension);
  if (st.expanded) q.set('spread', '1');
  if (st.sel) q.set('s', st.sel);
  if (st.edge) q.set('edge', st.edge);
  if (st.nbr) q.set('n', '1');
  if (st.hidden.size) q.set('h', [...st.hidden].join(','));
  if (st.mode === 'scenario') { q.set('sc', st.scen); q.set('st', st.step); }
  if (st.mode === 'fail' && st.down.length) q.set('down', st.down.join(','));
  if (st.mode === 'lint' && st.issue != null) q.set('i', st.issue);
  if (st.mode === 'req' && st.req) q.set('r', st.req);
  if (st.mode === 'metric') q.set('m', st.metric);
  if (withView) { const v = scene.getView(); q.set('v', [...v.p, ...v.t, v.z].join('_')); }
  const s = q.toString();
  return `#/m/${encodeURIComponent(KEY)}/${st.mode}${s ? '?' + s : ''}`;
}
const syncUrl = () => {
  if (parseRoute().cat) return; // 分類ページの URL は書き換えない
  const next = routeHash(false);
  if (location.hash !== next) history.replaceState(null, '', next);
};
addEventListener('hashchange', () => {
  const r = parseRoute();
  if (r.cat) return showCategoryPage(r.cat);
  hideCategoryPage();
  if (r.id !== KEY || r.q.v) location.reload();
});

/* ================= ビュー（論理 / サービス / ネットワーク） =================
 * 解析・モードの状態は物理モデル（allNodes / allLinks）で計算し、描画だけ VW() の部品に写す */
let PROJ = null, PROJKEY = '';
function VW() {
  const key = `${st.view}|${st.dimension}|${st.mode === 'evidence' ? 'e' : st.mode === 'compare' ? 'c' : ''}`;
  if (key !== PROJKEY) {
    let tiers = M.tiers;
    if (st.mode === 'compare' && CMPR) {
      const removedFloors = new Set(Object.values(CMPR.removedNodes).map(n => n.tier));
      tiers = [...tiers, ...CMP.model.tiers.filter(t => removedFloors.has(t.id) && !tiers.some(now => now.id === t.id))];
    }
    PROJ = Views.project({ tiers, groups: M.groups || [], nodes: allNodes(), links: allLinks() }, M, st.view);
    const impl = Views.implOf(M, st.view);
    PROJ = implementation3D(PROJ, st.dimension === '3' ? impl?.layout3d : impl?.layout2d,
      { flat: st.dimension === '2' });
    PROJKEY = key;
  }
  return PROJ;
}
/* 物理部品 ID → いまのビューでそれを表す部品 ID */
const viewIdOf = id => { const P = VW(); return P.nodes[id] ? id : Object.keys(P.from).find(k => P.from[k].includes(id)); };

/* ================= 座標 ================= */
const TI = id => VW().tiers.find(t => t.id === id) || {};
const style3D = () => st.dimension === '3' ? (S.nodeStyle3D === 'flow' ? 'flow' : 'components') : null;
let layoutView, layoutKey, layout;
function diagramLayout() {
  const view = VW(), flat = st.dimension === '2';
  const dense = flat && (PREVIEW || Object.keys(view.nodes).length >= 5);
  compareViewport.classList.toggle('compare-viewport', dense);
  if (!dense) { $('view').style.minWidth = ''; $('view').style.minHeight = ''; }
  const viewport = dense ? compareViewport : $('view');
  const width = viewport.clientWidth || 1, height = viewport.clientHeight || 1;
  const key = flat ? `2|${width}|${height}|${S.labelScale}` : `3|${st.expanded}`;
  if (view !== layoutView || key !== layoutKey) {
    const compact = width <= 620 && (!dense || height >= width);
    layout = buildDiagramLayout(view, { flat, expanded: st.expanded, compact, comparison: dense, cardWidthPx: PREVIEW ? 128 : 170, width, height, labelScale: S.labelScale });
    layoutView = view;
    layoutKey = key;
  }
  return layout;
}
const W = (x, z, tier) => diagramLayout().point(x, z, tier);
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
// Reference edges may describe data or control flow without specifying
// call timing. A projected edge inherits timing only when its sources agree.
const sourceTiming = new Map(M.links.map(l => [l.id, l.sync]));
function linkTiming(l) {
  if (!ENTRY.reference) return Boolean(l.sync);
  if (l.impl || sourceTiming.has(l.id)) return l.sync;
  const sources = VW().linkFrom[l.id] || [];
  const timing = sourceTiming.get(sources[0]);
  return sources.every(id => sourceTiming.get(id) === timing) ? timing : undefined;
}
function timingLabel(l) {
  const timing = linkTiming(l);
  return timing === true ? '同期' : timing === false ? '非同期' : '';
}

/* ================= モード → 見た目 ================= */
function decorate() {
  const N = allNodes(), ns = {}, ls = {};
  Object.keys(N).forEach(id => ns[id] = {});
  allLinks().forEach(l => ls[l.id] = {});
  const focus = (nodes = [], links = []) => {
    Object.keys(ns).forEach(id => nodes.includes(id) ? ns[id].outline = true : ns[id].dim = true);
    allLinks().forEach(l => links.includes(l.id) ? Object.assign(ls[l.id], { on: true, color: '--view-accent' }) : ls[l.id].dim = true);
  };
  Object.entries(N).forEach(([id, n]) => { if ((n.replicas ?? 1) > 1 && n.replicas < 99) ns[id].badge = { text: `${n.replicas}台`, tone: 'replicas' }; });

  if (st.mode === 'scenario' && M.scenarios?.length) {
    const current = new Set(M.scenarios[st.scen].steps[st.step].links);
    const active = new Set();
    // lab: flow-numbers / flow-trail / flow-both（通過済みの線を残す・ステップ番号を出す）
    const flowNo = lab('flow-numbers') || lab('flow-both'), flowTrail = lab('flow-trail') || lab('flow-both');
    const passed = new Map();
    if (flowTrail) M.scenarios[st.scen].steps.slice(0, st.step).forEach(step => (step.links || []).forEach(id => passed.set(id, true)));
    for (const l of allLinks()) {
      if (current.has(l.id)) {
        Object.assign(ls[l.id], { on: true, color: '--view-accent', packets: !REDUCED });
        if (flowNo) ls[l.id].stepNo = st.step + 1;
        active.add(l.from); active.add(l.to);
      } else if (passed.has(l.id)) Object.assign(ls[l.id], { on: true, trail: true, color: '--view-accent' });
      else ls[l.id].dim = true;
    }
    for (const id of Object.keys(ns)) {
      if (active.has(id)) ns[id].outline = true;
      else if (active.size) ns[id].dim = true;
    }
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
  const edge = st.edge && allLinks().find(l => l.id === st.edge);
  if (edge) {
    Object.assign(ls[edge.id], { on: true, dim: false, color: '--view-accent' });
    for (const id of [edge.from, edge.to]) if (ns[id]) Object.assign(ns[id], { outline: true, dim: false });
  }
  return { ns, ls };
}
const fmt = (k, v) => { const u = (METRICS.find(x => x[0] === k) || [])[2] || ''; return u === '$' ? `$${v}` : `${v}${u}`; };

/* ================= 3D 描画 ================= */
const scene = new Scene3D($('view'), { onPick, onDrill: id => drillInto(id), onPickEdge: id => inspectEdge(id, true) });
scene.onFlatResize = () => {
  const previous = layout;
  if (diagramLayout() !== previous) drawScene();
};
/* ドリルダウン：部品へズームインしながら詳細図へ、パンくずではズームアウトしながら上位の図へ移る */
/* 図の下のデータの見取り図：ファイルの解剖図・メタデータの木・分布のいずれか */
const onVisNode = { onNode: id => { if (M.nodes[id] && st.sel !== id) select(id); } };
/* 1 つのモデルが複数の見取り図を持てる。タブで切り替え、シナリオの visual（見取り図の ID）で自動的に切り替える */
const VIS_DEFS = [
  M.fileLayout?.segments?.length && { id: 'file', title: 'ファイルの解剖図', make: el => new FileMap(el, M.fileLayout, onVisNode) },
  M.treeLayout?.root && { id: 'tree', title: M.treeLayout.title || 'メタデータの木', make: el => new TreeMap(el, M.treeLayout, onVisNode) },
  M.distribution?.bars?.length && { id: 'distribution', title: M.distribution.title || '分布', make: el => new DistMap(el, M.distribution, onVisNode) },
  M.grid?.rows?.length && { id: 'grid', title: M.grid.title || '表', make: el => new GridMap(el, M.grid, onVisNode) },
  M.timeline?.commits?.length && { id: 'timeline', title: M.timeline.title || 'タイムライン', make: el => new TimelineMap(el, M.timeline, onVisNode) },
  ...[].concat(M.blocks || []).filter(b => b?.lanes?.length).map((b, i) => ({ id: b.id || 'blocks' + i, title: b.title || 'データの移動', make: el => new BlockMap(el, b, onVisNode) })),
].filter(Boolean);
const VIS = new Map();
let visActive = VIS_DEFS[0]?.id;
if (VIS_DEFS.length) {
  const dock = $('filemap');
  dock.innerHTML = (VIS_DEFS.length > 1 ? `<div class="vis-tabs" role="tablist">${VIS_DEFS.map(d => `<button type="button" role="tab" data-vis="${esc(d.id)}">${esc(d.title)}</button>`).join('')}</div>` : '')
    + VIS_DEFS.map(d => `<div class="vis-pane" data-pane="${esc(d.id)}"></div>`).join('');
  for (const d of VIS_DEFS) VIS.set(d.id, d.make(dock.querySelector(`[data-pane="${CSS.escape(d.id)}"]`)));
  dock.addEventListener('click', e => { const t = e.target.closest('[data-vis]'); if (t) { visActive = t.dataset.vis; syncFileMap(); } });
}
const FM = VIS.size ? { sync: (ctx, sel) => { for (const [id, v] of VIS) if (id === visActive) v.sync(ctx, sel); } } : null;
$('filemap').hidden = !FM;
initResize();
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
function transitionTo(hash, dir, origin, from) {
  try { sessionStorage.setItem('ddd.drill', JSON.stringify({ dir, at: Date.now(), from })); } catch {}
  if (REDUCED) { location.hash = hash; return; }
  const v = $('view');
  if (origin) v.style.transformOrigin = `${origin[0] * 100}% ${origin[1] * 100}%`;
  v.classList.add(dir === 'in' ? 'drill-leave-in' : 'drill-leave-out');
  setTimeout(() => { location.hash = hash; }, 420);
}
function drillInto(id) {
  const d = allNodes()[id]?.drill;
  if (!d || !REGISTRY.some(r => r.id === d)) return;
  const p = scene.nodePos(id);
  if (p && !REDUCED) scene.focusOn(p, scene.camera.zoom * 2.6);
  transitionTo(`#/m/${encodeURIComponent(d)}/struct`, 'in', scene.nodeScreen(id), { model: KEY, node: id });
}
/* 遷移してきた直後は、入ってくる演出を付ける（詳細図：奥から手前へ広がる／上位の図：手前から引いて戻る） */
try {
  const t = JSON.parse(sessionStorage.getItem('ddd.drill') || 'null'); sessionStorage.removeItem('ddd.drill');
  // 来た図を覚えておき、パンくずはそこへ戻す（同じ詳細図に複数の入口があるため）
  if (t?.dir === 'in' && t.from?.model) sessionStorage.setItem('ddd.back.' + KEY, JSON.stringify(t.from));
  if (t && Date.now() - t.at < 4000 && !REDUCED) {
    const v = $('view'); v.classList.add(t.dir === 'in' ? 'drill-enter-in' : 'drill-enter-out');
    setTimeout(() => v.classList.remove('drill-enter-in', 'drill-enter-out'), 700);
  }
} catch {}
scene.speed = S.packetSpeed; scene.renderMode = S.renderMode;
scene.initialView = S.defaultView;

const serviceLabel = svc => svc && `${svc.name}｜${svc.providerLabel}`;
const kindLabel = kind => Object.hasOwn(NODE_KINDS, kind) ? NODE_KINDS[kind].label : kind;

function nodeSpec(id, n, s) {
  const role = compared?.parts.get(id);
  const svc = Catalog.lookup(n.svc);
  const shape = nodeShape(n.kind, svc?.shape);
  const flat = st.dimension === '2';
  const solidStyle = style3D();
  const flatStyle = flat ? (S.nodeStyle2D === 'silhouette' ? 'silhouette' : 'card') : null;
  const ext = n.kind === 'external';
  let color = scene.color('--paper'), opacity = s.dim ? 0.15 : s.soft ? 0.38 : 1, dashed = ext;
  if (n.kind === 'actor') color = scene.mix((ROLES[n.role] || ROLES.user).c, '--paper', 0.5);
  else if (svc) color = scene.mix(svc.color, '--paper', 0.42);
  else if (['db', 'queue', 'cache'].includes(n.kind)) color = scene.color('--dark');
  if (flatStyle === 'silhouette' && !svc && n.kind !== 'actor') {
    const tint = n.shape3D === 'crate' ? '#348573'
      : { cyl: '#477786', queue: '#397972', slab: '#a06a42', box: '#526885' }[shape] || '#526885';
    color = scene.mix(tint, '--paper', 0.48);
  }
  if (solidStyle === 'components' && !svc && n.kind !== 'actor') {
    const tint = n.shape3D === 'crate' ? '#348573'
      : { cyl: '#32778f', queue: '#258477', slab: '#b0703f', box: n.kind === 'worker' ? '#3e718b' : '#627c96' }[shape] || '#627c96';
    color = scene.mix(tint, '--paper', 0.82);
  } else if (solidStyle === 'flow') color = scene.color('--paper');
  if (s.fill === 'down') color = scene.color('--accent');
  if (s.fill === 'impact') color = scene.mix('--accent', '--paper', 0.38);
  if (s.fill === 'delay') color = scene.mix('--warn', '--paper', 0.38);
  if (s.heat != null) color = scene.mix('--accent', '--paper', s.heat * 0.85);
  if (s.status === 'claim') { opacity = Math.min(opacity, 0.55); dashed = true; }
  if (s.status === 'unknown') { opacity = Math.min(opacity, 0.22); dashed = true; }
  if (s.status === 'drift') s.outline = true;
  if (s.ghost) { opacity = Math.min(opacity, 0.3); dashed = true; }
  return {
    id, shape, shape3D: n.shape3D, kind: n.kind, flat, flatStyle, solidStyle, color, cardTint: s.fill || s.heat != null ? color.getStyle() : null, opacity, dashed, outline: !!s.outline || !!role && role[0] === compared.active, comparisonRole: role, h: s.h || (n.kind === 'client' ? 0.7 : 1), pos: W(n.x, n.y, n.tier),
    icon: S.officialIcons ? svc?.iconUrl : null,
    label: n.label, selected: id === st.sel || VW().from[id].includes(st.sel), labelAccent: s.fill === 'down', abbr: svc && { text: svc.abbr, color: svc.color },
    // 並列表現：parallel（同じ実行単位が N 個）・slots（同時に走る Task 数）・partitions（データの分割数）
    parallel: n.parallel, slots: n.slots, partitions: n.partitions,
    badge: s.badge || (n.parallel ? { text: `×${n.parallel} 並列`, tone: 'par' } : n.drill ? { text: '▼ 詳細図', tone: 'drill' } : null),
    management: (!flat || VW().platform2D) && n.management?.type ? n.management : null,
    sub: svc ? { text: serviceLabel(svc), color: svc.providerColor } : (n.slots || n.partitions) ? { text: [n.slots && `同時 ${n.slots} Task`, n.partitions && `${n.partitions} 分割`].filter(Boolean).join('・'), color: 'var(--par)' } : undefined,
  };
}

/* 物理部品の状態 → ビューの部品の状態 */
function projectState(ns, ls) {
  const P = VW(), nsV = {}, lsV = {};
  for (const [vid, parts] of Object.entries(P.from)) {
    const s = nsV[vid] = Views.mergeNode(parts.map(p => ns[p]));
    const n = P.nodes[vid];
    if (n.impl) s.badge = Views.implementationBadge(s.badge, n.replicas);
    if (st.view === 'network' && s.badge?.tone === 'replicas' && n.replicas < 99) s.badge = { text: `${n.replicas}台`, tone: 'replicas' }; // AZ ごとの台数
    if (parts.length > 1 && !s.badge) s.badge = { text: `${parts.length} ${n.impl ? '機能' : '部品'}` };
    if (st.sel && (vid === st.sel || parts.includes(st.sel))) s.outline = true;
  }
  for (const l of P.links) {
    const s = lsV[l.id] = Views.mergeLink((P.linkFrom[l.id] || []).map(p => ls[p]));
    if (st.edge === l.id) {
      Object.assign(s, { on: true, dim: false, color: '--view-accent' });
      for (const id of [l.from, l.to]) if (nsV[id]) Object.assign(nsV[id], { outline: true, dim: false });
    }
    if (l.crossAz && !s.on && !s.dim) Object.assign(s, { on: true, color: '--warn' }); // AZ をまたぐ通信
  }
  /* 選択中は、つながっている部品と接続を残して周りを控えめにする（「周辺だけ」より穏やか） */
  const sv = st.sel && viewIdOf(st.sel);
  if (sv && !st.nbr) {
    const near = new Set([sv]);
    for (const l of P.links) { if (l.from === sv) near.add(l.to); if (l.to === sv) near.add(l.from); }
    for (const [vid, s] of Object.entries(nsV)) if (!near.has(vid) && !s.dim) s.soft = true;
    for (const l of P.links) {
      const s = lsV[l.id];
      if (l.from === sv || l.to === sv) { if (!s.on) Object.assign(s, { on: true, color: '--ink' }); }
      else if (!s.dim) s.soft = true;
    }
  }
  /* 比較の絞り込み：選んだ種類の変化だけを強調し、変化のない部品は薄くする */
  if (st.mode === 'compare' && CMPR && st.cmpOnly) {
    for (const [vid, parts] of Object.entries(P.from)) {
      const hit = parts.some(p => st.cmpKinds.has(CMPR.nodes[p]));
      if (!hit) nsV[vid].dim = true;
    }
    for (const l of P.links) if (!(P.linkFrom[l.id] || []).some(p => st.cmpKinds.has(CMPR.links[p]))) lsV[l.id].dim = true;
  }
  return { nsV, lsV };
}

function draw() { drawScene(); syncFileMap(); }
/* ファイルの解剖図：部品の選択と、シナリオの読み取り範囲（steps[].read）を帯に反映する */
function syncFileMap() {
  if (!FM) return;
  const sc = st.mode === 'scenario' && M.scenarios?.length ? M.scenarios[st.scen] : null;
  const ctx = sc ? { steps: sc.steps, idx: st.step } : null;
  // シナリオが見取り図を指定していればそれを前に出す（指定が無ければ今のまま）
  if (sc?.visual && VIS.has(sc.visual) && sc !== syncFileMap.lastSc) visActive = sc.visual;
  syncFileMap.lastSc = sc;
  const dock = $('filemap');
  dock.querySelectorAll('[data-vis]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.vis === visActive)));
  dock.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== visActive; });
  FM.sync(ctx, st.sel);
}
function drawScene() {
  const d = decorate(), { nsV: ns, lsV: ls } = projectState(d.ns, d.ls), P = VW(), N = P.nodes;
  const plan = diagramLayout();
  $('view').classList.toggle('hide-node-labels', !legendCurrent().labels);
  $('view').classList.toggle('hide-management', !legendCurrent().management);
  scene.comparisonScale = compareViewport.classList.contains('compare-viewport') ? plan.unitsPerPixel : null;
  scene.begin();
  for (const t of P.tiers) {
    if (st.hidden.has(t.id)) continue;
    const f = diagramLayout().floors.get(t.id);
    scene.floor({ id: t.id, style: style3D(), insetLabel: st.dimension === '2',
      x0: f.x + f.left, x1: f.x + f.right, z0: f.z + f.back, z1: f.z + f.front,
      y: f.y, origin: t.kind === 'origin', label: t.label });
  }
  const labeled = new Set();
  // In the stack view the platform is one shared footprint beneath the layers,
  // rather than a separate cloud rectangle on every floor.
  if (P.platformStack && st.dimension === '3') for (const gr of P.groups || []) {
    if (!['cloud', 'datacenter'].includes(gr.kind) || !showGroup(gr, legendCurrent())) continue;
    const members = Object.entries(N).filter(([id, n]) => visible(n) && (gr.nodes ? gr.nodes.includes(id) : [].concat(gr.tier).includes(n.tier)));
    if (!members.length) continue;
    const points = members.map(([, n]) => W(n.x, n.y, n.tier));
    const ys = points.map(p => p[1]);
    const floors = [...new Set(members.map(([, n]) => n.tier))].map(t => plan.floors.get(t)).filter(Boolean);
    const memberBounds = platformNeedsMemberBounds(P.groups || [], members, Object.entries(N).filter(([, n]) => visible(n)));
    const [left, right, back, front] = platformFootprint(points, floors, memberBounds);
    const bottom = Math.min(...ys) - 0.18, top = Math.max(...ys) + 2.1;
    const provider = Catalog.PROVIDERS[gr.provider];
    const pts = [[left, back], [right, back], [right, front], [left, front]];
    scene.group({ y: bottom, labelY: top, kind: gr.kind, label: gr.label, color: provider?.color, pts });
    scene.platformEnvelope({ pts, bottom, top, color: provider?.color });
    labeled.add(gr);
  }
  for (const gr of P.groups || []) for (const t of [].concat(gr.tier)) {
    if (!showGroup(gr, legendCurrent())) continue;
    if (P.platformStack && st.dimension === '3' && ['cloud', 'datacenter'].includes(gr.kind)) continue;
    if (st.hidden.has(t) || !P.tiers.some(x => x.id === t)) continue;
    let { x0, y0, x1, y1 } = gr;
    if (![x0, y0, x1, y1].every(Number.isFinite)) {
      const members = Object.entries(N).filter(([id, n]) => n.tier === t &&
        (!gr.nodes || gr.nodes.includes(id) || P.from[id].some(source => gr.nodes.includes(source))) &&
        (gr.kind !== 'az' || !gr.az || n.az?.includes(gr.az))).map(([, n]) => n);
      if (!members.length) continue;
      const xs = members.map(n => n.x), ys = members.map(n => n.y);
      // 3D は枠と部品の間を広げ、入れ子の枠が部品に密着して見えないようにする
      const padding = (st.dimension === '3' ? { cloud: 1.7, region: 1.4, cluster: 2.0, datacenter: 1.8, namespace: 1.1 }
        : { cloud: 1.2, region: 1.0, cluster: 0.8, namespace: 0.6 })[gr.kind] ?? (st.dimension === '3' ? 1.1 : 0.8);
      // Cards retain their screen size as the diagram scales. A fixed model
      // margin can therefore put a cloud border through its member cards.
      const vertical = plan.floors.get(t)?.vertical;
      const cardX = 96 * S.labelScale * plan.unitsPerPixel;
      const cardY = 43 * S.labelScale * plan.unitsPerPixel;
      const px = st.dimension === '2' ? Math.max(padding, (vertical ? cardY / 1.3 : cardX / 1.65)) : padding;
      const py = st.dimension === '2' ? Math.max(padding, (vertical ? cardX / 1.65 : cardY / 1.3)) : padding;
      x0 = Math.min(...xs) - px; x1 = Math.max(...xs) + px;
      y0 = Math.min(...ys) - py; y1 = Math.max(...ys) + py;
    }
    const provider = Catalog.PROVIDERS[gr.provider];
    const label = gr.kind === 'cloud' && provider && !gr.label?.includes(provider.label)
      ? [provider.label, gr.label].filter(Boolean).join('｜') : gr.label;
    const [left, y, back] = W(x0, y0, t), [right, , front] = W(x1, y1, t);
    const brandIcon = S.officialIcons && ['snowflake', 'databricks', 'fabric', 'purview'].includes(gr.provider)
      ? Catalog.lookup(gr.provider + ':platform')?.iconUrl : null;
    scene.group({ y, kind: gr.kind, label: labeled.has(gr) ? "" : (labeled.add(gr), label), color: provider?.color, brandIcon,
      pts: [[left, back], [right, back], [right, front], [left, front]] });
  }
  for (const l of P.links) {
    if (!visible(N[l.from]) || !visible(N[l.to]) || !showLink(linkTiming(l), legendCurrent())) continue;
    const s = ls[l.id] || {};
    const crossFloor = N[l.from].tier !== N[l.to].tier;
    const solid = !!style3D();
    const layout = diagramLayout();
    scene.link({ id: l.id, from: l.from, to: l.to, points: layout.routes.get(l.id), arrowPosition: layout.arrowPositions.get(l.id), unitsPerPixel: layout.unitsPerPixel,
      solid, flat: st.dimension === '2', arrow: true, color: s.color || (s.on ? '--ink' : '--diagram-link'), thick: !!s.on && !s.trail, stepNo: s.stepNo, packets: !!s.packets && !REDUCED,
      dashed: s.dashed || (style3D() === 'flow' && crossFloor && !s.on ? 'dot' : linkTiming(l) === false ? 'dash' : null),
      opacity: s.dim ? 0.12 : s.soft ? 0.18 : s.trail ? 0.65 : s.on ? 1 : solid && !crossFloor ? 0.9 : 0.72 });
  }
  for (const [id, n] of Object.entries(N)) if (visible(n)) scene.node({ ...nodeSpec(id, n, ns[id] || {}), tier: n.tier });
  scene.end(st.dimension === '2');
  updateDiagramScale();
  renderSidebar(); renderStats(); renderPanel(); renderViewOverview(); renderFlowControls(); syncUrl();
}

function renderViewOverview() {
  const info = Views.info(M, st.view);
  const description = st.view === 'cloud' && ENTRY.reference && M.description
    ? `${info.sub}。${M.description}` : info.sub;
  $('view-overview-title').textContent = info.label;
  $('view-overview-description').textContent = description;
}

function renderFlowControls() {
  const bar = $('flow-controls');
  const sc = M.scenarios?.[st.scen];
  bar.hidden = PREVIEW || !sc?.steps?.length;
  if (bar.hidden) return;
  const active = st.mode === 'scenario';
  const play = bar.querySelector('[data-act="flow-play"]');
  play.textContent = active && st.play ? '❚❚ 処理の流れを停止' : '▶ 処理の流れを再生';
  play.setAttribute('aria-pressed', String(active && !!st.play));
  $('flow-position').hidden = !active;
  $('flow-progress').textContent = active ? `${st.step + 1} / ${sc.steps.length}` : '';
  const select = $('flow-scenario');
  if (!select.options.length) for (const [i, scenario] of M.scenarios.entries()) select.add(new Option(scenario.label, String(i)));
  select.value = String(st.scen);
  $('flow-scenario-label').hidden = !active;
  bar.querySelector('[data-step="-1"]').disabled = st.step === 0;
  bar.querySelector('[data-step="1"]').disabled = st.step >= sc.steps.length - 1;
}

/* ================= サイドバー ================= */
function modelLink(entry, label) {
  const selected = entry.id === KEY;
  const marker = entry.design ? '設計案' : entry.local ? 'ローカル' : '';
  const coverage = COV.total ? Math.round(COV.covered / COV.total * 100) : 100;
  const detail = selected && !entry.reference
    ? `<span class="tag ${GATES.pass ? 'ok' : 'high'}">${GATES.pass ? '合格' : '不合格'}</span> 網羅 ${coverage}%` : '';
  const tags = entry.tags || [], sub = entry.reference?.detailOf;
  return `<a href="#/m/${encodeURIComponent(entry.id)}/struct" data-kind="${esc(entry.reference?.kind || '')}" class="mitem ${selected ? 'on' : ''} ${sub ? 'mdetail' : ''}" data-tags="${esc(tags.join('|'))}" title="${esc([entry.name, tags.join('・')].filter(Boolean).join('\n'))}" ${selected ? 'aria-current="page"' : ''}>
    <span class="mname">${sub ? '<span class="mdet" aria-label="詳細図">▸</span>' : ''}${esc(typeof label === 'string' ? label : (selected && M.name) || entry.name || entry.id)}${marker ? ` <small class="loc">${marker}</small>` : ''}</span>
    ${detail ? `<span class="mmeta">${detail}</span>` : ''}</a>`;
}

/* 開いている分類・スクロール位置・絞り込みは再描画しても保つ（切り替えのたびに畳まない） */
const LIB_FILTER = (() => { try { return JSON.parse(sessionStorage.getItem('ddd.libFilter')) || {}; } catch { return {}; } })();
const LIB_TAGS = new Set(Array.isArray(LIB_FILTER.tags) ? LIB_FILTER.tags : []);
const libraryFiltered = () => Boolean($('model-filter').value.trim() || LIB_TAGS.size);
const LIB_SEL = (() => { try { return JSON.parse(sessionStorage.getItem('ddd.libSel')) || {}; } catch { return {}; } })();
const KIND_SHORT = { '製品・技術のアーキテクチャ': '製品', '仕組みの深掘り': '仕組み', '設計パターン・ユースケース': 'パターン' };
const MINE = '__mine';
const LIB_PROD_OPEN = new Set((() => { try { return JSON.parse(sessionStorage.getItem('ddd.libProd')) || []; } catch { return []; } })());
const RAIL_ICONS = {
  'データ処理': '<path d="M4 7h11M4 12h16M4 17h8"/><path d="M15 4l3 3-3 3"/>',
  'データ保存': '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  '分析基盤・DWH': '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  'メタデータ・ガバナンス': '<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="18" cy="16" r="3"/>',
  'AI・新技術': '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  'アプリケーション基盤': '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8h18M8 21h8"/>',
  '車載・エッジ': '<path d="M3 14l2-6h14l2 6v4H3z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  'コンテナ基盤': '<rect x="3" y="7" width="18" height="12" rx="1"/><path d="M7 7V4h10v3M9 11v4M15 11v4"/>',
  '運用基盤': '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  [MINE]: '<path d="M4 20h16M6 16l9-9 3 3-9 9H6z"/>',
};
const railIcon = k => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${RAIL_ICONS[k] || '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>'}</svg>`;
const railLabel = d => ({ 'データ処理': '処理', 'データ保存': '保存', '分析基盤・DWH': '分析', 'メタデータ・ガバナンス': 'メタデータ', 'AI・新技術': 'AI', 'コンテナ基盤': 'コンテナ', '運用基盤': '運用', 'アプリケーション基盤': 'アプリ', '車載・エッジ': '車載' })[d] || d.replace(/基盤$/, '');
function saveLibSel() { try { sessionStorage.setItem('ddd.libSel', JSON.stringify(LIB_SEL)); } catch {} }
function renderLibrary() {
  const panel = $('reference-list'), top = $('lib-scroll').scrollTop;
  const mine = REGISTRY.filter(entry => !entry.reference);
  $('mlist').innerHTML = mine.map(modelLink).join('') + '<button class="b small" data-act="open">＋ YAML を開く</button>';
  $('my-count').textContent = mine.length;

  const refs = REGISTRY.filter(r => r.reference);
  const tree = new Map(); // 領域 → 種別 → 分類 → 項目
  const put = (m, k) => m.get(k) || m.set(k, new Map()).get(k);
  for (const e of refs) {
    const { domain = 'その他', kind = 'その他', category = 'その他' } = e.reference;
    const cat = put(put(tree, domain), kind);
    (cat.get(category) || cat.set(category, []).get(category)).push(e);
  }
  const order = (list, pref) => [...list].sort((a, b) => (pref.indexOf(a[0]) + 1 || 99) - (pref.indexOf(b[0]) + 1 || 99));
  const ord = e => e.reference.order ?? Number.MAX_SAFE_INTEGER;
  const domains = order(tree, REF_DOMAINS);
  // 開いているモデルが変わったら、その分野を表示する
  if (LIB_SEL.key !== KEY) { LIB_SEL.key = KEY; if (ENTRY.reference) LIB_SEL.domain = ENTRY.reference.domain || 'その他'; else if (!LIB_SEL.domain) LIB_SEL.domain = mine.length && !refs.length ? MINE : domains[0]?.[0]; }
  if (LIB_SEL.domain !== MINE && !tree.has(LIB_SEL.domain)) LIB_SEL.domain = domains[0]?.[0] || MINE;
  saveLibSel();

  const count = d => [...d.values()].reduce((n, c) => n + [...c.values()].flat().length, 0);
  const railBtn = (key, label, n) => `<button type="button" class="rail-item ${LIB_SEL.domain === key ? 'on' : ''}" data-lib-domain="${esc(key)}" aria-pressed="${LIB_SEL.domain === key}" title="${esc(key === MINE ? '自分の設計' : key)}（${n}）">${railIcon(key)}<span>${esc(label)}</span></button>`;
  $('lib-rail').innerHTML = domains.map(([d, kinds]) => railBtn(d, railLabel(d), count(kinds))).join('')
    + '<span class="rail-gap"></span>' + railBtn(MINE, '自分の設計', mine.length)
    + '<button type="button" class="rail-item rail-settings" data-act="settings" title="設定" aria-label="設定"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg><span>設定</span></button>';

  const kindIdx = e => e.reference.role === 'overview' ? 0 : e.reference.step != null ? 5e5 + e.reference.step : (REF_KINDS.indexOf(e.reference.kind) + 1 || 9) * 1e6 + Math.min(ord(e), 999999);
  const leaves = list => {
    const sorted = [...list].sort((a, b) => kindIdx(a) - kindIdx(b));
    const top = sorted.filter(e => !e.reference.detailOf || !list.some(p => p.id === e.reference.detailOf));
    return top.flatMap(e => [e, ...sorted.filter(c => c.reference.detailOf === e.id)]);
  };
  const catLink = (domain, cat, n, extra = '') => `<a class="lib-cat-h ${LIB_SEL.cat === domain + '/' + cat ? 'on' : ''}" href="#/c/${encodeURIComponent(domain)}/${encodeURIComponent(cat)}" title="${esc(cat)} の製品一覧を開く"><span>${esc(cat)}${extra}</span><small>${n}</small></a>`;
  panel.innerHTML = domains.map(([domain, kinds]) => {
    const groups = libraryGroups([...kinds.values()].flatMap(c => [...c.values()].flat()));
    const section = (items, concept) => order(items, REF_CATS).map(([cat, list]) => {
      const n = new Set(list.flatMap(g => g.list.map(e => e.id))).size;
      const rows = list.map(g => {
        if (concept) return leaves(g.list).map(e => modelLink(e)).join('');
        const ls = leaves(g.list);
        if (g.all.length === 1) return modelLink(ls[0], g.name);
        const open = LIB_PROD_OPEN.has(g.name) || ls.some(e => e.id === KEY);
        const items = ls.map((e, i) => modelLink(e, (i === 0 ? '概要　' : `${e.reference.step ?? i}. `) + shortName(e.name, g.name))).join('');
        const more = g.all.length - ls.length;
        return `<details class="lib-prod" data-prod="${esc(g.name)}" data-total="${g.all.length}"${open ? ' open' : ''}><summary><span>${esc(g.name)}</span><small>${ls.length}${more ? ` / ${g.all.length}` : ''}</small></summary><div class="mlist">${items}${more ? `<a class="lib-more" href="#/m/${encodeURIComponent(g.overview.id)}/struct" data-prod-all="${esc(g.name)}">ほかの分類の図 ${more} 件</a>` : ''}</div></details>`;
      }).join('');
      return `<div class="lib-cat">${catLink(domain, cat, n)}<div class="mlist">${rows}</div></div>`;
    }).join('');
    return `<div class="lib-domain" data-domain="${esc(domain)}"><h5 class="lib-domain-h">${esc(domain)}</h5>${section(groups.products, false)}${groups.concepts.size ? `<h6 class="lib-section-h">仕組みとパターン</h6>${section(groups.concepts, true)}` : ''}</div>`;
  }).join('');

  const kinds = REF_KINDS.filter(k => domains.some(([, ks]) => ks.has(k)));
  if (LIB_SEL.kind && !kinds.includes(LIB_SEL.kind)) LIB_SEL.kind = '';
  $('lib-kinds').innerHTML = ['', ...kinds].map(k => `<button type="button" class="${(LIB_SEL.kind || '') === k ? 'on' : ''}" data-lib-kind="${esc(k)}" aria-pressed="${(LIB_SEL.kind || '') === k}">${esc(k ? KIND_SHORT[k] || k : 'すべて')}</button>`).join('');
  renderTagFilter();
  $('model-filter').value = LIB_FILTER.query || '';
  filterLibrary();
  const scroller = $('lib-scroll');
  if (scroller && top != null) scroller.scrollTop = top;
  const cur = $('library').querySelector('.mitem.on:not([hidden])');
  if (cur && scroller) { const r = cur.getBoundingClientRect(), a = scroller.getBoundingClientRect(); if (r.top < a.top + 140 || r.bottom > a.bottom) cur.scrollIntoView({ block: 'center' }); }
}
function libraryGroups(all) {
  const byId = new Map(all.map(e => [e.id, e]));
  const root = e => { let r = e, seen = 0; while (r.reference.detailOf && byId.has(r.reference.detailOf) && seen++ < 5) r = byId.get(r.reference.detailOf); return r; };
  const concepts = new Map(), prods = new Map();
  for (const e of all) {
    const r = root(e);
    if (e.reference.role === 'concept' || (!e.reference.product && isConcept(r))) {
      const cat = e.reference.category || 'その他', c = concepts.get(cat) || concepts.set(cat, [{ name: cat, list: [] }]).get(cat);
      c[0].list.push(e); continue;
    }
    const name = e.reference.product || productOf(e.id) || productName(r);
    (prods.get(name) || prods.set(name, []).get(name)).push(e);
  }
  const products = new Map();
  for (const [name, list] of prods) {
    const ordered = [...list].sort((a, b) => (a.reference.role === 'overview' ? -1 : 0) - (b.reference.role === 'overview' ? -1 : 0) || (a.reference.detailOf ? 1 : 0) - (b.reference.detailOf ? 1 : 0) || (REF_KINDS.indexOf(a.reference.kind) - REF_KINDS.indexOf(b.reference.kind)) || ((a.reference.order ?? 1e9) - (b.reference.order ?? 1e9)));
    const overview = ordered[0];
    // 追加で載せる分類は、同じ分野にあるものだけ（分野をまたいで紛れ込ませない）
    const domain = overview.reference.domain || 'その他';
    const also = [...(PRODUCT_ALSO[name] || []), ...list.flatMap(e => e.reference.also || [])].filter(c => REGISTRY.some(r => r.reference?.category === c && (r.reference.domain || 'その他') === domain));
    const cats = new Set([...list.map(e => e.reference.category || 'その他'), ...also]);
    for (const cat of cats) {
      // その分類では、概要の図と、その分類に属する図だけを見せる
      const here = list.filter(e => e === overview || (e.reference.category || 'その他') === cat);
      (products.get(cat) || products.set(cat, []).get(cat)).push({ name, list: here, all: list, overview });
    }
  }
  for (const list of products.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return { products, concepts };
}
let CAT_INDEX = null;
async function researchIndex() {
  if (!CAT_INDEX) CAT_INDEX = fetch('models/research-index.json', { cache: 'no-cache' }).then(r => r.json()).then(d => new Map((d.entries || []).map(e => [e.id, e]))).catch(() => new Map());
  return CAT_INDEX;
}
let OSS_STATS;
function ossStats() {
  if (!OSS_STATS) OSS_STATS = fetch('models/oss-stats.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
  return OSS_STATS;
}
const compactCount = n => n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/.0$/, '') + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
function ossFacts(stats, product) {
  const s = stats?.products?.[product]; if (!s) return '';
  const rel = r => r ? `${esc(r.tag)}（${esc(r.date)}）` : '';
  const rows = [
    ['スター', '★ ' + s.stars.toLocaleString('en-US')], ['フォーク', s.forks.toLocaleString('en-US')], ['ライセンス', s.license ? esc(s.license) : ''],
    ['最新リリース', rel(s.latest) || 'GitHub のリリース機能は未使用（タグで管理）'], ['GitHub 上の最初のリリース', rel(s.first)], ['最終更新', esc(s.pushedAt)],
  ].filter(r => r[1]);
  return `<section class="ps-oss"><h4>GitHub リポジトリ <small>${esc(stats.fetchedAt)} 時点</small></h4><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <p class="ps-links"><a href="https://github.com/${esc(s.repo)}" target="_blank" rel="noopener noreferrer">GitHub（${esc(s.repo)}）</a><a href="https://ossinsight.io/analyze/${esc(s.repo)}" target="_blank" rel="noopener noreferrer">OSS Insight</a></p>
    <p class="ps-note">「最初のリリース」は GitHub のリリース機能に登録された最古のもので、実際の初版より新しい場合がある。</p></section>`;
}
const thumbObserver = new IntersectionObserver(items => {
  for (const it of items) {
    if (!it.isIntersecting) continue;
    thumbObserver.unobserve(it.target);
    fetch(`models/${encodeURIComponent(it.target.dataset.modelId)}/model.yaml`, { cache: 'no-cache' }).then(r => r.text())
      .then(raw => { it.target.textContent = ''; drawThumbnail(it.target, Layout.apply(jsyaml.load(raw))); })
      .catch(() => { it.target.textContent = 'プレビューなし'; });
  }
}, { rootMargin: '150px' });
async function showCategoryPage({ domain, category }) {
  document.body.classList.add('cat-mode');
  LIB_SEL.cat = domain + '/' + category; LIB_SEL.domain = domain; saveLibSel(); renderLibrary();
  const page = $('cat-page'), idx = await researchIndex();
  const refs = REGISTRY.filter(r => r.reference && (r.reference.domain || 'その他') === domain);
  const { products, concepts } = libraryGroups(refs);
  const prods = products.get(category) || [], cons = concepts.get(category) || [];
  const delivery = e => (e.tags || []).find(t => DELIVERY.includes(t)) || '';
  const stats = await ossStats();
  const card = (e, title, n) => {
    const info = idx.get(e.id) || {}, st = stats?.products?.[title];
    return `<a class="cat-card" href="#/m/${encodeURIComponent(e.id)}/struct"><div class="cat-card-title"><h3>${esc(title)}</h3><p>${esc(info.description || '')}</p></div><div class="cat-thumb" data-model-id="${esc(e.id)}" aria-hidden="true">構成図を読み込み中…</div><div class="cat-card-meta">${delivery(e) ? `<span class="mtag mini ${TAG_KIND(delivery(e))}">${esc(delivery(e))}</span>` : ''}<span>図 ${n}</span>${st ? `<span class="cat-star" title="GitHub スター数（${esc(stats.fetchedAt)} 時点）">★ ${compactCount(st.stars)}</span>` : ''}<span class="cat-open">開く →</span></div></a>`;
  };
  let sortKey = 'stars'; try { sortKey = sessionStorage.getItem('ddd.catSort') || 'stars'; } catch {}
  const productCards = () => {
    const stars = g => stats?.products?.[g.name]?.stars ?? -1;
    const list = sortKey === 'stars' ? [...prods].sort((x, y) => stars(y) - stars(x)) : prods;
    return list.map(g => card(g.overview, g.name, g.list.length === g.all.length ? g.all.length : `${g.list.length}（全 ${g.all.length}）`)).join('');
  };
  const first = g => [...g.list].sort((a, b) => (a.reference.detailOf ? 1 : 0) - (b.reference.detailOf ? 1 : 0) || (REF_KINDS.indexOf(a.reference.kind) - REF_KINDS.indexOf(b.reference.kind)) || ((a.reference.order ?? 1e9) - (b.reference.order ?? 1e9)))[0];
  page.innerHTML = `<div class="cat-inner"><p class="cat-eyebrow">${esc(domain)}</p><h1>${esc(category)}</h1><p class="cat-lead">${esc(CATEGORY_INFO[category] || '')}</p>
    ${prods.length ? `<div class="cat-sort-head"><h2>製品 <small>${prods.length}</small></h2>${prods.some(g => stats?.products?.[g.name]) ? `<label class="cat-sort">並び順<select id="cat-sort"><option value="stars">GitHub スター数の順</option><option value="default">既定順</option></select></label>` : ''}</div><div class="cat-grid" id="cat-products">${productCards()}</div>` : ''}
    ${cons.length ? `<h2>仕組みとパターン <small>${cons.reduce((s, g) => s + g.list.length, 0)}</small></h2><div class="cat-grid">${cons.flatMap(g => g.list).map(e => card(e, e.name, 1)).join('')}</div>` : ''}
    <section id="cat-compare" class="cat-compare" hidden></section>
    ${!prods.length && !cons.length ? '<p class="sub">この分類にはまだ図がありません。</p>' : ''}</div>`;
  const sortSel = $('cat-sort');
  if (sortSel) {
    sortSel.value = sortKey; enhanceSelect(sortSel);
    sortSel.addEventListener('change', () => {
      sortKey = sortSel.value; try { sessionStorage.setItem('ddd.catSort', sortKey); } catch {}
      $('cat-products').innerHTML = productCards(); $('cat-products').querySelectorAll('.cat-thumb').forEach(t => thumbObserver.observe(t));
    });
  }
  page.hidden = false; page.scrollTop = 0;
  page.querySelectorAll('.cat-thumb').forEach(t => thumbObserver.observe(t));
  loadCategoryCompare(category);
  document.title = `${category} — DeepDiverDown`;
  // ヘッダーの題名も分類ページに合わせる（裏で読み込んだ図の名前を出さない）
  $('mtitle').textContent = `${domain} › ${category}`; $('mparent').hidden = true;
  if (matchMedia('(max-width:1279px)').matches) document.body.classList.remove('nav-open');
}
/* 製品の特徴ポップアップ：分類ページの製品カードと「違い」の表・選び方を、この製品の分だけ取り出して見せる */
function productGroupOf(entry) {
  const ref = entry?.reference; if (!ref) return null;
  const domain = ref.domain || 'その他';
  const { products } = libraryGroups(REGISTRY.filter(r => r.reference && (r.reference.domain || 'その他') === domain));
  const order = [ref.category, ...products.keys()];
  for (const category of order) for (const group of products.get(category) || []) if (group.all.some(e => e.id === entry.id)) return { category, group };
  return null;
}
function productFromCompare(md, name) {
  const lines = md.replace(/\r/g, '').split('\n'), norm = t => t.replace(/\*\*/g, '').replace(/\s+/g, '').toLowerCase();
  const rows = lines.filter(l => /^\|/.test(l) && !/^[|\s:-]+$/.test(l)).map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
  if (rows.length < 2) return { features: [], choose: '' };
  const head = rows[0], key = norm(name);
  const col = head.findIndex((h, k) => k && (norm(h) === key || norm(h).includes(key) || key.includes(norm(h))));
  if (col < 0) return { features: [], choose: '' };
  const features = rows.slice(1).map(r => [r[0], r[col] || '']).filter(([, v]) => v);
  const at = lines.findIndex(l => /^##\s*選び方/.test(l));
  const choose = at < 0 ? '' : lines.slice(at + 1).find(l => /^- /.test(l) && l.includes(`**${head[col]}**`) && l.includes('→'))?.slice(2).split('→')[0].trim() || '';
  return { features, choose };
}
async function openProductSummary() {
  const hit = productGroupOf(ENTRY); if (!hit) return;
  const { category, group } = hit, idx = await researchIndex();
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const description = idx.get(group.overview.id)?.description || '', oss = ossFacts(await ossStats(), group.name);
  let features = [], choose = '';
  const slug = CATEGORY_DOCS[category];
  if (slug) { try { const r = await fetch(`docs/category-${slug}.md`, { cache: 'no-cache' }); if (r.ok) ({ features, choose } = productFromCompare(await r.text(), group.name)); } catch { /* 比較表がなくても概要は出す */ } }
  const figures = [...group.all].sort((a, b) => (a.reference.role === 'overview' ? -1 : 0) - (b.reference.role === 'overview' ? -1 : 0) || (a.reference.step ?? 99) - (b.reference.step ?? 99));
  const catHref = '#/c/' + encodeURIComponent(group.overview.reference.domain || 'その他') + '/' + encodeURIComponent(category);
  modal(group.name, `<div class="product-summary">
    ${description ? `<p class="ps-lead">${esc(description)}</p>` : ''}
    ${oss}
    ${features.length ? `<h4>観点別の特徴</h4><dl class="ps-features">${features.map(([k, v]) => `<dt>${inline(k)}</dt><dd>${inline(v)}</dd>`).join('')}</dl>` : ''}
    ${choose ? `<h4>こんなときに選ぶ</h4><p>${inline(choose)}</p>` : ''}
    <h4>この製品の図 <small>${figures.length}</small></h4>
    <ul class="ps-figures">${figures.map(e => `<li${e.id === KEY ? ' class="on"' : ''}><a href="#/m/${encodeURIComponent(e.id)}/struct">${e.reference.role === 'overview' ? '概要　' : e.reference.step ? e.reference.step + '. ' : ''}${esc(e.name)}</a></li>`).join('')}</ul>
    <p class="ps-more"><a href="${catHref}">「${esc(category)}」で、ほかの製品と比べる →</a></p>
  </div>`);
}
function miniMarkdown(md) {
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\[([^\]]+)\]\(index\.html#\/m\/([a-z0-9-]+)\/struct\)/g, '<a href="#/m/$2/struct">$1</a>');
  const out = [], lines = md.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^#\s/.test(l)) continue; // 先頭の題名は分類ページの見出しと重なる
    if (/^#{2,3}\s/.test(l)) { out.push(`<h3>${inline(l.replace(/^#+\s*/, ''))}</h3>`); continue; }
    if (/^\|/.test(l)) {
      const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]); i--;
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const body = rows.filter((r, k) => k !== 1 || !/^[|\s:-]+$/.test(r));
      out.push(`<div class="cat-table-wrap"><table class="cat-table"><thead><tr>${cells(body[0]).map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.slice(1).map(r => `<tr>${cells(r).map((c, k) => k ? `<td>${inline(c)}</td>` : `<th scope="row">${inline(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^- /.test(l)) { const items = []; while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2)); i--; out.push(`<ul>${items.map(t => `<li>${inline(t)}</li>`).join('')}</ul>`); continue; }
    if (l.trim()) out.push(`<p>${inline(l)}</p>`);
  }
  return out.join('');
}
async function loadCategoryCompare(category) {
  const slug = CATEGORY_DOCS[category], box = $('cat-compare');
  if (!slug || !box) return;
  try {
    const r = await fetch(`docs/category-${slug}.md`, { cache: 'no-cache' });
    if (!r.ok) return;
    box.innerHTML = `<h2>違い</h2>${miniMarkdown(await r.text())}`;
    box.hidden = false;
  } catch {}
}
function hideCategoryPage() {
  if (!document.body.classList.contains('cat-mode')) return;
  document.body.classList.remove('cat-mode'); $('cat-page').hidden = true;
  delete LIB_SEL.cat; saveLibSel(); renderLibrary();
  document.title = `${M.name} — DeepDiverDown`;
  $('mtitle').textContent = M.name; $('mparent').hidden = !$('mparent').getAttribute('href');
}
function selectLibDomain(d) { LIB_SEL.domain = d; saveLibSel(); $('lib-scroll').scrollTop = 0; renderLibrary(); }
function selectLibKind(k) { LIB_SEL.kind = k; saveLibSel(); renderLibrary(); }
function updateLibraryFilter() {
  try { sessionStorage.setItem('ddd.libFilter', JSON.stringify({ query: $('model-filter').value, tags: [...LIB_TAGS] })); } catch {}
  filterLibrary();
}

/* モデル一覧の絞り込み：一致したモデルのある分類だけ開く */
function filterLibrary() {
  const s = $('model-filter').value.trim().toLowerCase(), tags = [...LIB_TAGS];
  const active = libraryFiltered(), mineSel = LIB_SEL.domain === MINE;
  document.querySelectorAll('#library .mitem').forEach(a => {
    const own = (a.dataset.tags || '').split('|');
    const match = !s || (a.textContent + ' ' + (a.title || '')).toLowerCase().includes(s) || own.some(t => t.toLowerCase().includes(s));
    a.hidden = !match || !tags.every(t => own.includes(t));
  });
  // 検索・絞り込み中はすべての分野から探す。そうでなければ選んだ分野と種類だけ
  if (LIB_SEL.kind) document.querySelectorAll('#reference-list .mitem').forEach(a => { if (a.dataset.kind !== LIB_SEL.kind) a.hidden = true; });
  document.querySelectorAll('#reference-list .lib-prod').forEach(p => {
    p.hidden = !p.querySelector('.mitem:not([hidden])');
    if (active) p.open = !p.hidden; else p.open = LIB_PROD_OPEN.has(p.dataset.prod) || Boolean(p.querySelector('.mitem.on'));
    const n = p.querySelectorAll('.mitem:not([hidden])').length, total = +p.dataset.total; p.querySelector('summary small').textContent = total > n ? `${n} / ${total}` : n;
  });
  document.querySelectorAll('#reference-list .lib-cat').forEach(c => { c.hidden = !c.querySelector('.mitem:not([hidden])'); });
  document.querySelectorAll('#reference-list .lib-domain').forEach(d => {
    d.hidden = (!active && d.dataset.domain !== LIB_SEL.domain) || (mineSel && !active) || !d.querySelector('.mitem:not([hidden])');
    d.classList.toggle('show-h', active);
  });
  $('my-models').hidden = !(mineSel || (active && $('mlist').querySelector('.mitem:not([hidden])')));
  $('lib-domain-name').textContent = mineSel ? '自分の設計' : active ? '検索結果' : (LIB_SEL.domain || 'モデル一覧');
  const n = new Set([...document.querySelectorAll('#library .lib-domain:not([hidden]) .mitem:not([hidden]), #my-models:not([hidden]) .mitem:not([hidden])')].map(a => a.getAttribute('href'))).size;
  $('lib-domain-count').textContent = n;
  const empty = !n;
  let note = $('reference-list').querySelector('.lib-empty');
  if (empty && !note) $('reference-list').insertAdjacentHTML('beforeend', '<p class="lib-empty sub">該当するモデルはありません</p>');
  else if (!empty && note) note.remove();
  if ($('tag-count')) $('tag-count').textContent = '';
  // 使っている絞り込み条件だけを検索欄の下に小さく出す
  const conds = [...(LIB_SEL.kind ? [[KIND_SHORT[LIB_SEL.kind] || LIB_SEL.kind, 'data-lib-kind=""']] : []), ...tags.map(t => [t, `data-tag="${esc(t)}"`])];
  $('lib-filter-n').hidden = !conds.length; $('lib-filter-n').textContent = conds.length;
  $('lib-active').hidden = !conds.length;
  $('lib-active').innerHTML = conds.map(([label, attr]) => `<button type="button" class="lib-cond" ${attr} aria-label="${esc(label)} の条件を外す">${esc(label)} <span aria-hidden="true">×</span></button>`).join('');
}
/* ラベル（提供形態・提供元）で絞り込む。複数選ぶとすべてを持つものだけ */
const REF_DOMAINS = ['データ処理', 'データ保存', '分析基盤・DWH', 'メタデータ・ガバナンス', 'AI・新技術', 'コンテナ基盤', '運用基盤', 'アプリケーション基盤', '車載・エッジ'];
const REF_CATS = [
  '取り込み', 'ストリーム処理', 'バッチ・SQL エンジン', 'テーブル形式とカタログ', 'データカタログ',
  '変換とオーケストレーション', 'クラウド分析基盤', '運用とガバナンス', 'データ配置と読み取り',
  'ファイル形式', '分散実行と保守', 'DWH 設計パターン', '構成パターン', 'ユースケース',
  'Kubernetes 系', 'マネージド Kubernetes', 'その他のオーケストレーター', '分散合意',
  'ネットワークとポリシー', 'GitOps と継続的デリバリー',
  'オブザーバビリティ', 'ポリシーとガバナンス', 'ワークフロー実行', '比較と選び方',
];
const REF_KINDS = ['製品・技術のアーキテクチャ', '仕組みの深掘り', '設計パターン・ユースケース'];
const DELIVERY = ['OSS', '商用サービス', 'クラウドマネージド', '商用製品', 'ソース公開（BSL）', '商用サービスあり', '仕様', '概念', 'パターン'];
const TAG_KIND = t => DELIVERY.includes(t) ? 'tk-' + ({ OSS: 'oss', 商用サービス: 'saas', クラウドマネージド: 'cloud', 商用製品: 'prod', 'ソース公開（BSL）': 'src', 商用サービスあり: 'saas2', 仕様: 'spec', 概念: 'idea', パターン: 'idea' })[t] : 'tk-org';
function renderTagFilter() {
  const count = new Map();
  for (const e of REGISTRY) for (const t of e.tags || []) count.set(t, (count.get(t) || 0) + 1);
  const chip = t => `<button type="button" class="mtag ${TAG_KIND(t)} ${LIB_TAGS.has(t) ? 'on' : ''}" data-tag="${esc(t)}" aria-pressed="${LIB_TAGS.has(t)}">${esc(t)} <small>${count.get(t)}</small></button>`;
  const delivery = DELIVERY.filter(t => count.has(t)), orgs = [...count.keys()].filter(t => !DELIVERY.includes(t)).sort((a, b) => count.get(b) - count.get(a) || a.localeCompare(b));
  const main = ['OSS', '商用サービス', 'クラウドマネージド', '概念', 'パターン'].filter(t => count.has(t));
  const more = [...delivery.filter(t => !main.includes(t)), ...orgs];
  const extra = [...delivery.filter(t => !main.includes(t)), ...orgs].filter(t => LIB_TAGS.has(t));
  $('tag-filter').innerHTML = `<div class="tf-row">${[...main, ...extra].map(chip).join('')}</div>`;
  $('tag-filter').insertAdjacentHTML('beforeend', `
    ${LIB_TAGS.size ? '<button type="button" class="b small" data-tag-clear>ラベルを解除</button>' : ''}<span id="tag-count" class="tf-count"></span>`);
}
function toggleTag(t, only = false) {
  if (only) { LIB_TAGS.clear(); LIB_TAGS.add(t); } else LIB_TAGS.has(t) ? LIB_TAGS.delete(t) : LIB_TAGS.add(t);
  renderTagFilter(); updateLibraryFilter();
}
/* モデルを選ぶ（Ctrl+K・ヘッダーのモデル名）：サイドバーのモデル一覧を開いて絞り込み欄へ */
function pickModel() {
  if (matchMedia('(max-width:1279px)').matches) document.body.classList.add('nav-open');
  else document.body.classList.remove('nav-closed');
  $('model-filter').focus();
  $('model-filter').select();
}

function renderSidebar() {
  /* 図の表示（構成図のツールバーのプルダウン）：ビュー・モード・フロアなど */
  $('modes').innerHTML = MODES.map(([k, n, count], i) => {
    const c = k === 'compare' ? CMPR?.changes.length : count;
    return `<button role="menuitemradio" aria-checked="${st.mode === k}" data-mode="${k}" class="${st.mode === k ? 'on' : ''}" title="${n}（${i + 1}）"><span>${n}<kbd>${i + 1}</kbd></span>${c ? `<small>${c}</small>` : ''}</button>`;
  }).join('');
  $('mode-cur').textContent = MODES.find(([k]) => k === st.mode)?.[1] || '';
  $('views').innerHTML = VIEWS.map(v => { const vi = Views.info(M, v); return `<button role="menuitemradio" aria-checked="${st.view === v}" data-viewmode="${esc(v)}" class="${st.view === v ? 'on' : ''}" title="${esc(vi.label)}（${esc(vi.sub)}）・V キーで切替"><b>${esc(vi.label)}</b><small>${esc(vi.sub)}</small></button>`; }).join('');
  $('view-cur').textContent = Views.info(M, st.view).short;
  $('views').closest('.tb-menu').hidden = VIEWS.length < 2; // 切り替える先がなければ出さない
  const tiers = VW().tiers;
  const levels = new Set([...diagramLayout().floors.values()].map(f => f.level));
  $('spread-floors').closest('label').hidden = st.dimension === '2' || levels.size < 2;
  $('floors').innerHTML = tiers.map(t => `<label><input type="checkbox" data-tier="${esc(t.id)}" ${st.hidden.has(t.id) ? '' : 'checked'}> ${esc(t.label)}</label>`).join('');
  const hiddenN = tiers.filter(t => st.hidden.has(t.id)).length;
  $('opts-cur').textContent = [hiddenN ? `${hiddenN} フロア非表示` : '', st.nbr && st.sel ? '周辺のみ' : ''].filter(Boolean).join('・');
  $('nbr').checked = st.nbr;
  $('nbr').disabled = !st.sel;
  $('minimap').checked = st.minimap;
}

/* 凡例：線の意味 + このモデルに登場するクラウド・枠の種類 */
function contextLegend() {
  const { nodes, groups } = VW();
  const state = legendCurrent();
  const provs = [...new Set([...Object.values(nodes).map(n => Catalog.providerOf(n)), ...groups.map(g => g.provider)].filter(p => Object.hasOwn(Catalog.PROVIDERS, p)))];
  const kinds = [...new Set(groups.map(g => g.kind))];
  const KIND = { cloud: 'クラウド', region: 'リージョン', vpc: 'VPC', vnet: 'VNet', vcn: 'VCN', az: 'AZ', subnet: 'サブネット', cluster: 'クラスタ', namespace: 'Namespace', nodegroup: '実行ノード', datacenter: 'データセンター', parallel: '並列に実行' };
  const providerButtons = provs.map(p => {
    const label = esc(Catalog.PROVIDERS[p].label), marker = `<b class="sw" style="background:${Catalog.PROVIDERS[p].color}"></b>`;
    if (!groups.some(g => ['cloud', 'datacenter'].includes(g.kind) && g.provider === p)) return `<span>${marker}${label}</span>`;
    return `<button type="button" class="legend-toggle" data-legend-provider="${esc(p)}" aria-pressed="${state.clouds && !state.hiddenProviders.includes(p)}" aria-label="${label} の領域" title="${label} の領域を表示・非表示"${state.clouds ? '' : ' disabled'}>${marker}${label}</button>`;
  }).join('');
  return (provs.length ? '<span class="lg-sep" aria-hidden="true"></span>' + providerButtons : '') +
    (kinds.length ? '<span class="lg-sep" aria-hidden="true"></span>' + kinds.map(k => {
      const label = esc(KIND[k] || k), marker = `<b class="fr fr-${esc(k)}"></b>`;
      if (k === 'cloud' || k === 'datacenter') return `<span>${marker}${label}</span>`;
      return `<button type="button" class="legend-toggle" data-legend-kind="${esc(k)}" aria-pressed="${!state.hiddenKinds.includes(k)}" aria-label="${label} の境界" title="${label} の境界を表示・非表示">${marker}${label}</button>`;
    }).join('') : '');
}

function visibilityLegend() {
  const s = legendCurrent(), groups = VW().groups || [], timings = new Set(VW().links.map(linkTiming));
  const button = (key, label, title) => `<button type="button" class="legend-toggle" data-legend-toggle="${key}" aria-pressed="${s[key]}" title="${title}">${label}</button>`;
  return '<span class="lg-sep" aria-hidden="true"></span><span>表示：</span>' +
    button('labels', '部品名', '部品名を表示・非表示。選択中やホバー中は表示します') +
    ((st.dimension !== '2' || VW().platform2D) && Object.values(VW().nodes).some(n => n.management?.type) ? button('management', '管理区分', '管理区分バッジを表示・非表示') : '') +
    (groups.some(g => ['cloud', 'datacenter'].includes(g.kind)) ? button('clouds', 'クラウド領域', 'クラウドとデータセンターの領域を表示・非表示') : '') +
    (timings.has(true) ? button('sync', '<i></i>同期', '同期の接続を表示・非表示。種別未指定の接続は常に表示') : '') +
    (timings.has(false) ? button('async', '<i class="dash"></i>非同期', '非同期の接続を表示・非表示。種別未指定の接続は常に表示') : '') +
    `<button type="button" class="legend-toggle" data-legend-toggle="minimap" aria-pressed="${st.minimap}" title="ミニマップを表示・非表示">ミニマップ</button>` +
    '<button type="button" class="legend-toggle" data-legend-toggle="reset" title="表示設定を初期状態に戻す">すべて表示</button>';
}

/* ================= 統計・凡例 ================= */
const stat = (lab, v, bad, action) => {
  const body = `<small>${esc(lab)}</small><b>${esc(v)}</b>`;
  const cls = `stat${bad ? ' bad' : ''}`;
  return action ? `<button type="button" class="${cls} stat-action" data-act="${action}">${body}<span aria-hidden="true">↗</span></button>` : `<div class="${cls}">${body}</div>`;
};
const count = (o, s) => Object.values(o).filter(r => r.status === s).length;
function renderStats() {
  document.querySelector('.stage').classList.toggle('scenario-active', st.mode === 'scenario');
  let h = '';
  if (st.mode === 'struct') h = stat('ノード', Object.keys(M.nodes).length) + stat('同期 / 非同期', `${M.links.filter(l => l.sync).length} / ${M.links.filter(l => !l.sync).length}`) + stat('指摘', ISSUES.length, ISSUES.length, 'review-issues') + stat('点検', GATES.pass ? '合格' : '不合格', !GATES.pass, 'review-gates');
  if (st.mode === 'struct' && ENTRY.reference) {
    const { nodes, links } = VW();
    h = stat('構成部品', Object.keys(nodes).length) + stat('接続', links.length);
  }
  if (st.mode === 'scenario' && M.scenarios?.length) { const sc = M.scenarios[st.scen], p = syncP95(sc); h = stat('シナリオ', sc.label) + stat('ステップ', `${st.step + 1} / ${sc.steps.length}`) + (PIPE || ENTRY.reference ? '' : stat('同期経路 p95 合計', `${p} ms`, p > 1000)); }
  if (st.mode === 'fail') { const r = Analyze.impact(M, st.down); h = stat('停止', st.down.length, st.down.length) + stat('影響', r.impacted.length, r.impacted.length) + stat('滞留', r.delayed.length) + stat('止まるシナリオ', `${r.brokenScenarios.length} / ${M.scenarios?.length || 0}`, r.brokenScenarios.length); }
  if (st.mode === 'lint') h = stat('重大', ISSUES.filter(i => i.sev === 'high').length, 1) + stat('注意', ISSUES.filter(i => i.sev === 'mid').length) + stat('無効にしたルール', S.disabledRules.length);
  if (st.mode === 'metric') { const vs = Object.values(M.nodes).map(n => n.metrics?.[st.metric]).filter(v => v != null), sum = ['cost', 'duration'].includes(st.metric); h = stat('指標', METRICS.find(x => x[0] === st.metric)[1]) + (vs.length ? stat(sum ? '合計' : '最大', fmt(st.metric, sum ? vs.reduce((a, b) => a + b, 0) : Math.max(...vs))) : ''); }
  if (st.mode === 'evidence') { const all = { ...CLS.nodes, ...CLS.links }; h = stat('事実', count(all, 'fact')) + stat('主張', count(all, 'claim')) + stat('不明', count(all, 'unknown'), count(all, 'unknown')) + stat('ずれ', CLS.drifts.length, CLS.drifts.length) + stat('網羅率', `${COV.total ? Math.round(COV.covered / COV.total * 100) : 100}%`, COV.covered < COV.total); }
  if (st.mode === 'req') h = Object.entries(REQ_KIND).map(([k, n]) => stat(n, M.requirements.filter(q => q.kind === k).length)).join('');
  if (st.mode === 'compare') h = CMPR ? stat('比較対象', CMP.label) + ['added', 'removed', 'changed'].map(k => stat({ added: '追加', removed: '削除', changed: '変更' }[k], CMPR.changes.filter(c => c.kind === k).length)).join('') : stat('比較対象', 'なし');
  $('stats').innerHTML = h;
  const leg = {
    evidence: '<span><i></i>事実（実装で確認）</span><span><i class="dash"></i>主張（設計書のみ）</span><span><i class="dot warn"></i>不明</span><span><i class="acc"></i>ずれ</span>',
    compare: '<span><i class="ok"></i>追加</span><span><i class="dash acc"></i>削除</span><span><i class="warn"></i>変更</span>',
    fail: '<span><i class="acc"></i>失敗する呼び出し</span>',
  };
  const current = st.mode === 'scenario' ? M.scenarios?.[st.scen]?.steps[st.step]?.links || [] : [];
  const ids = new Set(st.edge ? [st.edge] : current);
  const projection = VW();
  const active = ids.size ? projection.links.filter(l => showLink(linkTiming(l), legendCurrent()) && visible(projection.nodes[l.from]) && visible(projection.nodes[l.to]) &&
    (ids.has(l.id) || projection.linkFrom[l.id]?.some(id => ids.has(id)))) : [];
  const first = active.find(l => l.id === st.edge) || active[0];
  const caption = first ? `<span class="route-caption"><strong>${esc(edgeAction(first))}</strong> · ${esc(projection.nodes[first.from].label)} → ${esc(projection.nodes[first.to].label)}${timingLabel(first) ? ' · ' + timingLabel(first) : ''}${active.length > 1 ? `（ほか${active.length - 1}接続）` : ''}</span>` : '';
  $('legend').classList.toggle('edge-selected', !!(st.edge && caption));
  $('legend').innerHTML = caption + (ENTRY.reference ? (caption ? '' : '<span>矢印を選ぶと処理内容を表示します</span>') : leg[st.mode] || '') + contextLegend() + visibilityLegend();
}
$('legend').addEventListener('click', event => {
  const button = event.target.closest('[data-legend-toggle], [data-legend-provider], [data-legend-kind]');
  if (!button) return;
  const state = legendCurrent(), key = button.dataset.legendToggle, provider = button.dataset.legendProvider, kind = button.dataset.legendKind;
  if (provider) {
    state.hiddenProviders = state.hiddenProviders.includes(provider) ? state.hiddenProviders.filter(p => p !== provider) : [...state.hiddenProviders, provider];
  } else if (kind) {
    state.hiddenKinds = state.hiddenKinds.includes(kind) ? state.hiddenKinds.filter(k => k !== kind) : [...state.hiddenKinds, kind];
  } else if (key === 'reset') {
    legendVisibility[st.dimension] = legendState();
    setMinimapPreference(true);
  } else if (key === 'minimap') setMinimapPreference(!st.minimap);
  else if (['labels', 'management', 'clouds', 'sync', 'async'].includes(key)) state[key] = !state[key];
  if (st.edge && (key === 'sync' || key === 'async')) {
    const projection = VW(), selected = projection.links.filter(l => l.id === st.edge || projection.linkFrom[l.id]?.includes(st.edge));
    if (selected.length && selected.every(l => !showLink(linkTiming(l), legendCurrent()))) st.edge = null;
  }
  S.legendVisibility = legendVisibility;
  saveSettings(S);
  draw();
  const selector = provider ? '[data-legend-provider]' : kind ? '[data-legend-kind]' : '[data-legend-toggle]';
  [...$('legend').querySelectorAll(selector)].find(b => provider ? b.dataset.legendProvider === provider : kind ? b.dataset.legendKind === kind : b.dataset.legendToggle === key)?.focus();
});
function syncP95(sc) {
  const ids = new Set(sc.steps.flatMap(s => s.links).map(linkById).filter(l => l?.sync).map(l => l.to));
  return [...ids].reduce((s, id) => s + (M.nodes[id].metrics?.p95 || 0), 0);
}

/* ================= パネル ================= */
const tag = s => `<span class="tag st-${esc(s)}">${esc(Analyze.STATUS[s])}</span>`;
function evidenceRef(ref, label = ref) {
  return ref ? `<button type="button" class="review-link" data-ref="${esc(ref)}">${esc(label)}</button>` : esc(label || '');
}
const evList = ev => (ev || []).map(e => `<div class="ev"><span class="mono">${esc(e.type)}</span> ${evidenceRef(e.ref, e.at || e.ref)}${e.quote ? `<blockquote>${esc(e.quote)}</blockquote>` : ''}${e.says ? ` <span class="mono acc-t">says ${esc(JSON.stringify(e.says))}</span>` : ''}</div>`).join('') || '<div class="sub">根拠なし</div>';
const none = '<div class="sub">なし</div>';
const itemButton = (attr, value, html, active = false) => `<button type="button" class="item review-item${active ? ' on' : ''}" data-${attr}="${esc(value)}"${active ? ' aria-current="true"' : ''}>${html}</button>`;
const relatedIssues = (nodes, links) => ISSUES.map((i, k) => ({ i, k })).filter(({ i }) =>
  i.nodes?.some(n => nodes.includes(n)) || i.links?.some(l => links.includes(l)));
const issueContent = i => `<span class="tag ${esc(i.sev)}">${esc(i.title)}</span><span class="review-message">${esc(i.msg)}</span>`;
const issueDetails = issues => issues.length ? '<h4>関連する指摘</h4>' + issues.map(({ i, k }) => itemButton('issue', k, issueContent(i))).join('') : '';

function findingContext(issue) {
  const nodes = (issue.nodes || []).filter(id => M.nodes[id]);
  const links = (issue.links || []).map(linkById).filter(Boolean);
  const sources = new Set([...nodes.map(id => M.nodes[id]), ...links].flatMap(part =>
    (part.evidence || []).map(e => e.ref).filter(Boolean)));
  return `<div class="finding-context"><div class="row">
    ${nodes.map(id => `<button class="b small" data-sel="${esc(id)}">${esc(M.nodes[id].label)}</button>`).join('')}
    ${links.map(l => `<button class="b small" data-edge="${esc(l.id)}">${esc(linkLabel(l))}</button>`).join('')}</div>
    ${sources.size ? '<h4>関連する根拠</h4>' + [...sources].map(ref => `<div>${evidenceRef(ref)}</div>`).join('') : ''}
    <button class="b small" data-act="assist-finding">AI に対応を相談</button></div>`;
}

function mentionsName(text, name) {
  if (!name) return false;
  const literal = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\w-])${literal}(?:$|[^\\w-])`).test(text);
}
function reviewMemos() {
  if (!M.review?.length) return '';
  return '<h4>抽出時のレビューメモ</h4>' + M.review.map(memo => {
    const sections = [...new Set(memo.match(/§\d+(?:\.\d+)*/g) || [])];
    const refs = sections.flatMap(section => Object.entries(DOCS).filter(([, entries]) =>
      entries.some(entry => entry.id === section)).map(([file]) => evidenceRef(`${file}#${section}`, Object.keys(DOCS).length === 1 ? section : `${file} ${section}`)));
    const edges = M.links.filter(l => memo.includes(linkLabel(l)) || memo.includes(`${l.from} → ${l.to}`));
    const nodes = Object.entries(M.nodes).filter(([id, node], _, entries) =>
      !edges.some(edge => edge.from === id || edge.to === id) && entries.filter(([, candidate]) => candidate.label === node.label).length === 1 &&
      mentionsName(memo, node.label));
    const scenarios = (M.scenarios || []).flatMap((s, i) => mentionsName(memo, s.label) ? [[s.label, i]] : []);
    const action = (attr, value, label) => `<button type="button" class="b small" data-${attr}="${esc(value)}">${esc(label)}</button>`;
    const actions = [...edges.map(l => action('edge', l.id, linkLabel(l))), ...nodes.map(([id, n]) => action('sel', id, n.label)),
      ...scenarios.map(([label, i]) => action('scen', i, label)), ...refs];
    return `<div class="review-memo"><p>${esc(memo)}</p>${actions.length ? `<div class="row">${actions.join('')}</div>` : ''}</div>`;
  }).join('');
}

/* 論理構成でまとめた機能（複数の物理部品） */
function componentDetail(id) {
  const P = VW(), c = P.nodes[id]; if (!c) return '';
  if (c.impl) return implDetail(id);
  const parts = P.from[id] || [], ins = P.links.filter(l => l.to === id), outs = P.links.filter(l => l.from === id);
  const iss = relatedIssues(parts, [...ins, ...outs].flatMap(l => P.linkFrom[l.id] || []));
  const ln = l => `${esc(P.nodes[l.from]?.label)} → ${esc(P.nodes[l.to]?.label)} <span class="mono mute">${(P.linkFrom[l.id] || []).length} 経路</span>`;
  return `<h4>選択中の機能</h4><h3>${esc(c.label)} <span class="mono mute">${esc(id)}</span></h3><div class="sub">論理構成の機能 / ${esc(TI(c.tier).label || '')}</div>
    ${c.description ? `<p>${esc(c.description)}</p>` : ''}
    <div class="row"><button class="b small" data-focus="${esc(id)}">この機能に寄る（F）</button><button class="b small" data-viewmode="cloud">物理構成で見る</button><button class="b small" data-sel="">選択を解除</button></div>
    ${issueDetails(iss)}
    <h4>担う物理部品（${parts.length}）</h4>${parts.map(p => `<div class="item">${esc(M.nodes[p]?.label || p)} <span class="mono mute">${esc(p)}</span> ${CLS.nodes[p] ? tag(CLS.nodes[p].status) : ''}</div>`).join('')}
    <h4>呼び出し元</h4>${ins.map(l => itemButton('edge', l.id, ln(l), st.edge === l.id)).join('') || none}
    <h4>呼び出し先</h4>${outs.map(l => itemButton('edge', l.id, ln(l), st.edge === l.id)).join('') || none}`;
}

/* 実装例の部品（リファレンスの機能を担うサービス・実装で加わる部品） */
function implDetail(id) {
  const P = VW(), c = P.nodes[id], impl = Views.implOf(M, st.view);
  const parts = P.from[id] || [], ins = P.links.filter(l => l.to === id), outs = P.links.filter(l => l.from === id);
  const type = serviceLabel(Catalog.lookup(c.svc)) || kindLabel(c.kind);
  const ln = (l, other) => `${esc(P.nodes[other]?.label || other)}${l.label ? ` <span class="mute">${esc(l.label)}</span>` : ''}`;
  const srcs = (impl?.sources || []).filter(s => /^https?:\/\//i.test(s.url))
    .map(s => `<div class="item"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></div>`).join('');
  return `<h4>実装例の部品</h4><h3>${esc(c.label)} <span class="mono mute">${esc(id)}</span></h3><div class="sub">${type ? esc(type) + ' / ' : ''}${esc(Views.info(M, st.view).label)}</div>
    ${c.description ? `<p>${esc(c.description)}</p>` : ''}
    ${c.management?.scope ? `<h4>運用の分担</h4><p>${esc(c.management.scope)}</p>` : ''}
    <div class="row"><button class="b small" data-focus="${esc(id)}">この部品に寄る（F）</button><button class="b small" data-viewmode="cloud">機能配置で見る</button><button class="b small" data-sel="">選択を解除</button></div>
    <h4>担う機能（${parts.length}）</h4>${parts.map(p => `<div class="item">${esc(M.nodes[p]?.label || p)} <span class="mono mute">${esc(p)}</span></div>`).join('') || '<div class="sub">機能配置にはない、実装で加わる部品</div>'}
    <h4>接続元</h4>${ins.map(l => itemButton('edge', l.id, ln(l, l.from), st.edge === l.id)).join('') || none}
    <h4>接続先</h4>${outs.map(l => itemButton('edge', l.id, ln(l, l.to), st.edge === l.id)).join('') || none}
    ${c.evidence?.length ? `<h4>根拠</h4>${evList(c.evidence)}` : ''}
    ${srcs ? `<h4>実装例の資料</h4>${srcs}` : ''}
    <p class="sub">実装例はサービスの組み合わせの一例です。製品の選択や設定は要件に合わせて確かめてください。</p>`;
}

function nodeDetail(id) {
  if (!allNodes()[id]) return componentDetail(id);
  const n = allNodes()[id];
  const ins = allLinks().filter(l => l.to === id), outs = allLinks().filter(l => l.from === id);
  const iss = relatedIssues([id], [...ins, ...outs].map(l => l.id)), c = CLS.nodes[id];
  const kind = n.kind === 'actor' ? `登場人物：${(ROLES[n.role] || ROLES.user).label}${n.team ? `（${n.team}・${n.headcount ?? 1}名）` : ''}` : serviceLabel(Catalog.lookup(n.svc)) || kindLabel(n.kind);
  const ln = l => `${esc(linkLabel(l))} <span class="mute">${esc(l.label || '')} ${timingLabel(l)}${l.timeoutMs ? ' ' + l.timeoutMs / 1000 + 's' : ''}${l.retry ? ' retry' + esc(l.retry) : ''}</span> ${CLS.links[l.id] ? tag(CLS.links[l.id].status) : ''}`;
  const reqs = (M.requirements || []).filter(q => q.nodes?.includes(id));
  return `<h4>選択中の部品</h4><h3>${esc(n.label)} <span class="mono mute">${esc(id)}</span></h3><div class="sub">${esc(kind)}${n.az ? ` / AZ ${esc(n.az.join(','))}` : ''}${n.subnet ? ` / ${esc(n.subnet)} subnet` : ''} / ${esc(TI(n.tier).label || '')}</div>
    ${n.description ? `<p>${esc(n.description)}</p>` : ''}
    ${n.drill && REGISTRY.some(r => r.id === n.drill) ? `<a class="b drill" href="#/m/${encodeURIComponent(n.drill)}/struct" data-drill="${esc(id)}">▼ 内部構造を見る：${esc(REGISTRY.find(r => r.id === n.drill).name || n.drill)}</a>` : ''}
    <div class="row"><button class="b small" data-focus="${esc(id)}">この部品に寄る（F）</button><button class="b small ${st.nbr ? 'on' : ''}" data-nbr>周辺だけ表示（N）</button><button class="b small" data-sel="">選択を解除</button></div>
    ${issueDetails(iss)}
    ${c ? `<div class="row">${tag(c.status)}<span class="sub m0">${esc(c.why)}</span></div>` : ''}
    <table class="kv"><tr><td>台数</td><td>${esc(n.replicas ?? '—')}</td></tr>${n.parallel ? `<tr><td>並列数</td><td>${esc(n.parallel)}（同じ実行単位が並列に動く）</td></tr>` : ''}${n.slots ? `<tr><td>同時 Task</td><td>${esc(n.slots)}（例）</td></tr>` : ''}${n.partitions ? `<tr><td>分割数</td><td>${esc(n.partitions)}（例）</td></tr>` : ''}${Object.entries(n.metrics || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(fmt(k, v))}</td></tr>`).join('')}</table>
    <h4>根拠</h4>${evList(n.evidence)}
    <h4>呼び出し元</h4>${ins.map(l => itemButton('edge', l.id, ln(l), st.edge === l.id)).join('') || none}
    <h4>呼び出し先</h4>${outs.map(l => itemButton('edge', l.id, ln(l), st.edge === l.id)).join('') || none}
    ${reqs.length ? '<h4>関係する要件</h4>' + reqs.map(q => itemButton('req', q.id, `<b class="mono">${esc(q.id)}</b> ${esc(q.title)}`)).join('') : ''}`;
}

function evidencePanel() {
  const list = s => [...Object.entries(CLS.nodes).map(([id, r]) => ['sel', id, M.nodes[id].label, r]),
    ...M.links.map(l => ['edge', l.id, linkLabel(l), CLS.links[l.id]])].filter(([, , , r]) => r.status === s)
    .map(([attr, id, label, r]) => itemButton(attr, id, `${tag(s)}<b>${esc(label)}</b> <span class="sub">${esc(r.why)}</span>`)).join('') || none;
  const high = ISSUES.map((i, k) => ({ i, k })).filter(({ i }) => i.sev === 'high');
  const acknowledged = new Set((M.unknowns || []).flatMap(u => u.refs || []));
  const unknownItems = [
    ...Object.entries(CLS.nodes).map(([id, r]) => ['sel', id, M.nodes[id].label, r]),
    ...Object.entries(CLS.links).map(([id, r]) => ['edge', id, id, r]),
    ...Object.entries(CLS.reqs).map(([id, r]) => ['req', id, id, r]),
  ].filter(([, id, , r]) => r.status === 'unknown' && !acknowledged.has(id));
  const gateLinks = {
    COVERAGE: COV.missing.map(x => evidenceRef(x.ref, `${x.label}（${x.kind}）`)),
    BROKEN_REF: COV.broken.map(x => evidenceRef(x.ref, `${x.label} → ${x.ref}`)),
    HIGH_ISSUES: high.map(({ i, k }) => itemButton('issue', k, issueContent(i))),
    UNKNOWN_ACK: unknownItems.map(([attr, id, label]) => itemButton(attr, id, esc(`${label}（${id}）`))),
    REQ_TRACE: (M.requirements || []).filter(q => !(q.nodes?.length || q.links?.length || q.scenario)).map(q => itemButton('req', q.id, esc(`${q.id} ${q.title}`))),
  };
  return `<h3>根拠と確度</h3><div class="sub">すべての要素に根拠を付け、実装（IaC・コード・実環境）で裏が取れたものだけを「事実」とする。合否は点検（gates）で判定。</div>
    <h4 id="review-gates" tabindex="-1">点検 ${GATES.pass ? '<span class="tag ok">合格</span>' : '<span class="tag high">不合格</span>'}</h4>
    ${GATES.results.map(r => `<details class="gate" data-gate="${esc(r.id)}"${openGates.has(r.id) ? ' open' : ''}><summary><span class="tag ${r.pass ? 'ok' : 'high'}">${r.pass ? 'OK' : 'NG'}</span>${esc(r.label)} <span class="sub">${esc(r.detail)}</span></summary>${r.items.map((x, i) => `<div class="gate-result">${gateLinks[r.id]?.[i] || esc(x)}</div>`).join('') || '<p class="sub">該当なし</p>'}</details>`).join('')}
    <h4>網羅率 ${COV.covered} / ${COV.total}</h4><div class="bar" style="width:${COV.total ? COV.covered / COV.total * 100 : 100}%"></div>
    ${COV.missing.map(x => `<div class="item"><span class="tag mid">未対応</span>${esc(x.label)} <span class="sub">${esc(x.kind)}</span></div>`).join('')}
    <h4>ずれ</h4>${CLS.drifts.map(d => `<div class="item">${tag('drift')}<p>${esc(d.msg)}</p></div>`).join('') || none}
    <h4>不明（登録済み）</h4>${(M.unknowns || []).map(u => `<div class="item"><b class="mono">${esc(u.id)}</b> ${esc(u.text)} <span class="sub">${esc((u.refs || []).join(', '))}</span></div>`).join('') || none}
    <h4>主張（設計書の記述のみ）</h4>${list('claim')}
    <details class="gate"><summary>逆引き索引（参照先 → 要素）</summary>${Object.entries(IDX.byRef).map(([k, ids]) => `<p>${evidenceRef(k)}<br>→ ${esc(ids.join(', '))}</p>`).join('')}</details>`;
}

function reqPanel() {
  const q = st.req && M.requirements.find(x => x.id === st.req);
  if (q) {
    const c = CLS.reqs[q.id];
    return `<button class="b small" data-req="">← 一覧</button><h4>${esc(REQ_KIND[q.kind] || q.kind)}</h4><h3><span class="mono">${esc(q.id)}</span> ${esc(q.title)}</h3>
      <div class="row">${tag(c.status)}<span class="sub m0">${esc(c.why)}</span></div><div class="note">${esc(q.text)}</div>
      ${q.states ? `<h4>状態</h4><div class="states">${q.states.map(s => `<span>${esc(s)}</span>`).join('<i>→</i>')}</div>` : ''}
      <h4>根拠</h4>${evList(q.evidence)}
      <h4>紐付く構成要素</h4>${[...(q.nodes || []).map(id => ({ t: M.nodes[id]?.label, s: id })), ...(q.links || []).map(id => { const l = linkById(id); return l && { t: linkLabel(l), s: l.from }; }), q.scenario && { t: `シナリオ：${M.scenarios.find(s => s.id === q.scenario)?.label}` }].filter(Boolean).map(x => `<div class="item" ${x.s ? `data-sel="${esc(x.s)}"` : ''}>${esc(x.t)}</div>`).join('') || none}
      ${(M.unknowns || []).filter(u => u.refs?.includes(q.id)).map(u => `<div class="item"><span class="tag mid">不明</span>${esc(u.text)}</div>`).join('')}`;
  }
  return `<h3>要件（技術に依存しない層）</h3><div class="sub">業務ルール・ユースケース・状態遷移・非機能要件。作り直しや移行のときは、構成ではなくこちらを入力にする。クリックで関係する構成を強調。</div>` +
    Object.entries(REQ_KIND).map(([k, n]) => { const qs = M.requirements.filter(x => x.kind === k); return qs.length ? `<h4>${n}</h4>` + qs.map(x => `<div class="item" data-req="${esc(x.id)}"><b class="mono">${esc(x.id)}</b> ${esc(x.title)} ${tag(CLS.reqs[x.id].status)}</div>`).join('') : ''; }).join('');
}

function comparePanel() {
  if (!CMPR) return `<h3>比較</h3><div class="sub">2 つのバージョンのモデルを比べ、追加・削除・変更を色分けします。</div>
    <p>比較対象（以前のバージョンなど）の YAML を読み込んでください。git の履歴と比べる場合は CLI も使えます。</p>
    <div class="row"><button class="b" data-act="open-compare">比較対象の YAML を読み込む</button></div>
    <pre class="code">git show HEAD~1:models/${esc(KEY)}/model.yaml &gt; old.yaml
npm run compare -- old.yaml models/${esc(KEY)}/model.yaml</pre>`;
  const sel = c => c.type === 'node' ? c.id : (allLinks().find(l => l.id === c.id)?.from || '');
  const K = { added: '追加', removed: '削除', changed: '変更' };
  const list = cmpList(), cur = list[st.cmpIdx];
  return `<h3>比較：${esc(CMP.label)} → 現在</h3><div class="sub">比較対象から現在のモデルへの変化。削除された部品は半透明で表示。</div>
    <div class="seg" role="group" aria-label="表示する変化">${Object.entries(K).map(([k, n]) =>
      `<button class="cmp-${k} ${st.cmpKinds.has(k) ? 'on' : ''}" data-cmp-kind="${k}" aria-pressed="${st.cmpKinds.has(k)}">${n} <b>${CMPR.changes.filter(c => c.kind === k).length}</b></button>`).join('')}</div>
    <label class="chk"><input type="checkbox" data-cmp-only ${st.cmpOnly ? 'checked' : ''}> 変化した箇所だけを強調（他は薄く）</label>
    <div class="row stepper"><button class="b small" data-cmp-step="-1" ${list.length ? '' : 'disabled'}>← 前の変化</button>
      <span class="mono">${list.length ? `${(st.cmpIdx ?? -1) + 1} / ${list.length}` : '0 / 0'}</span>
      <button class="b small" data-cmp-step="1" ${list.length ? '' : 'disabled'}>次の変化 →</button></div>
    ${cur ? `<div class="note"><span class="tag cmp-${cur.kind}">${K[cur.kind]}</span>${esc(cur.msg)}</div>` : ''}
    <div class="row"><button class="b small" data-act="open-compare">比較対象を変更</button>${CMP.own ? '<button class="b small" data-act="clear-compare">読み込んだ比較対象を解除</button>' : ''}</div>
    ${Object.keys(K).filter(k => st.cmpKinds.has(k)).map(k => { const cs = CMPR.changes.filter(c => c.kind === k); return `<h4>${K[k]}（${cs.length}）</h4>` + (cs.map(c => `<div class="item ${c === cur ? 'on' : ''}" data-sel="${esc(sel(c))}"><span class="tag cmp-${k}">${c.type === 'node' ? '部品' : '接続'}</span>${esc(c.msg)}</div>`).join('') || none); }).join('')}`;
}
const cmpList = () => (CMPR?.changes || []).filter(c => st.cmpKinds.has(c.kind));
/* 変化を 1 件ずつたどる：その部品へ視点を移す */
function stepChange(d) {
  const list = cmpList(); if (!list.length) return;
  st.cmpIdx = ((st.cmpIdx ?? -1) + d + list.length) % list.length;
  const c = list[st.cmpIdx];
  select(c.type === 'node' ? c.id : allLinks().find(l => l.id === c.id)?.from, { focus: true });
}

function referenceDetails() {
  if (!ENTRY.reference) return '';
  const { objectives = [], sources = [] } = M.reference || {};
  const links = sources.filter(source => /^https?:\/\//i.test(source.url));
  const tags = ENTRY.tags || [], ref = ENTRY.reference;
  return `<div class="ref-meta"><span class="mute">${esc([ref.domain, ref.kind, ref.category].filter(Boolean).join(' › '))}</span>
    ${tags.length ? `<div class="mtags">${tags.map(t => `<button type="button" class="mtag ${TAG_KIND(t)}" data-tag-only="${esc(t)}" title="このラベルで一覧を絞り込む">${esc(t)}</button>`).join('')}</div>` : ''}</div>
    ${objectives.length ? `<h4>学べること</h4><ul>${objectives.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
    ${links.length ? `<h4>公式資料</h4><ul>${links.map(source =>
      `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a></li>`).join('')}</ul>` : ''}`;
}

function sourceLink(source) {
  const label = esc(source);
  if (!URL.canParse(source, location.href) || !['http:', 'https:'].includes(new URL(source, location.href).protocol)) return label;
  return `<a href="${label}" target="_blank" rel="noopener">${label}</a>`;
}

const openGates = new Set();
function edgeAction(l) {
  if (l.label) return l.label;
  const labels = (VW().linkFrom[l.id] || []).map(id => linkById(id)?.label).filter(Boolean);
  return [...new Set(labels)].join(' / ') || '処理内容は未指定';
}
function edgeDetail(l) {
  const c = CLS.links[l.id];
  return `<section class="edge-detail" aria-label="選択中の接続"><h4 id="review-edge" tabindex="-1">選択中の接続</h4>
    <h3>${esc(edgeAction(l))}</h3><p>${[l.from, l.to].map(id => esc(VW().nodes[id]?.label || allNodes()[id]?.label || id)).join(' → ')} ${timingLabel(l)} <span class="mono mute">${esc(l.id)}</span></p>
    ${c ? `<div class="row">${tag(c.status)}<span class="sub m0">${esc(c.why)}</span></div>` : ''}
    <div class="row">${[l.from, l.to].map(id => `<button type="button" class="b small" data-sel="${esc(id)}">${esc(allNodes()[id]?.label || VW().nodes[id]?.label || id)}</button>`).join('')}<button type="button" class="b small" data-edge="">接続の選択を解除</button></div>
    <h4>接続の根拠</h4>${evList(l.evidence)}</section>`;
}

function renderPanel() {
  let h = '';
  if (st.mode === 'struct') h = st.sel ? nodeDetail(st.sel) : `<h3>${esc(M.name)}</h3><div class="sub">${(M.sources || []).map(sourceLink).join(' ') || (ENTRY.local ? 'ブラウザに読み込んだモデル' : '')}</div>
      ${M.description ? `<p>${esc(M.description)}</p>` : ''}${ENTRY.reference && M.scenarios?.length ? '<button type="button" class="b on" data-mode="scenario">処理の流れを見る</button>' : ''}${referenceDetails()}<p>構成図の左上の「モード」「表示」で表示モードやフロアを切り替え、部品をクリックすると詳細を表示します。上の検索（<kbd>/</kbd>）で部品・ID・根拠の参照先を探せます。</p>
      ${reviewMemos()}`;
  if (st.mode === 'scenario') {
    if (!M.scenarios?.length) h = '<h3>シナリオ</h3><div class="sub">このモデルにはシナリオがありません。</div>';
    else {
      const sc = M.scenarios[st.scen], s = sc.steps[st.step];
      h = `<div class="row">${M.scenarios.map((x, i) => `<button class="b ${i === st.scen ? 'on' : ''}" data-scen="${i}">${esc(x.label)}</button>`).join('')}</div>
        <div class="num">${String(st.step + 1).padStart(2, '0')}</div><div class="sub">${esc(sc.label)}</div><div class="note">${esc(s.note)}</div>
        <h4>ステップ</h4><div data-review-list>${sc.steps.map((x, i) => itemButton('goto', i, `<b>${i + 1}.</b> ${esc(x.note)}`, i === st.step)).join('')}</div>`;
    }
  }
  if (st.mode === 'fail') {
    const r = Analyze.impact(M, st.down);
    h = `<h3>障害シミュレーション</h3><div class="sub">${PIPE ? 'ステージをクリックして失敗させる。後続のステージは実行されなくなります。' : '部品をクリックして停止 / 復旧。同期で依存している部品に影響が伝播します。人物を止めると「不在」を表します。'}</div>
      <div class="row"><button class="b" data-reset>すべて復旧</button>${(M.failPresets || []).filter(id => M.nodes[id]).map(id => `<button class="b" data-down="${esc(id)}">${esc(M.nodes[id].label)} 停止</button>`).join('')}</div>
      <h4>停止中</h4>${st.down.map(id => `<div class="item"><b>${esc(M.nodes[id].label)}</b></div>`).join('') || none}
      <h4>${PIPE ? '実行されないステージ' : '影響を受ける（同期依存）'}</h4>${r.impacted.map(id => `<div class="item" data-sel="${esc(id)}">${esc(M.nodes[id].label)}</div>`).join('') || none}
      <h4>処理が滞留する（非同期）</h4>${r.delayed.map(id => `<div class="item" data-sel="${esc(id)}">${esc(M.nodes[id].label)}</div>`).join('') || none}
      <h4>止まるユースケース</h4>${r.brokenScenarios.map(s => `<div class="item"><span class="tag high">停止</span>${esc(s.label)}</div>`).join('') || none}`;
  }
  if (st.mode === 'lint') h = `<h3 id="review-issues" tabindex="-1">指摘 ${ISSUES.length} 件</h3><div class="sub">モデルにルールを当てた結果。クリックで該当箇所を強調。ルールは設定で個別に無効化できます。</div><div data-review-list>` +
    ISSUES.map((i, k) => itemButton('issue', k, issueContent(i), st.issue === k) +
      (st.issue === k ? findingContext(i) : '')).join('') + '</div>';
  if (st.mode === 'metric') {
    const rows = Object.entries(M.nodes).filter(([, n]) => n.metrics?.[st.metric] != null).sort((a, b) => b[1].metrics[st.metric] - a[1].metrics[st.metric]), max = rows[0]?.[1].metrics[st.metric] || 1;
    h = `<div class="row">${METRICS.map(([k, n]) => `<button class="b ${st.metric === k ? 'on' : ''}" data-metric="${esc(k)}">${esc(n)}</button>`).join('')}</div><div class="sub">値を立体の高さと色の濃さで表示。</div>` +
      (rows.map(([id, n]) => `<div class="item" data-sel="${esc(id)}"><b>${esc(n.label)}</b> <span class="mono">${esc(fmt(st.metric, n.metrics[st.metric]))}</span><div class="bar" style="width:${n.metrics[st.metric] / max * 100}%"></div></div>`).join('') || none);
  }
  if (st.mode === 'evidence') h = evidencePanel();
  if (st.mode === 'req') h = reqPanel();
  if (st.mode === 'compare') h = comparePanel();
  if (st.sel && !['struct', 'fail'].includes(st.mode)) h += '<div class="mt"></div>' + nodeDetail(st.sel);
  const edge = st.edge && (allLinks().find(l => l.id === st.edge) || VW().links.find(l => l.id === st.edge));
  const panel = $('panel-body');
  const focused = panel.contains(document.activeElement) && document.activeElement;
  const controls = 'data-goto data-scen data-step data-play data-issue data-cmp-kind data-cmp-step data-edge data-ref data-req data-sel'.split(' ');
  const key = focused && controls.find(attr => focused.hasAttribute(attr));
  panel.innerHTML = (edge ? edgeDetail(edge) : '') + h;
  for (const node of panel.querySelectorAll('div.item[data-sel], div.item[data-req]')) {
    node.tabIndex = 0;
    node.setAttribute('role', 'button');
  }
  if (key) [...panel.querySelectorAll(`[${key}]:not(:disabled)`)]
    .find(el => el.getAttribute(key) === focused.getAttribute(key))?.focus({ preventScroll: true });
}

/* ================= 操作 ================= */
/* id は物理部品でもビューの部品でもよい。物理 1 つに対応するビュー部品は物理 ID で持つ */
function resolveSel(id) {
  if (!id) return null;
  if (allNodes()[id]) return id;
  const view = VW();
  if (view.nodes[id]?.impl) return id;
  const parts = view.from[id];
  return parts ? (parts.length === 1 ? parts[0] : id) : null;
}
function select(id, { focus = false, edge = null } = {}) {
  st.sel = resolveSel(id);
  st.edge = edge;
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
  if (st.sel && $('panel').hidden && !PREVIEW && !document.body.classList.contains('viewer-maximized')) focusPanel();
}
function setView(v) {
  if (!VIEWS.includes(v) || v === st.view) return;
  const previous = st.sel && VW().nodes[st.sel]?.impl ? VW().from[st.sel][0] : st.sel;
  st.view = v; scene.fitted = false; // 配置が変わるので全体が収まるよう視点を合わせ直す
  st.sel = resolveSel(previous);
  if (!st.sel) st.nbr = false;
  draw();
}
async function setMode(m) {
  st.mode = m; st.issue = null; st.edge = null; st.req = null; stopPlay();
  if (m === 'compare') await ensureComparison();
  if (st.mode === m) draw();
}
const stopPlay = () => { clearInterval(st.play); st.play = null; };
const startPlay = () => { st.play = setInterval(() => { st.step = (st.step + 1) % M.scenarios[st.scen].steps.length; draw(); }, 2500); };

let drag3D = S.dragMode;
$('spread-floors').addEventListener('change', e => {
  st.expanded = e.target.checked;
  scene.fitted = false;
  draw();
});
document.querySelectorAll('[data-dimension]').forEach(b => b.addEventListener('click', () => {
  if (st.dimension !== b.dataset.dimension) setDimension(b.dataset.dimension);
}));
const toggleDimension = () => setDimension(st.dimension === '2' ? '3' : '2');
function setDimension(dimension, redraw = true) {
  st.dimension = dimension;
  if (dimension !== '2') $('view').style.zoom = '';
  $('view').dataset.projection = dimension;
  const flat = dimension === '2';
  document.querySelector('[data-act="svg-full"]').hidden = !flat;
  scene.controls.enableRotate = !flat;
  scene.fitted = false;
  setDrag(drag3D);
  for (const button of document.querySelectorAll('[data-dimension]'))
    button.setAttribute('aria-pressed', String(button.dataset.dimension === dimension));
  $('spread-floors').checked = st.expanded;
  document.querySelector('.tb-group[aria-label="ドラッグの操作"]').hidden = flat;
  document.querySelectorAll('[data-view]:not([data-view="reset"])').forEach(b => { b.hidden = flat; });
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
  // 他のモデルへも検索から移動できる（一覧をたどらずに済む）
  ...REGISTRY.filter(r => r.id !== KEY).map(r => ({ t: 'model', id: r.id, label: r.name || r.id, sub: [r.reference?.category, ...(r.tags || [])].filter(Boolean).join('・') || (r.local ? 'ローカル' : '設計モデル'), key: `${r.name || ''} ${r.id} ${r.reference?.domain || ''} ${r.reference?.kind || ''} ${r.reference?.category || ''} ${(r.tags || []).join(' ')}` })),
];
const T_LABEL = { node: '部品', link: '接続', req: '要件', scenario: 'シナリオ', ref: '根拠', model: 'モデル' };
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
  if (x.t === 'model') { location.hash = `#/m/${encodeURIComponent(x.id)}/struct`; return; }
  if (x.t === 'ref') return openEvidenceRef(x.id);
  if (x.t === 'link') return inspectEdge(x.id);
  if (x.t === 'req') { stopPlay(); st.edge = null; st.mode = 'req'; st.req = x.id; draw(); return focusPanel(); }
  if (x.t === 'scenario') { stopPlay(); st.edge = null; st.mode = 'scenario'; st.scen = x.id; st.step = 0; draw(); return focusPanel(); }
  select(x.t === 'node' ? x.id : x.sel, { focus: true });
  if ($('panel').hidden && !PREVIEW) focusPanel();
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
function setComparisonFull(on) {
  $('modal').classList.toggle('compare-full', on);
  $('compare-fullscreen').setAttribute('aria-pressed', String(on));
  $('compare-fullscreen').textContent = on ? '全画面を終了' : '全画面で比較';
}
function exitComparisonFull() {
  setComparisonFull(false);
}
$('compare-fullscreen').onclick = () => {
  const modal = $('modal');
  if (modal.classList.contains('compare-full')) return exitComparisonFull();
  setComparisonFull(true);
};
function modal(title, body) {
  lastFocus = document.activeElement;
  $('modal-title').textContent = title; $('modal-body').innerHTML = body; $('modal').hidden = false;
  $('modal').querySelector('.close').focus();
}
function closeModal() {
  $('modal').hidden = true;
  $('modal').classList.remove('settings-dialog');
  if ($('modal').classList.contains('reference-comparison')) {
    exitComparisonFull();
    $('modal-body').replaceChildren();
    $('modal').classList.remove('reference-comparison');
  }
  lastFocus?.focus?.();
}

function openReferenceComparison() {
  if (!peers.length || PREVIEW) return;
  modal('アーキテクチャ比較', '');
  $('modal').classList.add('reference-comparison');
  const models = new Map([[KEY, M]]);
  renderReferenceComparison($('modal-body'), ENTRY, peers, async entry => {
    if (!models.has(entry.id)) {
      const { model } = await L.loadEntry(entry);
      models.set(entry.id, model);
    }
    return models.get(entry.id);
  });
}

const SHORTCUTS = [['/', '検索'], ['D', '3D / 2D を切り替え'], ['R / M', 'ドラッグを回転 / 移動に切り替え'], ['F', '選択中の部品に寄る'], ['N', '選択中の部品の周辺だけ表示'], ['Esc', '選択解除・閉じる'],
  ['1〜' + MODES.length, '表示モードの切り替え'], ['← / →', 'シナリオのステップ'], ['↑ / ↓', 'ステップ・指摘一覧で項目間を移動'], ['V', 'ビュー（論理 / 物理サービス / 物理ネットワーク）の切り替え'], ['[', 'サイドバーの開閉'], ['?', 'このヘルプ']];
function openHelp(welcome) {
  if (welcome) return modal('DeepDiverDown へようこそ', `
    <p>構成図で部品と接続をたどり、モデルの根拠や点検結果を確認できます。</p>
    <div class="welcome-actions">
      <button class="b on" data-act="review-start">構成図を見る</button>
      ${M.scenarios?.length ? '<button class="b" data-act="review-scenario">処理の流れを見る</button>' : ''}
      ${ENTRY.reference ? '' : '<button class="b" data-act="review-issues">指摘を見る</button><button class="b" data-act="review-gates">点検結果を見る</button>'}
    </div>
    <p class="sub">モデルはサイドバーから選べます。操作方法は「ヘルプ」で確認できます。</p>`);
  modal('ヘルプ', `
    <h4>基本の使い方</h4><ol class="steps-list">
      <li>左のサイドバーでモデルを選び、構成図の左上の「ビュー」「モード」「表示」で見え方を切り替える</li><li>3D 図をドラッグで回転・移動、ホイールで拡大縮小（上のツールバーで回転／移動を切替）</li>
      <li>部品をクリックすると右のパネルに詳細・根拠・関連する指摘が出る</li><li>「根拠と確度」で点検の合否と未確認の箇所を確認する</li></ol>
    <h4>確度の見方</h4><div class="row wrap">${['fact', 'claim', 'unknown', 'drift'].map(s => tag(s)).join('')}</div>
    <p class="sub">事実＝実装で確認／主張＝設計書の記述のみ／不明＝根拠なし／ずれ＝資料どうしが食い違う</p>
    <h4>ショートカット</h4><table class="kv">${SHORTCUTS.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table>
    <h4>モデルを試す</h4><p>YAML ファイルを画面にドラッグ＆ドロップするか「開く」から読み込むと、その場で表示・点検します（ブラウザ内に保存。外部には送信しません）。</p>`);
}

function focusPanel(target) {
  if (document.body.classList.contains('viewer-maximized')) document.querySelector('[data-act="maximize-view"]').click();
  if ($('panel').hidden) $('detail-toggle').click();
  const el = typeof target === 'string' ? $(target) : target;
  (el || $('panel')).focus();
}

function inspectEdge(id, fromDiagram = false) {
  if (!id) { st.edge = null; draw(); return focusPanel(); }
  const edge = allLinks().find(l => l.id === id) || VW().links.find(l => l.id === id);
  if (!edge) return;
  const ends = [edge.from, edge.to];
  for (const end of ends) {
    const node = VW().nodes[viewIdOf(end)];
    if (node) st.hidden.delete(node.tier);
  }
  const related = ends.includes(st.sel) || ends.some(end => viewIdOf(end) === st.sel);
  select(related ? st.sel : edge.from, { focus: !fromDiagram && !related, edge: id });
  if (!fromDiagram) focusPanel('review-edge');
}

function openReview(mode, id = null) {
  if (!$('modal').hidden) closeModal();
  if (mode === 'lint') {
    st.sel = null; st.nbr = false;
    st.mode = 'lint'; st.issue = id; st.edge = null; st.req = null; stopPlay(); draw();
    focusPanel(id == null ? 'review-issues' : $('panel-body').querySelector(`[data-review-list] [data-issue="${id}"]`));
    return;
  }
  if (mode === 'evidence') {
    openGates.clear();
    GATES.results.filter(g => !g.pass).forEach(g => openGates.add(g.id));
    st.sel = null; st.nbr = false;
  }
  setMode(mode);
  if (mode === 'evidence') focusPanel('review-gates');
  if (mode === 'scenario') focusPanel($('panel-body').querySelector('[data-goto][aria-current="true"]'));
}

function openEvidenceRef(ref) {
  const [file, section] = ref.split('#');
  const sectionInfo = Object.hasOwn(DOCS, file) && DOCS[file].find(x => x.id === section);
  const source = /^docs\/[\w./-]+\.md$/.test(file) && Object.hasOwn(DOCS, file) ? file : /^https?:\/\//i.test(ref) ? ref : null;
  const ids = Object.hasOwn(IDX.byRef, ref) ? IDX.byRef[ref] : [];
  const controls = { node: 'sel', link: 'edge', requirement: 'req', scenario: 'scen' };
  const owners = [...new Set(ids)].map(id => {
    const entry = IDX.byId[id];
    const attr = entry && controls[entry.type];
    const value = attr === 'scen' ? M.scenarios?.findIndex(s => s.id === id) : id;
    return attr && value !== -1 ? itemButton(attr, value, esc(entry.label || id)) : `<p>${esc(entry?.label || id)}</p>`;
  });
  modal('根拠の参照先', `<p class="mono evidence-address">${esc(ref)}</p>
    ${sectionInfo ? `<p>${esc(sectionInfo.id)} ${esc(sectionInfo.title)}</p>` : ''}
    ${source ? `<a href="${esc(source)}" target="_blank" rel="noopener">参照資料を開く</a>` : ''}
    ${owners.length ? '<h4>この参照先に紐付く要素</h4>' + owners.join('') : ''}`);
}

/* 設定：左に分類、右に項目（1 行 1 項目）。狭い画面では分類の一覧から項目へ進む。
   「このアプリについて」の規約・ライセンス・更新履歴は about.html の内容を読み込んで再利用する */
const SETTINGS_PANES = [
  ['display', '表示', '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.9-4.5-9-10-9z"/>', '色や図の見え方。すぐに反映されます。'],
  ['controls', '操作', '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4"/>', '図を開くときの表示とドラッグ操作。'],
  ['ai', 'AI 支援', '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>', 'ローカル起動時のみ利用できます。'],
  ['review', '点検', '<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>', '変更は保存され、再読み込み後の点検に反映されます。'],
  ['data', 'データ', '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>', 'このブラウザに保存しているもの。'],
  ['about', 'サイト情報', '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', '利用規約・免責事項・ライセンス・更新履歴。'],
];
const ABOUT_SECTIONS = [['inspiration', '参考にしたサイト'], ['terms', '利用規約'], ['privacy', 'プライバシーポリシー'], ['disclaimer', '免責事項'], ['licenses', 'サードパーティーライセンス'], ['author', '作者・リンク'], ['history', '更新履歴']];

async function loadAboutInto(box) {
  try {
    const res = await fetch('about.html', { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const parts = ABOUT_SECTIONS.map(([id, title]) => {
      const section = doc.getElementById(id);
      if (!section) return '';
      const body = section.cloneNode(true);
      body.querySelector('h2')?.remove();
      body.querySelectorAll('a[target="_blank"]').forEach(a => a.setAttribute('rel', 'noopener noreferrer'));
      return `<details class="set-acc"><summary>${esc(title)}</summary><div class="set-acc-body">${body.innerHTML}</div></details>`;
    }).join('');
    const latest = doc.querySelector('#history time')?.getAttribute('datetime');
    const date = latest ? latest.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1年$2月$3日') : '';
    box.innerHTML = parts + `<p class="set-ver">${date ? `最終更新 ${esc(date)}　` : ''}<a href="about.html" target="_blank" rel="noopener noreferrer">サイト情報のページを開く</a></p>`;
  } catch {
    box.innerHTML = '<p class="set-ver">規約などを読み込めませんでした。<a href="about.html" target="_blank" rel="noopener noreferrer">サイト情報のページを開く</a></p>';
  }
}

function openSettings() {
  const rules = Analyze.RULES;
  const row = (title, help, control) => `<div class="set-row"><div class="set-text"><div class="set-t">${title}</div>${help ? `<div class="set-h">${help}</div>` : ''}</div><div class="set-ctl">${control}</div></div>`;
  const select = (name, label, options, cur) => `<select name="${name}" aria-label="${label}">${options.map(([v, n]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  const group = t => `<h4 class="set-group">${t}</h4>`;
  const panes = {
    display: group('外観')
      + row('テーマ', '', select('theme', 'テーマ', [['auto', 'OS に合わせる'], ['light', 'ライト'], ['dark', 'ダーク']], S.theme))
      + row('図のアクセントカラー', '処理の流れや選択中の部品・接続に使います。', select('viewAccent', '図のアクセントカラー', [['orange', 'オレンジ'], ['blue', 'ブルー']], S.viewAccent === 'orange' ? 'orange' : 'blue'))
      + row('公式アイコンを使う', hasIcons ? '' : 'アイコンが同梱されていないため使えません。', `<label class="switch"><input type="checkbox" name="officialIcons" aria-label="公式アイコンを使う" ${S.officialIcons ? 'checked' : ''} ${hasIcons ? '' : 'disabled'}><span></span></label>`)
      + group('図')
      + row('描画モード', '軽量・最軽量では、操作中のラベル配置とパケットの更新を間引きます。', select('renderMode', '描画モード', [['standard', '標準'], ['light', '軽量'], ['minimal', '最軽量']], S.renderMode))
      + row('ラベルの大きさ', '', `<input type="range" name="labelScale" aria-label="ラベルの大きさ" min="0.8" max="1.5" step="0.05" value="${S.labelScale}"><output>${Math.round(S.labelScale * 100)}%</output>`)
      + row('パケットの速さ', '', `<input type="range" name="packetSpeed" aria-label="パケットの速さ" min="0" max="3" step="0.25" value="${S.packetSpeed}"><output>${S.packetSpeed}×</output>`)
      + row('2D の部品デザイン', '', select('nodeStyle2D', '2D の部品デザイン', [['card', 'ラベル一体型カード'], ['silhouette', '種類別のシルエット']], S.nodeStyle2D === 'silhouette' ? 'silhouette' : 'card'))
      + row('3D の部品デザイン', '', select('nodeStyle3D', '3D の部品デザイン', [['components', '形と色で部品を区別'], ['flow', 'フロアと接続を強調']], S.nodeStyle3D === 'flow' ? 'flow' : 'components')),
    controls: row('初期の表示', '', select('dimension', '初期の表示', [['3', '3D'], ['2', '2D']], S.dimension))
      + row('初期の視点', '', select('defaultView', '初期の視点', [['iso', '斜め'], ['top', '真上'], ['side', '横'], ['back', '裏側']], S.defaultView))
      + row('左ドラッグの既定', '', select('dragMode', '左ドラッグの既定', [['rotate', '回転'], ['pan', '移動']], S.dragMode)),
    ai: row('実行先', 'AI 用ビューアでの対話・取り込み・指摘対応に使います。', select('aiProvider', '実行先', Object.entries(AI_PROVIDERS), S.aiProvider === 'codex' ? 'codex' : 'claude')),
    review: group('点検のしきい値')
      + `<p class="set-h set-note">空欄の場合はモデルの設定を使います。</p>`
      + row('許容する「ずれ」の件数', '', `<input type="number" name="maxDrift" aria-label="許容するずれの件数" min="0" value="${S.gates.maxDrift ?? ''}" placeholder="${M.gates?.maxDrift ?? 0}">`)
      + row('許容する重大な指摘の件数', '', `<input type="number" name="maxHigh" aria-label="許容する重大な指摘の件数" min="0" value="${S.gates.maxHigh ?? ''}" placeholder="${M.gates?.maxHigh ?? 0}">`)
      + `<details class="set-acc"><summary>指摘ルール <small>${rules.length} 件</small></summary><div class="set-acc-body rules">${rules.map(r => `<label class="chk"><input type="checkbox" name="rule" value="${r.id}" ${S.disabledRules.includes(r.id) ? '' : 'checked'}> <span class="tag ${r.sev}">${r.sev === 'high' ? '重大' : '注意'}</span>${esc(r.title)} <small class="mono mute">${r.id}${r.for ? ' / ' + r.for : ''}</small></label>`).join('')}</div></details>`
      + `<div class="set-action"><button type="button" class="b on" data-act="reload">再読み込みして点検に反映</button></div>`,
    data: group('読み込んだモデル')
      + `<div class="locals">${REGISTRY.filter(r => r.local).map(r => `<div class="item">${esc(r.name || r.id)} <button type="button" class="b small" data-rmlocal="${r.id}">削除</button></div>`).join('') || '<div class="set-h">ブラウザに読み込んだモデルはありません。</div>'}</div>`
      + group('初期化')
      + row('設定を初期値に戻す', '表示や点検の設定が対象です。モデルは消えません。', '<button type="button" class="b" data-act="reset-settings">初期化</button>'),
    about: '<div id="about-body" class="set-about"><p class="set-ver">読み込み中…</p></div>',
  };
  const nav = SETTINGS_PANES.map(([id, name, icon], i) => `${id === 'about' ? '<hr>' : ''}<button type="button" class="${i === 0 ? 'on' : ''}" data-pane="${id}"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${name}</span><i aria-hidden="true">›</i></button>`).join('');
  const main = SETTINGS_PANES.map(([id, name, , lead], i) => `<section class="settings-pane" id="settings-${id}" data-pane-id="${id}" ${i === 0 ? '' : 'hidden'}><header><button type="button" class="settings-back" aria-label="設定の分類に戻る">‹ 設定</button><h3>${name}</h3><p>${lead}</p></header>${panes[id]}</section>`).join('');
  modal('設定', `<form id="settings" class="settings" data-stage="list"><nav class="settings-nav" aria-label="設定の分類">${nav}</nav><div class="settings-main">${main}</div></form>`);
  $('modal').classList.add('settings-dialog');
  const f = $('settings');
  const showPane = id => {
    f.querySelectorAll('.settings-nav [data-pane]').forEach(b => b.classList.toggle('on', b.dataset.pane === id));
    f.querySelectorAll('.settings-pane').forEach(p => { p.hidden = p.dataset.paneId !== id; });
    f.dataset.stage = 'pane';
    f.querySelector('.settings-main').scrollTop = 0;
    if (id === 'about' && !f.dataset.aboutLoaded) { f.dataset.aboutLoaded = '1'; loadAboutInto($('about-body')); }
  };
  f.querySelectorAll('.settings-nav [data-pane]').forEach(b => b.addEventListener('click', () => showPane(b.dataset.pane)));
  f.querySelectorAll('.settings-back').forEach(b => b.addEventListener('click', () => { f.dataset.stage = 'list'; }));
  f.addEventListener('input', e => {
    const fd = new FormData(f);
    Object.assign(S, { theme: fd.get('theme'), labelScale: +fd.get('labelScale'), packetSpeed: +fd.get('packetSpeed'), defaultView: fd.get('defaultView'), dimension: fd.get('dimension'), dragMode: fd.get('dragMode') });
    S.renderMode = ['standard', 'light', 'minimal'].includes(fd.get('renderMode')) ? fd.get('renderMode') : 'standard';
    S.nodeStyle3D = fd.get('nodeStyle3D') === 'flow' ? 'flow' : 'components';
    S.viewAccent = fd.get('viewAccent') === 'blue' ? 'blue' : 'orange';
    S.nodeStyle2D = fd.get('nodeStyle2D') === 'silhouette' ? 'silhouette' : 'card';
    S.aiProvider = fd.get('aiProvider') === 'codex' ? 'codex' : 'claude';
    if (hasIcons) S.officialIcons = fd.has('officialIcons');
    const g = {}; for (const k of ['maxDrift', 'maxHigh']) if (fd.get(k) !== '') g[k] = Math.max(0, +fd.get(k)); S.gates = g;
    S.disabledRules = rules.map(r => r.id).filter(id => !fd.getAll('rule').includes(id));
    f.querySelectorAll('output')[0].textContent = Math.round(S.labelScale * 100) + '%';
    f.querySelectorAll('output')[1].textContent = S.packetSpeed + '×';
    saveSettings(S); applyAppearance(S); scene.speed = S.packetSpeed; scene.renderMode = S.renderMode;
    if (e.target.name === 'renderMode') scene.labelsDirty = true;
    if (e.target.name === 'labelScale') {
      scene.labelsDirty = true;
      if (st.dimension === '2') draw();
    }
    if (e.target.name === 'defaultView') scene.initialView = S.defaultView;
    if (e.target.name === 'dimension') setDimension(S.dimension);
    if (e.target.name === 'dragMode') { drag3D = S.dragMode; setDrag(drag3D); }
    if (['theme', 'viewAccent', 'officialIcons', 'nodeStyle2D', 'nodeStyle3D'].includes(e.target.name)) {
      draw();
      if (e.target.name === 'nodeStyle3D' && style3D() && scene.fitView) scene.fit(scene.fitView);
    }
  });
}

/* ================= イベント ================= */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-hit],[data-act],[data-cmp-kind],[data-cmp-step],button[data-drag],[data-viewmode],[data-view],[data-mode],[data-scen],[data-step],[data-goto],[data-play],[data-reset],[data-down],[data-issue],[data-metric],[data-req],[data-sel],[data-focus],[data-nbr],[data-rmlocal],[data-edge],[data-ref]');
  if (e.target.closest('#modal') && !e.target.closest('.dialog')) return closeModal();
  if (e.target.closest('#modal .close')) return closeModal();
  if (!t) { if (!e.target.closest('.search')) $('qres').hidden = true; return; }
  const d = t.dataset;
  if (d.hit != null) return openHit(qHits[+d.hit]);
  if (d.act) {
    const a = d.act;
    if (a === 'flow-play') {
      if (st.mode !== 'scenario') { setMode('scenario'); startPlay(); }
      else if (st.play) stopPlay();
      else startPlay();
      return draw();
    }
    if (a === 'readable-diagram') { readableDiagram = !readableDiagram; updateDiagramScale(); return; }
    if (a === 'review-start') return openReview('struct');
    if (a === 'review-scenario') return openReview('scenario');
    if (a === 'review-issues') return openReview('lint');
    if (a === 'review-gates') return openReview('evidence');
    if (a === 'reference-compare') return openReferenceComparison();
    if (a === 'pick-model') return pickModel();
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
      if (t.classList.contains('scrim')) return document.body.classList.remove('nav-open'); // 暗幕は閉じるだけ
      if (matchMedia('(max-width:1279px)').matches) return document.body.classList.toggle('nav-open'); // 狭い画面は引き出しの開閉のみ
      S.sidebar = !document.body.classList.toggle('nav-closed'); return saveSettings(S);
    }
    if (a === 'product-summary') return openProductSummary();
    if (a === 'reload') return location.reload();
    if (a === 'reset-settings') { saveSettings({ ...DEFAULTS }); return location.reload(); }
    return;
  }
  if (t.closest('#modal') && (d.sel != null || d.edge != null || d.req != null || d.scen != null)) closeModal();
  if (d.ref != null) return openEvidenceRef(d.ref);
  if (d.edge != null) return inspectEdge(d.edge);
  if (d.rmlocal) { L.removeLocal(d.rmlocal); return location.hash = '#/m/' + REGISTRY[0].id + '/struct'; }
  if (d.cmpKind) { st.cmpKinds.has(d.cmpKind) ? st.cmpKinds.delete(d.cmpKind) : st.cmpKinds.add(d.cmpKind); st.cmpIdx = null; return draw(); }
  if (d.cmpStep) return stepChange(+d.cmpStep);
  if (d.drag) return setDrag(d.drag);
  if (d.viewmode) return setView(d.viewmode);
  if (d.view) {
    if (st.dimension === '2' && d.view === 'reset') readableDiagram = false;
    scene.fit(st.dimension === '2' ? 'top' : d.view === 'reset' ? S.defaultView : d.view);
    updateDiagramScale();
    return;
  }
  if (d.mode) { document.body.classList.remove('nav-open'); return setMode(d.mode); }
  if (d.focus) return select(d.focus, { focus: true });
  if (d.nbr != null) { st.nbr = !st.nbr; return draw(); }
  if (d.scen != null) { st.scen = +d.scen; st.step = 0; st.mode = 'scenario'; st.edge = null; stopPlay(); }
  else if (d.step != null) st.step += +d.step;
  else if (d.goto != null) { st.step = +d.goto; stopPlay(); }
  else if (d.play != null) { if (st.play) stopPlay(); else startPlay(); }
  else if (d.reset != null) st.down = [];
  else if (d.down) st.down = [...new Set([...st.down, d.down])];
  else if (d.issue != null) {
    if (!t.closest('[data-review-list]')) return openReview('lint', +d.issue);
    st.issue = st.issue === +d.issue ? null : +d.issue;
    st.edge = null;
  }
  else if (d.metric) st.metric = d.metric;
  else if (d.req != null) { st.req = d.req || null; st.mode = 'req'; }
  else if (d.sel != null) {
    if (t.closest('.finding-context')) {
      st.mode = 'struct'; st.issue = null;
      select(d.sel, { focus: true });
      return focusPanel();
    }
    return select(d.sel || null, { focus: !!d.sel });
  }
  draw();
});
$('panel-body').addEventListener('toggle', e => {
  const id = e.target.dataset?.gate;
  if (id) e.target.open ? openGates.add(id) : openGates.delete(id);
}, true);
$('panel-body').addEventListener('keydown', e => {
  if (e.target.matches('div[role="button"]') && ['Enter', ' '].includes(e.key)) {
    e.preventDefault();
    e.target.click();
  }
  const list = e.target.closest('[data-review-list]');
  if (!list || !e.target.matches('.review-item')) return;
  const items = [...list.querySelectorAll('.review-item')];
  const index = items.indexOf(e.target);
  const next = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: items.length - 1 }[e.key];
  if (next == null) return;
  e.preventDefault();
  e.stopPropagation();
  items[Math.min(items.length - 1, Math.max(0, next))]?.focus();
});
function setMinimapPreference(on) {
  st.minimap = on;
  S.minimap = on;
  $('minimap').checked = on;
  saveSettings(S);
  scene.setMinimap(on && !PREVIEW);
}
document.addEventListener('change', e => {
  if (e.target.id === 'flow-scenario') { st.scen = +e.target.value; st.step = 0; st.mode = 'scenario'; st.edge = null; stopPlay(); draw(); return; }
  if (e.target.dataset.tier) { e.target.checked ? st.hidden.delete(e.target.dataset.tier) : st.hidden.add(e.target.dataset.tier); draw(); }
  if (e.target.id === 'nbr') { st.nbr = e.target.checked; draw(); }
  if (e.target.id === 'minimap') { setMinimapPreference(e.target.checked); renderStats(); }
  if (e.target.matches('[data-cmp-only]')) { st.cmpOnly = e.target.checked; draw(); }
});
$('model-filter').addEventListener('input', updateLibraryFilter);
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tag]'); if (t) return toggleTag(t.dataset.tag);
  if (e.target.closest('[data-tag-clear]')) { LIB_TAGS.clear(); renderTagFilter(); return updateLibraryFilter(); }
  const o = e.target.closest('[data-tag-only]');
  if (o) { document.body.classList.remove('nav-closed'); if (matchMedia('(max-width:1279px)').matches) document.body.classList.add('nav-open'); toggleTag(o.dataset.tagOnly, true); }
});
$('model-filter').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const a = [...document.querySelectorAll('#library .mitem')].find(x => !x.hidden); if (a) location.hash = a.getAttribute('href'); }
  if (e.key === 'Escape') { e.target.value = ''; updateLibraryFilter(); e.target.blur(); }
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
  if (PREVIEW) return;
  if (!$('modal').hidden) {
    if (e.key === 'Escape') {
      if ($('modal').classList.contains('compare-full')) exitComparisonFull();
      else closeModal();
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); return pickModel(); }
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
$('viewer-title').textContent = M.name;
/* ドリルダウン：上位の図（parent）があればパンくずで戻れるようにする */
{
  let back = M.parent; try { back = JSON.parse(sessionStorage.getItem('ddd.back.' + KEY) || 'null') || back; } catch {}
  const up = $('mparent'), p = back?.model && REGISTRY.find(r => r.id === back.model);
  up.hidden = !p;
  if (p) { up.href = `#/m/${encodeURIComponent(p.id)}/struct${back.node ? '?s=' + encodeURIComponent(back.node) : ''}`; up.textContent = `↑ ${p.name}`; up.title = '上位の図に戻る'; up.onclick = e => { e.preventDefault(); transitionTo(up.getAttribute('href'), 'out'); }; }
}
setDimension(st.dimension, false);
// 製品の開閉は、人が見出しを押したときだけ覚える（検索で自動に開いたものは覚えない）
$('reference-list').addEventListener('click', e => {
  const sum = e.target.closest('.lib-prod>summary'); if (!sum || libraryFiltered()) return;
  const p = sum.parentElement;
  !p.open ? LIB_PROD_OPEN.add(p.dataset.prod) : LIB_PROD_OPEN.delete(p.dataset.prod);
  try { sessionStorage.setItem('ddd.libProd', JSON.stringify([...LIB_PROD_OPEN])); } catch {}
});
$('lib-rail').addEventListener('click', e => {
  const b = e.target.closest('[data-lib-domain]'); if (!b) return;
  const d = b.dataset.libDomain, body = document.body;
  if (matchMedia('(max-width:1279px)').matches) {
    // 狭い画面：列を押すとその分野の一覧が開く。開いている分野をもう一度押すと閉じる（768px 以上）
    if (body.classList.contains('nav-open') && LIB_SEL.domain === d && matchMedia('(min-width:768px)').matches) return body.classList.remove('nav-open');
    if (body.classList.contains('detail-open')) $('detail-close').click();
    body.classList.add('nav-open');
  } else if (body.classList.contains('nav-closed')) {
    body.classList.remove('nav-closed'); S.sidebar = true; saveSettings(S);
  }
  selectLibDomain(d);
});
$('lib-active').addEventListener('click', e => { const b = e.target.closest('[data-lib-kind]'); if (b) selectLibKind(''); });
$('lib-kinds').addEventListener('click', e => { const b = e.target.closest('[data-lib-kind]'); if (b) selectLibKind(b.dataset.libKind); });
document.addEventListener('click', e => {
  const a = e.target.closest?.('a[data-drill]'); if (!a) return;
  e.preventDefault(); drillInto(a.dataset.drill);
});
new ResizeObserver(() => {
  if (st.dimension === '2' && compareViewport.classList.contains('compare-viewport')) scene.onFlatResize();
}).observe(compareViewport);
compareViewport.addEventListener('wheel', e => {
  if (st.dimension !== '2' || !compareViewport.classList.contains('compare-viewport') || e.ctrlKey) return;
  const horizontal = compareViewport.scrollWidth > compareViewport.clientWidth;
  const vertical = compareViewport.scrollHeight > compareViewport.clientHeight;
  if (!PREVIEW && e.shiftKey && horizontal) {
    e.preventDefault(); e.stopPropagation();
    compareViewport.scrollLeft += e.deltaY || e.deltaX;
  } else if (PREVIEW && (horizontal || vertical)) {
    e.stopPropagation();
    if (horizontal && !vertical && !e.deltaX) {
      e.preventDefault(); compareViewport.scrollLeft += e.deltaY;
    }
  }
}, { capture: true, passive: false });
if (PREVIEW) {
  compared = previewRoles();
  function revealRole() {
    if (st.dimension === '2' && compared?.active > 0) {
      scene.revealComparisonNode = [...compared.parts].find(([,role]) => role[0] === compared.active)?.[0];
    }
  }
  revealRole();
  window.addEventListener('comparison-change', () => {
    const next = previewRoles();
    if (next) { compared = next; revealRole(); drawScene(); }
  });
}
try { sessionStorage.setItem('ddd.lastModel', KEY); } catch {}
renderLibrary();
if (ROUTE.cat) showCategoryPage(ROUTE.cat);
scene.setMinimap(st.minimap && !PREVIEW);
if (st.mode === 'compare') await ensureComparison();
if (initialSelection && Object.hasOwn(VW().nodes, initialSelection)) st.sel = resolveSel(initialSelection);
if (ROUTE.q.edge && (allLinks().some(l => l.id === ROUTE.q.edge) || VW().links.some(l => l.id === ROUTE.q.edge))) st.edge = ROUTE.q.edge;
if (lab('perf-log')) {
  // lab perf-log：描き直しの内訳を計る。window.__ddPerf.report() で表にする
  const P = await import('./lab-perf.js');
  decorate = P.perfFn('app.decorate', decorate); projectState = P.perfFn('app.projectState', projectState);
  diagramLayout = P.perfFn('app.diagramLayout', diagramLayout); nodeSpec = P.perfFn('app.nodeSpec', nodeSpec);
  renderSidebar = P.perfFn('app.renderSidebar', renderSidebar); renderStats = P.perfFn('app.renderStats', renderStats);
  renderPanel = P.perfFn('app.renderPanel', renderPanel); renderViewOverview = P.perfFn('app.renderViewOverview', renderViewOverview);
  renderFlowControls = P.perfFn('app.renderFlowControls', renderFlowControls); updateDiagramScale = P.perfFn('app.updateDiagramScale', updateDiagramScale);
  syncFileMap = P.perfFn('app.syncFileMap', syncFileMap);
  drawScene = P.perfRecord(drawScene);
  P.perfWrap(Object.getPrototypeOf(scene), ['begin', 'floor', 'group', 'platformEnvelope', 'link', 'node', 'mergeStatic', 'end', 'layoutLabels', 'placeLabels', 'labelHideSet', 'updateMinimapCamera', 'fastPatch'], 'scene.');
  const api = P.installReport({ select: (id, o) => select(id, o), draw: () => draw(), st, scene, nodeIds: () => Object.keys(VW().nodes), linkIds: () => VW().links.map(l => l.id) }); api.run = (n, pick) => P.perfSelectRun(api, n, pick);
}
draw();
if (ROUTE.q.v) { const v = ROUTE.q.v.split('_').map(Number); if (v.length === 7 && v.every(Number.isFinite)) scene.setView({ p: v.slice(0, 3), t: v.slice(3, 6), z: v[6] }); }
window.viewerLoading.ready();
if (ENTRY.id !== ROUTE.id && ROUTE.id) toast(`モデル「${ROUTE.id}」が見つからないため、${M.name} を表示しています`);
const adminView = window === window.top && ['127.0.0.1', 'localhost'].includes(location.hostname) && location.port === '8126';
if (!PREVIEW && !adminView && once('ddd.welcome')) openHelp(true);
if (adminView) {
  void import('./admin-chat.js').then(({ initAdminChat }) => initAdminChat({
    modelId: ENTRY.local || ENTRY.design ? undefined : KEY, provider: S.aiProvider,
  }));
}
// 製品に属する図だけ、「製品の特徴」ボタンを出す
$('product-summary').hidden = !productGroupOf(ENTRY);
