/* DeepDiverDown viewer：YAML モデルを読み込み、Three.js の 3D 図と各モードのパネルを描く */
import { Scene3D } from './scene3d.js';

const $ = id => document.getElementById(id);
const FH = 4; // フロア 1 段の高さ（ワールド単位）

/* ---------- データ読込 ---------- */
const REGISTRY = await (await fetch('models/registry.json')).json();
const KEY = REGISTRY.some(r => r.id === location.hash.slice(1)) ? location.hash.slice(1) : REGISTRY[0].id;
const ENTRY = REGISTRY.find(r => r.id === KEY);
const loadYaml = async p => jsyaml.load(await (await fetch(p)).text());
const M = await loadYaml(`models/${KEY}/model.yaml`);
const A = ENTRY.actual ? await loadYaml(`models/${KEY}/actual.yaml`) : null;
const NAMES = Object.fromEntries(await Promise.all(REGISTRY.map(async r => [r.id, r.id === KEY ? M.name : (await loadYaml(`models/${r.id}/model.yaml`)).name])));
const DOCS = {};
for (const src of M.sources || []) { const r = await fetch(src); if (r.ok) DOCS[src] = Analyze.parseSections(await r.text()); }
addEventListener('hashchange', () => location.reload());

const PIPE = M.type === 'pipeline';
const METRICS = M.metrics || [['p95', 'p95 レイテンシ', 'ms'], ['cost', '月額コスト', '$'], ['rps', 'RPS', 'rps']];
const ISSUES = Analyze.lint(M), DIFF = Analyze.diff(M, A);
const GATES = Analyze.gates(M, A, DOCS), CLS = GATES.cls, COV = GATES.cov, IDX = Analyze.index(M);
const REQ_KIND = { usecase: 'ユースケース', rule: '業務ルール', state: '状態遷移', nfr: '非機能要件' };
const ROLES = {
  user: { label: '利用者', c: '#2E73B8' }, dev: { label: '開発者', c: '#3F8624' }, approver: { label: '承認者', c: '#C98A12' },
  ops: { label: '運用者', c: '#8C4FFF' }, admin: { label: '管理者', c: '#6d6a63' }, attacker: { label: '攻撃者', c: '#C8321F' },
};

const st = { mode: 'struct', sel: null, scen: 0, step: 0, down: [], issue: null, req: null, metric: METRICS[0][0], play: null };
const MODES = [
  ['struct', '構造'], ['scenario', 'シナリオ'], ['fail', '障害シミュレーション'], ['lint', '指摘', ISSUES.length],
  ['metric', 'メトリクス'], ['evidence', '根拠と確度', GATES.pass ? 0 : GATES.results.filter(r => !r.pass).length], M.requirements && ['req', '要件', M.requirements.length],
].filter(Boolean);

/* ---------- 座標 ---------- */
const TI = id => M.tiers.find(t => t.id === id) || {};
const STACK = M.tiers.filter(t => t.z == null);
const zOf = tier => TI(tier).z ?? (STACK.length - 1 - STACK.findIndex(t => t.id === tier));
const off = tier => TI(tier).origin || [0, 0];
const sizeOf = tier => TI(tier).size || [10, 4];
const W = (gx, gy, tier) => [gx + off(tier)[0], zOf(tier) * FH, gy + off(tier)[1]];
const allNodes = () => st.mode === 'evidence' ? { ...M.nodes, ...DIFF.extraNodes } : M.nodes;
const allLinks = () => st.mode === 'evidence' ? [...M.links, ...DIFF.extraLinks] : M.links;

function route(l) {
  const N = allNodes(), a = N[l.from], b = N[l.to];
  const [ax, ay, az] = W(a.x, a.y, a.tier), [bx, by, bz] = W(b.x, b.y, b.tier);
  const o = allLinks().some(x => x.from === l.to && x.to === l.from) && l.from > l.to ? 0.25 : 0, Y = 0.04;
  let p;
  if (ay === by) p = ax === bx || az === bz ? [[ax, ay, az], [bx, by, bz]] : [[ax, ay, az], [(ax + bx) / 2, ay, az], [(ax + bx) / 2, by, bz], [bx, by, bz]];
  else p = [[ax, ay, az], [bx, ay, az], [bx, ay, bz], [bx, by, bz]];
  return p.map(([x, y, z]) => [x + o, y + Y, z + o]);
}

/* ---------- モード → 見た目 ---------- */
function decorate() {
  const N = allNodes(), ns = {}, ls = {};
  Object.keys(N).forEach(id => ns[id] = {});
  allLinks().forEach(l => ls[l.id] = {});
  const focus = (nodes = [], links = []) => {
    Object.keys(ns).forEach(id => nodes.includes(id) ? ns[id].outline = true : ns[id].dim = true);
    allLinks().forEach(l => links.includes(l.id) ? Object.assign(ls[l.id], { on: true, color: '--accent' }) : ls[l.id].dim = true);
  };
  Object.entries(N).forEach(([id, n]) => { if ((n.replicas ?? 1) > 1 && n.replicas < 99) ns[id].badge = { text: `×${n.replicas}` }; });

  if (st.mode === 'scenario') {
    const sc = M.scenarios[st.scen], used = new Set(sc.steps.flatMap(s => s.links)), cur = sc.steps[st.step].links;
    allLinks().forEach(l => { if (!used.has(l.id)) ls[l.id].dim = true; });
    cur.forEach(id => Object.assign(ls[id], { on: true, color: '--ink', packets: true }));
    const touch = new Set([...used].flatMap(id => { const l = M.links.find(x => x.id === id); return [l.from, l.to]; }));
    Object.keys(ns).forEach(id => { if (!touch.has(id)) ns[id].dim = true; });
    cur.forEach(id => ns[M.links.find(x => x.id === id).to].outline = true);
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
    if (st.issue != null) focus(ISSUES[st.issue].nodes, ISSUES[st.issue].links);
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
    Object.entries(N).forEach(([id]) => {
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
    const q = M.requirements.find(x => x.id === st.req), sc = q.scenario && M.scenarios.find(s => s.id === q.scenario);
    const links = [...(q.links || []), ...(sc ? sc.steps.flatMap(s => s.links) : [])];
    const nodes = [...(q.nodes || []), ...links.flatMap(id => { const l = M.links.find(x => x.id === id); return [l.from, l.to]; })];
    focus(nodes, links);
    links.forEach(id => ls[id].packets = true);
  }
  if (st.sel && ns[st.sel]) ns[st.sel].outline = true;
  return { ns, ls };
}
const fmt = (k, v) => { const u = (METRICS.find(x => x[0] === k) || [])[2] || ''; return u === '$' ? `$${v}` : `${v}${u}`; };

/* ---------- 3D 描画 ---------- */
const scene = new Scene3D($('view'), { onPick: id => onPick(id) });

function nodeSpec(id, n, s) {
  const svc = n.svc && window.AWS?.[n.svc];
  const shape = n.kind === 'actor' ? 'person' : svc?.shape === 'cyl' || ['db', 'cache'].includes(n.kind) ? 'cyl' : svc?.shape === 'queue' || n.kind === 'queue' ? 'queue' : 'box';
  const ext = n.kind === 'external' && !svc;
  let color = scene.color('--paper'), opacity = s.dim ? 0.15 : 1, dashed = ext;
  if (n.kind === 'actor') color = scene.mix((ROLES[n.role] || ROLES.user).c, '--paper', 0.5);
  else if (svc) color = scene.mix(AWS_CAT[svc.cat], '--paper', 0.42);
  else if (['db', 'queue', 'cache'].includes(n.kind)) color = scene.color('--dark');
  if (ext) opacity = Math.min(opacity, 0.35);
  if (s.fill === 'down') color = scene.color('--accent');
  if (s.fill === 'impact') color = scene.mix('--accent', '--paper', 0.38);
  if (s.fill === 'delay') color = scene.mix('--warn', '--paper', 0.38);
  if (s.heat != null) color = scene.mix('--accent', '--paper', s.heat * 0.85);
  if (s.status === 'claim') { opacity = Math.min(opacity, 0.55); dashed = true; }
  if (s.status === 'unknown') { opacity = Math.min(opacity, 0.22); dashed = true; }
  if (s.status === 'drift') s.outline = true;
  return {
    id, shape, color, opacity, dashed, outline: !!s.outline, h: s.h || (n.kind === 'client' ? 0.7 : 1), pos: W(n.x, n.y, n.tier),
    label: n.label, labelAccent: s.fill === 'down', badge: s.badge, abbr: svc && { text: svc.abbr, color: AWS_CAT[svc.cat] },
  };
}

function draw() {
  const { ns, ls } = decorate(), N = allNodes();
  scene.begin();
  for (const t of M.tiers) {
    const [w, h] = sizeOf(t.id), [ox, oz] = off(t.id), y = zOf(t.id) * FH;
    const x0 = ox - 1.2, x1 = ox + w + 0.4, z0 = oz - 1.2, z1 = oz + h + 0.2;
    scene.floor({ x0, z0, x1, z1, y, origin: t.kind === 'origin', label: t.label, labelAt: t.origin ? [x0, y, z1] : [x1, y, z0] });
  }
  for (const gr of M.groups || []) for (const t of [].concat(gr.tier)) {
    const y = zOf(t) * FH, [ox, oz] = off(t);
    scene.group({ y, kind: gr.kind, label: gr.label, pts: [[gr.x0 + ox, gr.y0 + oz], [gr.x1 + ox, gr.y0 + oz], [gr.x1 + ox, gr.y1 + oz], [gr.x0 + ox, gr.y1 + oz]] });
  }
  for (const l of allLinks()) {
    const s = ls[l.id];
    scene.link({ points: route(l), color: s.color || (s.on ? '--ink' : '--mute'), thick: !!s.on, packets: !!s.packets,
      dashed: s.dashed || (!l.sync ? 'dash' : null), opacity: s.dim ? 0.12 : s.on ? 1 : 0.55 });
  }
  for (const [id, n] of Object.entries(N)) scene.node(nodeSpec(id, n, ns[id]));
  scene.end();
  renderStats(); renderPanel();
}

/* ---------- 統計・凡例 ---------- */
const stat = (lab, v, bad) => `<div class="stat ${bad ? 'bad' : ''}"><small>${lab}</small><b>${v}</b></div>`;
const count = (o, s) => Object.values(o).filter(r => r.status === s).length;
function renderStats() {
  let h = '';
  if (st.mode === 'struct') h = stat('ノード', Object.keys(M.nodes).length) + stat('同期 / 非同期', `${M.links.filter(l => l.sync).length} / ${M.links.filter(l => !l.sync).length}`) + stat('指摘', ISSUES.length, 1) + stat('点検', GATES.pass ? '合格' : '不合格', !GATES.pass);
  if (st.mode === 'scenario') { const sc = M.scenarios[st.scen], p = syncP95(sc); h = stat('シナリオ', sc.label) + stat('ステップ', `${st.step + 1} / ${sc.steps.length}`) + (PIPE ? '' : stat('同期経路 p95 合計', `${p} ms`, p > 1000)); }
  if (st.mode === 'fail') { const r = Analyze.impact(M, st.down); h = stat('停止', st.down.length, st.down.length) + stat('影響', r.impacted.length, r.impacted.length) + stat('滞留', r.delayed.length) + stat('止まるシナリオ', `${r.brokenScenarios.length} / ${M.scenarios.length}`, r.brokenScenarios.length); }
  if (st.mode === 'lint') h = stat('重大', ISSUES.filter(i => i.sev === 'high').length, 1) + stat('注意', ISSUES.filter(i => i.sev === 'mid').length);
  if (st.mode === 'metric') { const vs = Object.values(M.nodes).map(n => n.metrics?.[st.metric]).filter(v => v != null), sum = ['cost', 'duration'].includes(st.metric); h = stat('指標', METRICS.find(x => x[0] === st.metric)[1]) + stat(sum ? '合計' : '最大', fmt(st.metric, sum ? vs.reduce((a, b) => a + b, 0) : Math.max(...vs))); }
  if (st.mode === 'evidence') { const all = { ...CLS.nodes, ...CLS.links }; h = stat('事実', count(all, 'fact')) + stat('主張', count(all, 'claim')) + stat('不明', count(all, 'unknown'), count(all, 'unknown')) + stat('ずれ', CLS.drifts.length, CLS.drifts.length) + stat('網羅率', `${Math.round(COV.covered / COV.total * 100)}%`, COV.covered < COV.total); }
  if (st.mode === 'req') h = Object.entries(REQ_KIND).map(([k, n]) => stat(n, M.requirements.filter(q => q.kind === k).length)).join('');
  $('stats').innerHTML = h;
  $('legend').innerHTML = (st.mode === 'evidence'
    ? '<span><i></i>事実（実装で確認）</span><span><i style="border-top-style:dashed"></i>主張（設計書のみ）</span><span><i style="border-top:2px dotted var(--warn)"></i>不明</span><span><i style="border-color:var(--accent)"></i>ずれ</span>'
    : '<span><i></i>同期</span><span><i style="border-top-style:dashed"></i>非同期</span>' + (st.mode === 'fail' ? '<span><i style="border-color:var(--accent)"></i>失敗する呼び出し</span>' : ''));
}
function syncP95(sc) {
  const ids = new Set(sc.steps.flatMap(s => s.links).map(id => M.links.find(l => l.id === id)).filter(l => l.sync).map(l => l.to));
  return [...ids].reduce((s, id) => s + (M.nodes[id].metrics?.p95 || 0), 0);
}

/* ---------- パネル ---------- */
const tag = s => `<span class="tag st-${s}">${Analyze.STATUS[s]}</span>`;
const evList = ev => (ev || []).map(e => `<div class="ev"><span class="mono">${e.type}</span> ${e.at || e.ref}${e.says ? ` <span class="mono" style="color:var(--accent)">says ${JSON.stringify(e.says)}</span>` : ''}</div>`).join('') || '<div class="sub">根拠なし</div>';

function nodeDetail(id) {
  const n = allNodes()[id], ins = allLinks().filter(l => l.to === id), outs = allLinks().filter(l => l.from === id);
  const iss = ISSUES.filter(i => i.nodes.includes(id)), c = CLS.nodes[id];
  const kind = n.kind === 'actor' ? `登場人物：${(ROLES[n.role] || ROLES.user).label}${n.team ? `（${n.team}・${n.headcount ?? 1}名）` : ''}` : n.svc && window.AWS?.[n.svc] ? AWS[n.svc].name : n.kind;
  const ln = l => `${allNodes()[l.from].label} → ${allNodes()[l.to].label} <span class="mono" style="color:var(--mute)">${l.sync ? 'sync' : 'async'}${l.timeoutMs ? ' ' + l.timeoutMs / 1000 + 's' : ''}${l.retry ? ' retry' + l.retry : ''}</span> ${CLS.links[l.id] ? tag(CLS.links[l.id].status) : ''}`;
  const reqs = (M.requirements || []).filter(q => q.nodes?.includes(id));
  return `<h4>選択中のノード</h4><h3>${n.label}</h3><div class="sub">${kind}${n.az ? ` / AZ ${n.az.join(',')}` : ''}${n.subnet ? ` / ${n.subnet} subnet` : ''} / ${TI(n.tier).label || ''}</div>
    ${c ? `<div class="row">${tag(c.status)}<span class="sub" style="margin:0">${c.why}</span></div>` : ''}
    <table class="kv"><tr><td>台数</td><td>${n.replicas ?? '—'}</td></tr>${Object.entries(n.metrics || {}).map(([k, v]) => `<tr><td>${k}</td><td>${fmt(k, v)}</td></tr>`).join('')}</table>
    <h4>根拠</h4>${evList(n.evidence)}
    <h4>呼び出し元</h4>${ins.map(l => `<div class="item">${ln(l)}</div>`).join('') || '<div class="sub">なし</div>'}
    <h4>呼び出し先</h4>${outs.map(l => `<div class="item">${ln(l)}</div>`).join('') || '<div class="sub">なし</div>'}
    ${reqs.length ? '<h4>関係する要件</h4>' + reqs.map(q => `<div class="item" data-req="${q.id}"><b class="mono">${q.id}</b> ${q.title}</div>`).join('') : ''}
    ${iss.length ? '<h4>関連する指摘</h4>' + iss.map(i => `<div class="item"><span class="tag ${i.sev}">${i.title}</span><p>${i.msg}</p></div>`).join('') : ''}`;
}

function evidencePanel() {
  const group = s => [...Object.entries(CLS.nodes).filter(([, r]) => r.status === s).map(([id, r]) => ({ id, label: M.nodes[id].label, why: r.why, sel: id })),
    ...Object.entries(CLS.links).filter(([, r]) => r.status === s).map(([id, r]) => { const l = M.links.find(x => x.id === id); return { id, label: `${M.nodes[l.from].label} → ${M.nodes[l.to].label}`, why: r.why, sel: l.from }; })];
  const list = s => group(s).map(x => `<div class="item" data-sel="${x.sel}">${tag(s)}<b>${x.label}</b> <span class="sub">${x.why}</span></div>`).join('') || '<div class="sub">なし</div>';
  return `<h3>根拠と確度</h3><div class="sub">すべての要素に根拠を付け、実装（IaC・コード・実環境）で裏が取れたものだけを「事実」とする。合否は点検（gates）で判定。</div>
    <h4>点検 ${GATES.pass ? '<span class="tag ok">合格</span>' : '<span class="tag high">不合格</span>'}</h4>
    ${GATES.results.map(r => `<details class="gate"><summary><span class="tag ${r.pass ? 'ok' : 'high'}">${r.pass ? 'OK' : 'NG'}</span>${r.label} <span class="sub">${r.detail}</span></summary>${r.items.map(x => `<p>${x}</p>`).join('') || '<p class="sub">該当なし</p>'}</details>`).join('')}
    <h4>網羅率 ${COV.covered} / ${COV.total}</h4><div class="bar" style="width:${COV.covered / COV.total * 100}%"></div>
    ${COV.missing.map(x => `<div class="item"><span class="tag mid">未対応</span>${x.label} <span class="sub">${x.kind}</span></div>`).join('')}
    <h4>ずれ</h4>${CLS.drifts.map(d => `<div class="item">${tag('drift')}<p>${d.msg}</p></div>`).join('') || '<div class="sub">なし</div>'}
    <h4>不明（登録済み）</h4>${(M.unknowns || []).map(u => `<div class="item"><b class="mono">${u.id}</b> ${u.text} <span class="sub">${(u.refs || []).join(', ')}</span></div>`).join('') || '<div class="sub">なし</div>'}
    <h4>主張（設計書の記述のみ）</h4>${list('claim')}
    <details class="gate"><summary>逆引き索引（参照先 → 要素）</summary>${Object.entries(IDX.byRef).map(([k, ids]) => `<p><span class="mono">${k}</span><br>→ ${ids.join(', ')}</p>`).join('')}</details>`;
}

function reqPanel() {
  if (st.req) {
    const q = M.requirements.find(x => x.id === st.req), c = CLS.reqs[q.id];
    return `<button class="b" data-req="">← 一覧</button><h4>${REQ_KIND[q.kind]}</h4><h3><span class="mono">${q.id}</span> ${q.title}</h3>
      <div class="row">${tag(c.status)}<span class="sub" style="margin:0">${c.why}</span></div>
      <div class="note">${q.text}</div>
      ${q.states ? `<h4>状態</h4><div class="states">${q.states.map(s => `<span>${s}</span>`).join('<i>→</i>')}</div>` : ''}
      <h4>根拠</h4>${evList(q.evidence)}
      <h4>紐付く構成要素</h4>${[...(q.nodes || []).map(id => M.nodes[id].label), ...(q.links || []).map(id => { const l = M.links.find(x => x.id === id); return `${M.nodes[l.from].label} → ${M.nodes[l.to].label}`; }), q.scenario && `シナリオ：${M.scenarios.find(s => s.id === q.scenario).label}`].filter(Boolean).map(x => `<div class="item">${x}</div>`).join('')}
      ${(M.unknowns || []).filter(u => u.refs?.includes(q.id)).map(u => `<div class="item"><span class="tag mid">不明</span>${u.text}</div>`).join('')}`;
  }
  return `<h3>要件（技術に依存しない層）</h3><div class="sub">業務ルール・ユースケース・状態遷移・非機能要件。作り直しや移行のときは、構成ではなくこちらを入力にする。クリックで関係する構成を強調。</div>` +
    Object.entries(REQ_KIND).map(([k, n]) => { const qs = M.requirements.filter(q => q.kind === k); return qs.length ? `<h4>${n}</h4>` + qs.map(q => `<div class="item" data-req="${q.id}"><b class="mono">${q.id}</b> ${q.title} ${tag(CLS.reqs[q.id].status)}</div>`).join('') : ''; }).join('');
}

function renderPanel() {
  let h = '';
  if (st.mode === 'struct') h = st.sel ? nodeDetail(st.sel) : `<h3>${M.name}</h3><div class="sub">${(M.sources || []).map(s => `<a href="${s}" target="_blank">${s}</a>`).join(' ')} から抽出したモデル</div>
      ${M.description ? `<p>${M.description}</p>` : ''}<p>左上の「回転／移動」でドラッグの操作を切り替えます（R / M キーでも可）。ホイールで拡大縮小、部品をクリックすると詳細を表示します。</p>
      ${M.review?.length ? '<h4>抽出時のレビューメモ</h4>' + M.review.map(r => `<div class="item"><p>${r}</p></div>`).join('') : ''}`;
  if (st.mode === 'scenario') {
    const sc = M.scenarios[st.scen], s = sc.steps[st.step];
    h = `<div class="row">${M.scenarios.map((x, i) => `<button class="b ${i === st.scen ? 'on' : ''}" data-scen="${i}">${x.label}</button>`).join('')}</div>
      <div class="num">${String(st.step + 1).padStart(2, '0')}</div><div class="sub">${sc.label}</div><div class="note">${s.note}</div>
      <div class="row" style="margin-top:16px"><button class="b" data-step="-1" ${st.step ? '' : 'disabled'}>← 前へ</button><button class="b" data-play>${st.play ? '❚❚ 停止' : '▶ 再生'}</button><button class="b" data-step="1" ${st.step < sc.steps.length - 1 ? '' : 'disabled'}>次へ →</button></div>
      <h4>ステップ</h4>${sc.steps.map((x, i) => `<div class="item ${i === st.step ? 'on' : ''}" data-goto="${i}"><b>${i + 1}.</b> ${x.note}</div>`).join('')}`;
  }
  if (st.mode === 'fail') {
    const r = Analyze.impact(M, st.down);
    h = `<h3>障害シミュレーション</h3><div class="sub">${PIPE ? 'ステージをクリックして失敗させる。後続のステージは実行されなくなります。' : '部品をクリックして停止 / 復旧。同期で依存している部品に影響が伝播します。人物を止めると「不在」を表します。'}</div>
      <div class="row"><button class="b" data-reset>すべて復旧</button>${(M.failPresets || []).filter(id => M.nodes[id]).map(id => `<button class="b" data-down="${id}">${M.nodes[id].label} 停止</button>`).join('')}</div>
      <h4>停止中</h4>${st.down.map(id => `<div class="item"><b>${M.nodes[id].label}</b></div>`).join('') || '<div class="sub">なし</div>'}
      <h4>${PIPE ? '実行されないステージ' : '影響を受ける（同期依存）'}</h4>${r.impacted.map(id => `<div class="item">${M.nodes[id].label}</div>`).join('') || '<div class="sub">なし</div>'}
      <h4>処理が滞留する（非同期）</h4>${r.delayed.map(id => `<div class="item">${M.nodes[id].label}</div>`).join('') || '<div class="sub">なし</div>'}
      <h4>止まるユースケース</h4>${r.brokenScenarios.map(s => `<div class="item"><span class="tag high">停止</span>${s.label}</div>`).join('') || '<div class="sub">なし</div>'}`;
  }
  if (st.mode === 'lint') h = `<h3>指摘 ${ISSUES.length} 件</h3><div class="sub">モデルにルールを当てた結果。クリックで該当箇所を強調。</div>` +
    ISSUES.map((i, k) => `<div class="item ${st.issue === k ? 'on' : ''}" data-issue="${k}"><span class="tag ${i.sev}">${i.title}</span><p>${i.msg}</p></div>`).join('');
  if (st.mode === 'metric') {
    const rows = Object.entries(M.nodes).filter(([, n]) => n.metrics?.[st.metric] != null).sort((a, b) => b[1].metrics[st.metric] - a[1].metrics[st.metric]), max = rows[0]?.[1].metrics[st.metric] || 1;
    h = `<div class="row">${METRICS.map(([k, n]) => `<button class="b ${st.metric === k ? 'on' : ''}" data-metric="${k}">${n}</button>`).join('')}</div><div class="sub">値を立体の高さと色の濃さで表示。</div>` +
      rows.map(([id, n]) => `<div class="item" data-sel="${id}"><b>${n.label}</b> <span class="mono">${fmt(st.metric, n.metrics[st.metric])}</span><div class="bar" style="width:${n.metrics[st.metric] / max * 100}%"></div></div>`).join('');
  }
  if (st.mode === 'evidence') h = evidencePanel();
  if (st.mode === 'req') h = reqPanel();
  if (st.sel && !['struct', 'fail'].includes(st.mode)) h += '<div style="margin-top:24px"></div>' + nodeDetail(st.sel);
  $('panel').innerHTML = h;
}

/* ---------- イベント ---------- */
function onPick(id) {
  if (!id) { if (st.sel) { st.sel = null; draw(); } return; }
  if (st.mode === 'fail' && M.nodes[id]) st.down = st.down.includes(id) ? st.down.filter(x => x !== id) : [...st.down, id];
  else st.sel = st.sel === id ? null : id;
  draw();
}
const renderModes = () => $('modes').innerHTML = MODES.map(([k, n, c]) => `<button data-mode="${k}" class="${st.mode === k ? 'on' : ''}">${n}${c ? `<small>${c}</small>` : ''}</button>`).join('');
const stopPlay = () => { clearInterval(st.play); st.play = null; };

/* ドラッグの役割（回転 / 移動）。選択はブラウザに保存 */
function setDrag(mode) {
  scene.setDragMode(mode);
  document.querySelectorAll('[data-drag]').forEach(b => b.classList.toggle('on', b.dataset.drag === mode));
  $('hint').textContent = mode === 'rotate'
    ? 'ドラッグ：回転 ／ 右ドラッグ：移動 ／ ホイール：拡大縮小 ／ M キーで移動モード'
    : 'ドラッグ：移動 ／ 右ドラッグ：回転 ／ ホイール：拡大縮小 ／ R キーで回転モード';
  try { localStorage.setItem('ddd.drag', mode); } catch {}
}
let saved = 'rotate'; try { saved = localStorage.getItem('ddd.drag') || 'rotate'; } catch {}
setDrag(saved);
addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'r' || e.key === 'R') setDrag('rotate');
  if (e.key === 'm' || e.key === 'M') setDrag('pan');
});

document.addEventListener('click', e => {
  const d = k => e.target.closest(`[data-${k}]`)?.dataset[k];
  if (d('drag')) return setDrag(d('drag'));
  if (d('view')) return d('view') === 'reset' ? scene.fit('iso') : scene.fit(d('view'));
  if (d('mode')) { st.mode = d('mode'); st.sel = null; st.issue = null; st.req = null; stopPlay(); renderModes(); return draw(); }
  if (d('scen') != null) { st.scen = +d('scen'); st.step = 0; stopPlay(); }
  else if (d('step') != null) st.step += +d('step');
  else if (d('goto') != null) st.step = +d('goto');
  else if (e.target.closest('[data-play]')) { if (st.play) stopPlay(); else st.play = setInterval(() => { st.step = (st.step + 1) % M.scenarios[st.scen].steps.length; draw(); }, 2500); }
  else if (e.target.closest('[data-reset]')) st.down = [];
  else if (d('down')) st.down = [...new Set([...st.down, d('down')])];
  else if (d('issue') != null) st.issue = st.issue === +d('issue') ? null : +d('issue');
  else if (d('metric')) st.metric = d('metric');
  else if (d('req') != null) { st.req = d('req') || null; if (st.mode !== 'req') { st.mode = 'req'; renderModes(); } }
  else if (d('sel')) st.sel = d('sel');
  else return;
  draw();
});

$('msel').innerHTML = REGISTRY.map(r => `<option value="${r.id}" ${r.id === KEY ? 'selected' : ''}>${NAMES[r.id]}</option>`).join('');
$('msel').onchange = e => { location.hash = e.target.value; };
document.title = `${M.name} — DeepDiverDown`;
renderModes(); draw();
