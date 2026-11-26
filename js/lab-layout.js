/* 試作：配置の補正。?lab=layout-flow,layout-layers で有効にする（lab.js）。
 * モデルを読み込んだ直後に、表示用のコピーの座標だけを直す。YAML と、解析に使うモデルの意味は変えない。
 *   layout-flow   : 接続の向きから段（rank）を最長経路で求め、左から右へ流れるよう枠・部品の座標を振り直す。
 *                   接続線が無関係な部品の上を通る件数（tools/audit-layout-flow.mjs と同じ判定）が減るよう y を入れ替える。
 *   layout-layers : 3D の実装例で、部品を役割（制御・メタデータ／処理／保存・データ）ごとの床に分ける。
 *                   利用者・外部は左端の枠にまとめる。段が 1 つだけ、または部品が 6 個未満の図は変えない。
 * 循環する接続は、深さ優先で見つかる戻り辺を無視して段を決める。 */
import { lab } from './lab.js';

const STEP_X = 4, STEP_Y = 3, GAP_FRAME = 3, X0 = 1.5, HIT = 0.6;
const LAYER_LABEL = { ctrl: '制御・メタデータ', proc: '処理', data: '保存・データ' };
const DATA_KINDS = new Set(['db', 'queue', 'cache', 'table', 'file', 'segment']);
const CTRL_KINDS = new Set(['service', 'scheduler', 'catalog', 'policy', 'workflow', 'monitor']);
const ACTOR_KINDS = new Set(['client', 'actor', 'external']);
const CTRL_SVC = /(^|[:\-_/])(iam|auth|authn|authz|sso|oidc|cognito|entra|aad|okta|kms|vault|secrets?|catalog|glue|unity|purview|polaris|lakeformation|metastore|hive-?metastore|horizon|rbac)([:\-_/]|$)/i;
const CTRL_LABEL = /認証|認可|資格情報|ロール|権限|カタログ|メタデータ|catalog|metadata|IAM|identity|credential/i;
// kind が service でも、実際に処理を動かす部品（実行基盤・ジョブ）は「処理」に置く
const COMPUTE_SVC = /(^|[:\-_/])(cloudrun|ecs|eks|fargate|lambda|functions?|batch|dataflow|emr|spark|ec2|aks|gke|run|job|jobs|warehouse|runtime|compute|pipe|streaming|ingest)([:\-_/]|$)/i;
const COMPUTE_LABEL = /ジョブ|生成器|評価|ワーカー|実行|Jobs?\b|Warehouse|runtime/i;

/* ---------- 判定（tools/audit-layout-flow.mjs と同じ） ---------- */
export function jumpCount(pos, links) {
  const adj = {};
  for (const [a, b] of links) { (adj[a] ||= new Set()).add(b); (adj[b] ||= new Set()).add(a); }
  let n = 0;
  for (const [a, b] of links) {
    const A = pos[a], B = pos[b]; if (!A || !B || A.z !== B.z) continue;
    const dx = B.x - A.x, dy = B.y - A.y, len2 = dx * dx + dy * dy; if (!len2) continue;
    for (const c in pos) {
      const C = pos[c];
      if (c === a || c === b || C.z !== A.z || adj[a]?.has(c) || adj[b]?.has(c)) continue;
      const t = ((C.x - A.x) * dx + (C.y - A.y) * dy) / len2;
      if (t <= 0.1 || t >= 0.9) continue;
      if (Math.hypot(A.x + t * dx - C.x, A.y + t * dy - C.y) < HIT) n++;
    }
  }
  return n;
}
export function absPositions(layout) {
  const tiers = Object.fromEntries((layout.tiers || []).map(t => [t.id, t]));
  const pos = {};
  for (const [id, p] of Object.entries(layout.nodes || {})) {
    const t = tiers[p.tier]; if (!t) continue;
    pos[id] = { x: (t.origin?.[0] || 0) + p.x, y: (t.origin?.[1] || 0) + p.y, z: t.z || 0 };
  }
  return pos;
}

/* ---------- 段（rank）：最長経路。循環の戻り辺は無視 ---------- */
export function ranksOf(ids, links) {
  const set = new Set(ids), out = {}, indeg = {};
  for (const id of ids) { out[id] = []; indeg[id] = 0; }
  const seen = new Set();
  for (const [a, b] of links) {
    if (a === b || !set.has(a) || !set.has(b) || seen.has(a + '\0' + b)) continue;
    seen.add(a + '\0' + b); out[a].push(b); indeg[b]++;
  }
  const state = {}, back = new Set();
  const visit = id => {
    state[id] = 1;
    for (const to of out[id]) {
      if (state[to] === 1) back.add(id + '\0' + to);
      else if (!state[to]) visit(to);
    }
    state[id] = 2;
  };
  // 入口（入る接続のない部品）から先に調べると、戻り辺が「上流へ戻る向き」になる
  ids.filter(id => !indeg[id]).forEach(id => state[id] || visit(id));
  ids.forEach(id => state[id] || visit(id));
  const rank = Object.fromEntries(ids.map(id => [id, 0]));
  const edges = [...seen].map(k => k.split('\0')).filter(([a, b]) => !back.has(a + '\0' + b));
  for (let i = 0; i <= ids.length; i++) {
    let changed = false;
    for (const [a, b] of edges) if (rank[b] < rank[a] + 1) { rank[b] = rank[a] + 1; changed = true; }
    if (!changed) break;
  }
  return rank;
}

/* ---------- 役割 ---------- */
export function roleOf({ kind, svc, label } = {}) {
  if (ACTOR_KINDS.has(kind)) return 'actor';
  const runs = kind === 'worker' || kind === 'host'; // 実行する部品は、名前にカタログ・認証があっても処理
  if (!runs && svc && CTRL_SVC.test(String(svc).split(':').pop())) return 'ctrl'; // 「提供元:サービス」のサービス側だけ見る
  if (!runs && label && CTRL_LABEL.test(label)) return 'ctrl';
  if (kind === 'service') return (svc && COMPUTE_SVC.test(svc)) || (label && COMPUTE_LABEL.test(label)) ? 'proc' : 'ctrl';
  if (CTRL_KINDS.has(kind)) return 'ctrl';
  if (DATA_KINDS.has(kind)) return 'data';
  return 'proc';
}

/* ---------- 配置の本体 ---------- */
function crossings(segs) {
  let n = 0;
  const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [p, q] = segs[i], [r, s] = segs[j];
    if (p === r || p === s || q === r || q === s) continue;
    if (p.z !== r.z) continue;
    if (ccw(p, q, r) * ccw(p, q, s) < 0 && ccw(r, s, p) * ccw(r, s, q) < 0) n++;
  }
  return n;
}

/* frames: 枠（tier）の配列、nodes: { id: {tier, x, y} }（どちらも書き換える）。rank: { id: 段 }
 * localFrames に含まれる枠は枠の中だけで段を詰め、それ以外は全体で同じ段を同じ x に置く。leftmost はいちばん左に置く枠 */
function arrange(frames, nodes, rank, links, { localFrames = new Set(), leftmost = null, globalX = false } = {}) {
  const byId = Object.fromEntries(frames.map(t => [t.id, t]));
  const members = Object.fromEntries(frames.map(t => [t.id, []]));
  for (const id of Object.keys(nodes)) members[nodes[id].tier]?.push(id);
  const origAbs = {};
  for (const id of Object.keys(nodes)) { const t = byId[nodes[id].tier]; origAbs[id] = { x: (t.origin?.[0] || 0) + nodes[id].x, y: (t.origin?.[1] || 0) + nodes[id].y }; }
  const origW = {};
  for (const t of frames) origW[t.id] = Math.max(t.size?.[0] || 0, ...members[t.id].map(id => nodes[id].x + 1), 1);

  // 1. 枠の中の x
  const globalRanks = [...new Set(Object.keys(nodes).filter(id => globalX && !localFrames.has(nodes[id].tier)).map(id => rank[id]))].sort((a, b) => a - b);
  const width = {}, cols = {};
  for (const t of frames) {
    const ids = members[t.id]; if (!ids.length) continue;
    const local = [...new Set(ids.map(id => rank[id]))].sort((a, b) => a - b);
    const order = globalX && !localFrames.has(t.id) ? globalRanks : local;
    cols[t.id] = new Map(local.map(r => [r, []]));
    for (const id of ids) {
      nodes[id].x = +(X0 + order.indexOf(rank[id]) * STEP_X).toFixed(2);
      cols[t.id].get(rank[id]).push(id);
    }
    width[t.id] = Math.max(...ids.map(id => nodes[id].x)) + X0;
  }

  // 2. 同じ高さ（z）で左右に並ぶ枠のまとまりを、段の平均の順に並べ直す。上下に重なる枠は 1 つのまとまりとして動かす
  const zKey = t => t.z ?? `auto:${t.id}`;
  const groups = new Map();
  for (const t of frames) { if (!members[t.id].length) continue; const k = zKey(t); (groups.get(k) || groups.set(k, []).get(k)).push(t); }
  for (const list of groups.values()) {
    const span = t => [t.origin?.[0] || 0, (t.origin?.[0] || 0) + origW[t.id]];
    const clusters = [];
    for (const t of list) {
      const hit = clusters.filter(c => c.tiers.some(u => { const [a, b] = span(t), [c0, c1] = span(u); return a < c1 && c0 < b; }));
      const merged = { tiers: [t] };
      for (const c of hit) { merged.tiers.push(...c.tiers); clusters.splice(clusters.indexOf(c), 1); }
      clusters.push(merged);
    }
    for (const c of clusters) {
      c.x0 = Math.min(...c.tiers.map(t => t.origin?.[0] || 0));
      c.width = Math.max(...c.tiers.map(t => (t.origin?.[0] || 0) - c.x0 + width[t.id]));
      const ids = c.tiers.flatMap(t => members[t.id]);
      c.mean = ids.reduce((s, id) => s + rank[id], 0) / ids.length;
      c.left = leftmost && c.tiers.some(t => t.id === leftmost);
    }
    if (clusters.length > 1) {
      const pinned = clusters.find(c => c.left), rest = clusters.filter(c => c !== pinned);
      const sorted = [...rest].sort((a, b) => (a.mean - b.mean) || (a.x0 - b.x0));
      let x = Math.min(...rest.map(c => c.x0));
      const move = (c, to) => { const shift = to - c.x0; for (const t of c.tiers) t.origin = [(t.origin?.[0] || 0) + shift, t.origin?.[1] || 0]; };
      // 左端に固定する枠は、ほかの枠の左隣に置く（ほかの高さの枠の原点は動かさない）
      if (pinned) move(pinned, x - pinned.width - GAP_FRAME);
      for (const c of sorted) { move(c, x); x += c.width + GAP_FRAME; }
    }
    // 上下に重なる枠は、新しい高さに合わせて下へずらす（後で高さが決まるので、ここでは slots から見積もる）
    for (const c of clusters) {
      c.tiers.sort((a, b) => (a.origin?.[1] || 0) - (b.origin?.[1] || 0));
    }
    list.clusters = clusters;
  }

  // 3. 枠の中の y：同じ段の部品は、元の y の順で等間隔の「席」に置く（席は部品数＋2。空き席へ逃がせる）
  const slotOf = {}, slotsN = {};
  for (const t of frames) {
    const ids = members[t.id]; if (!ids.length) continue;
    const maxCol = Math.max(...[...cols[t.id].values()].map(c => c.length));
    const M = maxCol + 2; slotsN[t.id] = M;
    for (const col of cols[t.id].values()) {
      col.sort((a, b) => origAbs[a].y - origAbs[b].y || a.localeCompare(b));
      const first = Math.floor((M - col.length) / 2);
      col.forEach((id, i) => { slotOf[id] = first + i; });
    }
    t.__h = Math.max(t.size?.[1] || 0, M * STEP_Y);
  }
  // 上下に重なる枠を、高さに合わせて重ならないように積み直す
  for (const list of groups.values()) for (const c of list.clusters) {
    let end = -Infinity;
    for (const t of c.tiers) {
      const oy = Math.max(t.origin?.[1] || 0, end === -Infinity ? -Infinity : end + 1.5);
      if (c.tiers.length > 1 || t.origin) t.origin = [t.origin?.[0] || 0, oy];
      end = oy + t.__h;
    }
  }
  const yOf = id => { const t = byId[nodes[id].tier]; return (t.__h / 2 + (slotOf[id] - (slotsN[nodes[id].tier] - 1) / 2) * STEP_Y); };
  const place = () => { for (const id of Object.keys(slotOf)) nodes[id].y = yOf(id); };
  place();

  // 4. 接続線が無関係な部品の上を通らないよう、同じ段の中で席を入れ替える
  const tierOf = id => byId[nodes[id].tier];
  const ids = Object.keys(slotOf);
  const idSet = new Set(ids);
  const L = [], seen = new Set();
  for (const [a, b] of links) if (a !== b && idSet.has(a) && idSet.has(b) && !seen.has(a + '\0' + b)) { seen.add(a + '\0' + b); L.push([a, b]); }
  const pos = {};
  const upd = id => { const t = tierOf(id); pos[id] = { x: (t.origin?.[0] || 0) + nodes[id].x, y: (t.origin?.[1] || 0) + nodes[id].y, z: t.z || 0 }; };
  ids.forEach(upd);
  const cost = () => {
    const segs = L.filter(([a, b]) => pos[a].z === pos[b].z).map(([a, b]) => [pos[a], pos[b]]);
    let len = 0; for (const [p, q] of segs) len += Math.abs(p.y - q.y);
    return jumpCount(pos, L) * 1000 + crossings(segs) * 3 + len * 0.05;
  };
  let best = cost();
  for (let pass = 0; pass < 8; pass++) {
    let improved = false;
    for (const id of ids) {
      const t = tierOf(id), M = slotsN[t.id], mine = slotOf[id];
      const col = cols[t.id].get(rank[id]);
      for (let s = 0; s < M; s++) {
        if (s === mine) continue;
        const other = col.find(o => o !== id && slotOf[o] === s);
        const cur = slotOf[id];
        slotOf[id] = s; if (other) slotOf[other] = cur;
        nodes[id].y = yOf(id); upd(id); if (other) { nodes[other].y = yOf(other); upd(other); }
        const c = cost();
        if (c < best - 1e-9) { best = c; improved = true; break; }
        slotOf[id] = cur; if (other) slotOf[other] = s;
        nodes[id].y = yOf(id); upd(id); if (other) { nodes[other].y = yOf(other); upd(other); }
      }
    }
    if (!improved) break;
  }

  // 5. 席の余りを詰めて、枠の大きさ（size）を部品に合わせる。座標が絶対位置で変わらないよう、原点側で吸収する
  for (const t of frames) {
    const m = members[t.id]; if (!m.length) continue;
    const lo = Math.min(...m.map(id => slotOf[id])), hi = Math.max(...m.map(id => slotOf[id]));
    const d = lo * STEP_Y - 1.2, hasOrigin = !!t.origin;
    for (const id of m) nodes[id].y = +(yOf(id) - d).toFixed(2);
    if (hasOrigin) t.origin = [+t.origin[0].toFixed(2), +(t.origin[1] + d).toFixed(2)];
    t.size = [+Math.max(3, width[t.id]).toFixed(2), +Math.max(2, (hi - lo) * STEP_Y + 2.4).toFixed(2)];
    delete t.__h;
  }
  return best;
}

/* 枠の座標が変わると、明示した外枠の矩形は部品からずれる。矩形は捨て、部品から描画側に求めさせる */
function fixGroups(groups, tierOf) {
  return (groups || []).map(g => {
    const c = { ...g };
    delete c.x0; delete c.y0; delete c.x1; delete c.y1;
    if (!c.tier && c.nodes?.length) c.tier = [...new Set(c.nodes.map(tierOf).filter(Boolean))];
    return c;
  });
}
const hasRect = groups => (groups || []).some(g => [g.x0, g.y0, g.x1, g.y1].some(Number.isFinite));

/* ---------- layout-flow ---------- */
export function flowLayout(layout, links, groupsFallback) {
  const ids = Object.keys(layout.nodes || {}).filter(id => layout.tiers.some(t => t.id === layout.nodes[id].tier));
  if (ids.length < 2) return false;
  const nodes = Object.fromEntries(ids.map(id => [id, layout.nodes[id]]));
  const origTier = id => layout.nodes[id]?.tier;
  const groups = layout.groups ?? groupsFallback;
  const rank = ranksOf(ids, links);
  arrange(layout.tiers, nodes, rank, links);
  if (hasRect(groups)) layout.groups = fixGroups(groups, origTier);
  return true;
}

/* ---------- layout-layers ---------- */
export function layerLayout(layout, info, links, groupsFallback) {
  const ids = Object.keys(layout.nodes || {});
  if (ids.length < 6 || ids.some(id => !layout.tiers.some(t => t.id === layout.nodes[id].tier))) return false;
  const role = Object.fromEntries(ids.map(id => [id, roleOf(info[id])]));
  const present = ['ctrl', 'proc', 'data'].filter(r => ids.some(id => role[id] === r));
  if (present.length < 2) return false;
  const actors = ids.filter(id => role[id] === 'actor');
  const origTier = Object.fromEntries(ids.map(id => [id, layout.nodes[id].tier]));
  const rank = ranksOf(ids, links);
  const base = Math.min(...layout.tiers.map(t => t.z ?? 0));
  const frames = present.map((r, i) => ({ id: `lab-${r}`, label: LAYER_LABEL[r], z: base + present.length - 1 - i, origin: [0, 0], size: [3, 2], __role: r }));
  const zActors = base + present.length - 1 - Math.max(0, present.indexOf('proc'));
  if (actors.length) frames.unshift({ id: 'lab-actors', label: '利用者・外部', kind: 'origin', z: zActors, origin: [-60, 0], size: [3, 2] });
  const nodes = {};
  for (const id of ids) {
    nodes[id] = layout.nodes[id];
    nodes[id].tier = role[id] === 'actor' ? 'lab-actors' : `lab-${role[id]}`;
  }
  arrange(frames, nodes, rank, links, { localFrames: new Set(['lab-actors']), leftmost: actors.length ? 'lab-actors' : null, globalX: true });
  for (const f of frames) delete f.__role;
  // 利用者・外部の枠は、ほかの枠の左隣（原点 x = 0）に置く
  const actorFrame = frames.find(f => f.id === 'lab-actors');
  if (actorFrame) actorFrame.origin = [-(actorFrame.size[0] + GAP_FRAME), actorFrame.origin[1]];
  const floorOf = Object.fromEntries(ids.map(id => [id, nodes[id].tier]));
  const groups = (layout.groups ?? groupsFallback ?? []).map(g => {
    const c = { ...g }; delete c.x0; delete c.y0; delete c.x1; delete c.y1;
    const list = (c.nodes || ids.filter(id => [].concat(g.tier).includes(origTier[id]))).filter(id => floorOf[id]);
    c.nodes = list; c.tier = [...new Set(list.map(id => floorOf[id]))];
    return c;
  }).filter(g => g.nodes.length);
  layout.tiers = frames;
  layout.groups = groups;
  return true;
}

/* ---------- モデル全体 ---------- */
function linksOf(model, impl) {
  const real = {};
  for (const [id, n] of Object.entries(impl.nodes || {})) for (const r of [].concat(n.realizes || [])) (real[r] ||= []).push(id);
  const out = [];
  for (const l of model.links || []) for (const a of real[l.from] || []) for (const b of real[l.to] || []) out.push([a, b]);
  for (const l of impl.links || []) out.push([l.from, l.to]);
  return out;
}

/* model を直接書き換える（呼び出し側がコピーを渡す）。戻り値は補正した図の数 */
export function transformModel(model, { flow = false, layers = false } = {}) {
  let n = 0;
  if (flow && model.tiers && model.nodes) {
    const common = { tiers: model.tiers, nodes: model.nodes, groups: model.groups };
    if (flowLayout(common, (model.links || []).map(l => [l.from, l.to]))) { n++; if (common.groups !== model.groups) model.groups = common.groups; }
  }
  for (const impl of model.implementations || []) {
    const links = linksOf(model, impl);
    for (const view of ['layout3d', 'layout2d']) {
      const layout = impl[view];
      if (!layout?.tiers || !layout?.nodes) continue;
      let done = false;
      if (layers && view === 'layout3d') {
        const info = Object.fromEntries(Object.entries(impl.nodes || {}).map(([id, nd]) => {
          const base = model.nodes?.[[].concat(nd.realizes || [])[0]] || {};
          return [id, { kind: nd.kind || base.kind, svc: nd.svc, label: nd.label }];
        }));
        done = layerLayout(layout, info, links, impl.groups);
      }
      if (!done && flow) done = flowLayout(layout, links, impl.groups);
      if (done) n++;
    }
  }
  return n;
}

/* app.js から呼ぶ。フラグが無ければ入力をそのまま返す */
export function labLayout(entry) {
  const flow = lab('layout-flow'), layers = lab('layout-layers');
  if (!flow && !layers) return entry;
  const model = structuredClone(entry.model);
  transformModel(model, { flow, layers });
  return { ...entry, model };
}
