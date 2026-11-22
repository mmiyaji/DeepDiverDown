/* DeepDiverDown viewer：フロア式アイソメ描画 + 6モード */
(function () {
  const REG = window.MODELS, KEY = REG[location.hash.slice(1)] ? location.hash.slice(1) : Object.keys(REG)[0];
  const M = REG[KEY].model, A = REG[KEY].actual;
  const PIPE = M.type === 'pipeline';
  const METRICS = M.metrics || [['p95', 'p95 レイテンシ', 'ms'], ['cost', '月額コスト', '$'], ['rps', 'RPS', 'rps']];
  addEventListener('hashchange', () => location.reload());
  const ISSUES = Analyze.lint(M), DIFF = Analyze.diff(M, A);
  const NS = 'http://www.w3.org/2000/svg', $ = id => document.getElementById(id);
  const svg = $('scene');
  const S = 36, FLOOR = 185, OX = 330, OY = 430;

  const st = { mode: 'struct', sel: null, scen: 0, step: 0, down: [], issue: null, metric: METRICS[0][0], play: null };
  const MODES = [
    ['struct', '構造'], ['scenario', 'シナリオ'], ['fail', '障害シミュレーション'],
    ['lint', '指摘', ISSUES.length], ['metric', 'メトリクス'], A && ['diff', '設計と実環境の差分', DIFF.items.length],
  ].filter(Boolean);

  /* ---------- geometry ---------- */
  const zOf = tier => M.tiers.length - 1 - M.tiers.findIndex(t => t.id === tier);
  const P = (x, y, z) => [OX + (x - y) * S * 0.866, OY + (x + y) * S * 0.5 - z * FLOOR];
  const allNodes = () => st.mode === 'diff' ? { ...M.nodes, ...DIFF.extraNodes } : M.nodes;
  const allLinks = () => st.mode === 'diff' ? [...M.links, ...DIFF.extraLinks] : M.links;

  function route(l) {
    const N = allNodes(), a = N[l.from], b = N[l.to], za = zOf(a.tier), zb = zOf(b.tier);
    const rev = allLinks().some(o => o.from === l.to && o.to === l.from) && l.from > l.to ? 0.3 : 0;
    let pts;
    if (za === zb) {
      const mx = (a.x + b.x) / 2;
      pts = a.y === b.y || a.x === b.x ? [[a.x, a.y, za], [b.x, b.y, zb]] : [[a.x, a.y, za], [mx, a.y, za], [mx, b.y, za], [b.x, b.y, zb]];
    } else pts = [[a.x, a.y, za], [b.x, a.y, za], [b.x, b.y, za], [b.x, b.y, zb]];
    return pts.map(([x, y, z]) => P(x + rev, y + rev, z));
  }

  /* ---------- svg helpers ---------- */
  function el(t, a, p) { const e = document.createElementNS(NS, t); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; }
  function label(g, x, y, text, opt = {}) {
    const fs = opt.fs || 11, w = [...text].reduce((s, c) => s + (/[ -~]/.test(c) ? fs * 0.6 : fs), 0) + 16;
    el('rect', { x: x - w / 2, y: y - 10, width: w, height: 20, fill: opt.bg || 'var(--card)', stroke: opt.stroke || 'var(--ink)', 'stroke-width': 1 }, g);
    el('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 600, fill: opt.color || 'var(--fg)' }, g).textContent = text;
  }
  const mix = (pct, base) => `color-mix(in srgb, var(--accent) ${pct}%, var(--${base}))`;

  function tones(kind, state) {
    if (state.fill === 'down') return ['var(--accent)', mix(85, 'dark'), mix(70, 'dark')];
    if (state.fill === 'impact') return [mix(35, 'paper'), mix(30, 'paper-l'), mix(30, 'paper-r')];
    if (state.fill === 'delay') return ['color-mix(in srgb, var(--warn) 30%, var(--paper))', 'color-mix(in srgb, var(--warn) 25%, var(--paper-l))', 'color-mix(in srgb, var(--warn) 25%, var(--paper-r))'];
    if (state.heat != null) { const p = Math.round(state.heat * 85); return [mix(p, 'paper'), mix(p, 'paper-l'), mix(p, 'paper-r')]; }
    return ['db', 'queue', 'cache'].includes(kind) ? ['var(--dark)', 'var(--dark-l)', 'var(--dark-r)'] : ['var(--paper)', 'var(--paper-l)', 'var(--paper-r)'];
  }

  function shape(g, n, x, y, state) {
    const svc = n.svc && window.AWS?.[n.svc], plain = state.fill == null && state.heat == null;
    const kind = svc ? ({ cyl: 'db', queue: 'queue' }[svc.shape] || (n.kind === 'external' ? 'external' : 'service')) : n.kind;
    let [top, l, r] = tones(kind, state);
    const h = state.h || (kind === 'client' ? 26 : 36);
    if (svc && plain) {
      const c = AWS_CAT[svc.cat];
      [top, l, r] = [`color-mix(in srgb, ${c} 16%, var(--paper))`, `color-mix(in srgb, ${c} 28%, var(--paper-l))`, `color-mix(in srgb, ${c} 45%, var(--paper-r))`];
    } else if (kind === 'external' && plain) [top, l, r] = ['var(--card)', 'var(--card)', 'var(--card)'];
    const sk = { stroke: state.outline ? 'var(--accent)' : 'var(--ink)', 'stroke-width': state.outline ? 2.2 : 1.2, 'stroke-linejoin': 'round',
      'stroke-dasharray': kind === 'external' || state.ghost ? '4 3' : null };
    const gg = el('g', { opacity: state.ghost ? 0.35 : 1 }, g);
    let topY, m;
    if (['db', 'cache'].includes(kind)) {
      const rx = 28, ry = 13;
      el('path', { d: `M${x - rx},${y - h} V${y} A${rx},${ry} 0 0 0 ${x + rx},${y} V${y - h}`, style: `fill:${l}`, ...sk }, gg);
      el('ellipse', { cx: x, cy: y - h, rx, ry, style: `fill:${top}`, ...sk }, gg);
      topY = y - h; m = { top: h + 22, bottom: 26 };
    } else if (kind === 'queue') {
      for (let i = 0; i < 3; i++) cube(gg, x, y - i * 11, 9, top, l, r, sk, 30);
      topY = y - 31; m = { top: 60, bottom: 30 };
    } else {
      cube(gg, x, y, h, top, l, r, sk, kind === 'client' ? 22 : 28);
      topY = y - h; m = { top: h + 26, bottom: 28 };
    }
    if (svc) el('text', { x, y: topY + 4, 'text-anchor': 'middle', 'font-size': svc.abbr.length > 3 ? 9 : 11, 'font-weight': 700,
      fill: plain ? AWS_CAT[svc.cat] : 'var(--fg)', opacity: state.ghost ? .4 : 1 }, gg).textContent = svc.abbr;
    return m;
  }
  function cube(g, x, y, h, top, l, r, sk, w) {
    const d = w * 0.5;
    el('polygon', { points: `${x - w},${y - h} ${x},${y - h + d} ${x},${y + d} ${x - w},${y}`, style: `fill:${l}`, ...sk }, g);
    el('polygon', { points: `${x},${y - h + d} ${x + w},${y - h} ${x + w},${y} ${x},${y + d}`, style: `fill:${r}`, ...sk }, g);
    el('polygon', { points: `${x},${y - h - d} ${x + w},${y - h} ${x},${y - h + d} ${x - w},${y - h}`, style: `fill:${top}`, ...sk }, g);
  }

  /* ---------- mode → 見た目 ---------- */
  function decorate() {
    const N = allNodes(), ns = {}, ls = {};
    Object.keys(N).forEach(id => ns[id] = {});
    allLinks().forEach(l => ls[l.id] = {});
    const focus = (nodes = [], links = []) => {
      Object.keys(ns).forEach(id => { if (!nodes.includes(id)) ns[id].dim = true; else ns[id].outline = true; });
      allLinks().forEach(l => { if (links.includes(l.id)) Object.assign(ls[l.id], { on: true, color: 'var(--accent)' }); else ls[l.id].dim = true; });
    };
    Object.entries(N).forEach(([id, n]) => { if ((n.replicas ?? 1) > 1 && n.replicas < 99) ns[id].badge = `×${n.replicas}`; });

    if (st.mode === 'scenario') {
      const sc = M.scenarios[st.scen], used = new Set(sc.steps.flatMap(s => s.links)), cur = sc.steps[st.step].links;
      allLinks().forEach(l => { if (!used.has(l.id)) ls[l.id].dim = true; });
      cur.forEach(id => Object.assign(ls[id], { on: true, color: 'var(--ink)', packets: true }));
      const touch = new Set(sc.steps.flatMap(s => s.links).flatMap(id => { const l = M.links.find(x => x.id === id); return [l.from, l.to]; }));
      Object.keys(ns).forEach(id => { if (!touch.has(id)) ns[id].dim = true; });
      cur.forEach(id => { const l = M.links.find(x => x.id === id); ns[l.to].outline = true; });
    }
    if (st.mode === 'fail') {
      const r = Analyze.impact(M, st.down);
      st.down.forEach(id => Object.assign(ns[id], { fill: 'down', badge: PIPE ? '失敗' : '停止' }));
      r.impacted.forEach(id => Object.assign(ns[id], { fill: 'impact', badge: PIPE ? '未実行' : '影響' }));
      r.delayed.forEach(id => Object.assign(ns[id], { fill: 'delay', badge: '滞留' }));
      M.links.forEach(l => { if (st.down.includes(l.to) || r.impacted.includes(l.to)) Object.assign(ls[l.id], l.sync ? { on: true, color: 'var(--accent)', dash: true, packets: true } : {}); });
    }
    if (st.mode === 'lint') {
      Object.keys(ns).forEach(id => { const c = ISSUES.filter(i => i.nodes[0] === id || (i.rule === 'SPOF' && i.nodes.includes(id))).length; if (c) ns[id].badge = `! ${c}`; });
      if (st.issue != null) focus(ISSUES[st.issue].nodes, ISSUES[st.issue].links);
    }
    if (st.mode === 'metric') {
      const vals = Object.values(N).map(n => n.metrics?.[st.metric] ?? 0), max = Math.max(...vals, 1);
      Object.entries(N).forEach(([id, n]) => {
        const v = n.metrics?.[st.metric];
        if (v == null) { ns[id].dim = true; return; }
        Object.assign(ns[id], { heat: v / max, h: 14 + (v / max) * 90, badge: fmt(st.metric, v) });
      });
    }
    if (st.mode === 'diff') {
      Object.entries(DIFF.nodes).forEach(([id, k]) => Object.assign(ns[id], k === 'missing' ? { ghost: true, badge: '実環境なし' } : { outline: true, badge: `設計${M.nodes[id].replicas}→実${A.nodes[id].replicas}` }));
      Object.keys(DIFF.extraNodes).forEach(id => Object.assign(ns[id], { outline: true, fill: 'impact', badge: '設計書にない' }));
      Object.keys(DIFF.links).forEach(id => Object.assign(ls[id], { ghost: true }));
      DIFF.extraLinks.forEach(l => Object.assign(ls[l.id], { on: true, color: 'var(--accent)' }));
    }
    if (st.sel && ns[st.sel]) ns[st.sel].outline = true;
    return { ns, ls };
  }
  const fmt = (k, v) => { const u = (METRICS.find(x => x[0] === k) || [])[2] || ''; return u === '$' ? `$${v}` : `${v}${u}`; };

  /* ---------- render ---------- */
  let packets = [];
  function render() {
    svg.innerHTML = '';
    const { ns, ls } = decorate(), N = allNodes();
    /* floors（下から） */
    [...M.tiers].reverse().forEach(t => {
      const z = zOf(t.id), c = [[-1.2, -1.2], [10.4, -1.2], [10.4, 4.2], [-1.2, 4.2]].map(([x, y]) => P(x, y, z));
      el('polygon', { points: c.map(p => p.join(',')).join(' '), fill: 'var(--plate)', 'fill-opacity': .72, stroke: 'var(--line)' });
      for (let i = 0; i <= 10; i++) { const a = P(i - .2, -1.2, z), b = P(i - .2, 4.2, z); el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'var(--grid)' }); }
      for (let j = 0; j <= 4; j++) { const a = P(-1.2, j - .2, z), b = P(10.4, j - .2, z); el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'var(--grid)' }); }
      const lp = P(-1.2, 4.2, z);
      el('text', { x: lp[0] - 8, y: lp[1] + 4, 'text-anchor': 'end', 'font-size': 12, 'font-weight': 700, fill: 'var(--mute)' }).textContent = t.label;
    });
    /* groups（VPC / AZ / サブネット / 環境など） */
    (M.groups || []).forEach(gr => (Array.isArray(gr.tier) ? gr.tier : [gr.tier]).forEach(t => {
      const z = zOf(t), c = [[gr.x0, gr.y0], [gr.x1, gr.y0], [gr.x1, gr.y1], [gr.x0, gr.y1]].map(([x, y]) => P(x, y, z));
      const sty = { vpc: ['var(--ink)', '8 4', 1.2, 'none'], az: ['var(--mute)', '2 3', 1, 'none'], subnet: ['none', null, 0, 'var(--grid)'] }[gr.kind] || ['var(--mute)', '4 4', 1, 'none'];
      el('polygon', { points: c.map(p => p.join(',')).join(' '), stroke: sty[0], 'stroke-dasharray': sty[1], 'stroke-width': sty[2], fill: sty[3], 'fill-opacity': .9 });
      const lp = gr.kind === 'az' ? c[1] : c[3];
      el('text', { x: lp[0] + (gr.kind === 'az' ? 6 : 4), y: lp[1] + (gr.kind === 'az' ? 0 : -4), 'font-size': 10, 'font-weight': 600, fill: 'var(--mute)' }).textContent = gr.label;
    }));
    /* links */
    packets = [];
    allLinks().forEach(l => {
      const s = ls[l.id], p = route(l);
      el('polyline', { points: p.map(q => q.join(',')).join(' '), fill: 'none', 'stroke-linejoin': 'round',
        stroke: s.on ? s.color : 'var(--mute)', 'stroke-width': s.on ? 2.4 : 1.1,
        'stroke-dasharray': s.ghost ? '3 4' : !l.sync ? '7 5' : s.dash ? '6 4' : null,
        opacity: s.dim ? 0.15 : s.ghost ? 0.5 : s.on ? 1 : 0.6 });
      if (s.packets) packets.push({ p, len: len(p), dots: [0, 1, 2].map(() => el('rect', { width: 8, height: 8, fill: s.color, stroke: 'var(--card)', 'stroke-width': 1 })) });
    });
    /* nodes */
    Object.keys(N).sort((a, b) => zOf(N[a].tier) - zOf(N[b].tier) || (N[a].x + N[a].y) - (N[b].x + N[b].y)).forEach(id => {
      const n = N[id], s = ns[id], [x, y] = P(n.x, n.y, zOf(n.tier));
      const g = el('g', { class: 'node', 'data-id': id, opacity: s.dim ? 0.22 : 1 });
      const m = shape(g, n, x, y, s);
      el('text', { x, y: y + m.bottom, 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 600, fill: s.fill === 'down' ? 'var(--accent)' : 'var(--fg)' }, g).textContent = n.label;
      if (s.badge) label(g, x, y - m.top, s.badge, s.fill === 'down' || s.badge.startsWith('!') || st.mode === 'diff' ? { bg: 'var(--accent)', stroke: 'var(--accent)', color: '#fff' } : {});
    });
    renderStats(); renderPanel();
  }
  const len = p => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
  function at(p, t) { let L = len(p) * t; for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (L <= d) { const k = d ? L / d : 0; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k]; } L -= d; } return p[p.length - 1]; }
  (function tick(now) { packets.forEach(o => o.dots.forEach((d, i) => { const [x, y] = at(o.p, (now / (o.len * 8 + 500) + i / 3) % 1); d.setAttribute('x', x - 4); d.setAttribute('y', y - 4); })); requestAnimationFrame(tick); })(0);

  /* ---------- stats & panel ---------- */
  function stat(lab, v, bad) { return `<div class="stat ${bad ? 'bad' : ''}"><small>${lab}</small><b>${v}</b></div>`; }
  function renderStats() {
    let h = '';
    if (st.mode === 'struct') h = stat('ノード', Object.keys(M.nodes).length) + stat('同期 / 非同期', `${M.links.filter(l => l.sync).length} / ${M.links.filter(l => !l.sync).length}`) + stat('指摘', ISSUES.length, 1) + (A ? stat('差分', DIFF.items.length, 1) : '');
    if (st.mode === 'scenario') { const sc = M.scenarios[st.scen]; h = stat('シナリオ', sc.label) + stat('ステップ', `${st.step + 1} / ${sc.steps.length}`) + stat('同期経路 p95 合計', `${syncP95(sc)} ms`, syncP95(sc) > 1000); }
    if (st.mode === 'fail') { const r = Analyze.impact(M, st.down); h = stat('停止', st.down.length, st.down.length) + stat('影響', r.impacted.length, r.impacted.length) + stat('滞留', r.delayed.length) + stat('止まるシナリオ', `${r.brokenScenarios.length} / ${M.scenarios.length}`, r.brokenScenarios.length); }
    if (st.mode === 'lint') h = stat('重大', ISSUES.filter(i => i.sev === 'high').length, 1) + stat('注意', ISSUES.filter(i => i.sev === 'mid').length);
    if (st.mode === 'metric') { const vs = Object.values(M.nodes).map(n => n.metrics?.[st.metric]).filter(v => v != null); const sum = ['cost', 'duration'].includes(st.metric); h = stat('指標', METRICS.find(x => x[0] === st.metric)[1]) + stat(sum ? '合計' : '最大', fmt(st.metric, sum ? vs.reduce((a, b) => a + b, 0) : Math.max(...vs))); }
    if (st.mode === 'diff') h = stat('実環境に欠落', DIFF.items.filter(i => i.kind === 'missing').length, 1) + stat('設計書にない', DIFF.items.filter(i => i.kind === 'extra').length, 1) + stat('台数差', DIFF.items.filter(i => i.kind === 'replicas').length, 1) + stat('取得', A?.capturedAt || '—');
    $('stats').innerHTML = h;
    $('legend').innerHTML = '<span><i></i>同期</span><span><i style="border-top-style:dashed"></i>非同期</span>' +
      (st.mode === 'diff' ? '<span><i style="border-top:2px dotted var(--mute)"></i>実環境にない</span><span><i style="border-color:var(--accent)"></i>設計書にない</span>' : '') +
      (st.mode === 'fail' ? '<span><i style="border-color:var(--accent)"></i>失敗する呼び出し</span>' : '');
  }
  function syncP95(sc) {
    const ids = new Set(sc.steps.flatMap(s => s.links).map(id => M.links.find(l => l.id === id)).filter(l => l.sync).map(l => l.to));
    return [...ids].reduce((s, id) => s + (M.nodes[id].metrics?.p95 || 0), 0);
  }

  function nodeDetail(id) {
    const n = allNodes()[id], ins = allLinks().filter(l => l.to === id), outs = allLinks().filter(l => l.from === id);
    const iss = ISSUES.filter(i => i.nodes.includes(id));
    const ln = l => `${allNodes()[l.from].label} → ${allNodes()[l.to].label} <span class="mono" style="color:var(--mute)">${l.sync ? 'sync' : 'async'}${l.timeoutMs ? ' ' + l.timeoutMs / 1000 + 's' : ''}${l.retry ? ' retry' + l.retry : ''}</span>`;
    return `<h4>選択中のノード</h4><h3>${n.label}</h3><div class="sub">${n.svc && window.AWS?.[n.svc] ? AWS[n.svc].name : n.kind}${n.az ? ` / AZ ${n.az.join(',')}` : ''}${n.subnet ? ` / ${n.subnet} subnet` : ''} /${M.tiers.find(t => t.id === n.tier)?.label || ''} ${n.src ? `/ 設計書 ${n.src}` : ''}</div>
      <table class="kv"><tr><td>台数</td><td>${n.replicas ?? '—'}</td></tr>${Object.entries(n.metrics || {}).map(([k, v]) => `<tr><td>${k}</td><td>${fmt(k, v)}</td></tr>`).join('')}</table>
      <h4>呼び出し元</h4>${ins.map(l => `<div class="item">${ln(l)}</div>`).join('') || '<div class="sub">なし</div>'}
      <h4>呼び出し先</h4>${outs.map(l => `<div class="item">${ln(l)}</div>`).join('') || '<div class="sub">なし</div>'}
      ${iss.length ? `<h4>関連する指摘</h4>` + iss.map(i => `<div class="item"><span class="tag ${i.sev}">${i.title}</span><p>${i.msg}</p></div>`).join('') : ''}`;
  }

  function renderPanel() {
    let h = '';
    if (st.mode === 'struct') {
      h = st.sel ? nodeDetail(st.sel) : `<h3>${M.name}</h3><div class="sub">設計書 <a href="${M.source}" target="_blank">${M.source}</a> から抽出したモデル</div>
        <p>${M.tiers.length} つのフロア（${M.tiers.map(t => t.label).join(' / ')}）に部品を配置しています。ノードをクリックすると詳細を表示します。</p>${M.description ? `<p>${M.description}</p>` : ''}
        ${M.review?.length ? `<h4>抽出時のレビューメモ</h4>` + M.review.map(r => `<div class="item"><p>${r}</p></div>`).join('') : ''}`;
    }
    if (st.mode === 'scenario') {
      const sc = M.scenarios[st.scen], s = sc.steps[st.step];
      h = `<div class="row">${M.scenarios.map((x, i) => `<button class="b ${i === st.scen ? 'on' : ''}" data-scen="${i}">${x.label}</button>`).join('')}</div>
        <div class="num">${String(st.step + 1).padStart(2, '0')}</div><div class="sub">${sc.label}（設計書 ${sc.src}）</div>
        <div class="note">${s.note}</div>
        <div class="row" style="margin-top:16px"><button class="b" data-step="-1" ${st.step ? '' : 'disabled'}>← 前へ</button><button class="b" data-play>${st.play ? '❚❚ 停止' : '▶ 再生'}</button><button class="b" data-step="1" ${st.step < sc.steps.length - 1 ? '' : 'disabled'}>次へ →</button></div>
        <h4>ステップ</h4>${sc.steps.map((x, i) => `<div class="item ${i === st.step ? 'on' : ''}" data-goto="${i}"><b>${i + 1}.</b> ${x.note}</div>`).join('')}`;
    }
    if (st.mode === 'fail') {
      const r = Analyze.impact(M, st.down);
      h = `<h3>障害シミュレーション</h3><div class="sub">${PIPE ? 'ステージをクリックして失敗させる。後続のステージは実行されなくなります。' : 'ノードをクリックして停止 / 復旧。同期で依存している部品に影響が伝播します。'}</div>
        <div class="row"><button class="b" data-reset>すべて復旧</button>${(M.failPresets || []).filter(id => M.nodes[id]).map(id => `<button class="b" data-down="${id}">${M.nodes[id].label} 停止</button>`).join('')}</div>
        <h4>停止中</h4>${st.down.map(id => `<div class="item"><b>${M.nodes[id].label}</b></div>`).join('') || '<div class="sub">なし</div>'}
        <h4>${PIPE ? '実行されないステージ' : '影響を受ける（同期依存）'}</h4>${r.impacted.map(id => `<div class="item">${M.nodes[id].label}</div>`).join('') || '<div class="sub">なし</div>'}
        <h4>処理が滞留する（非同期）</h4>${r.delayed.map(id => `<div class="item">${M.nodes[id].label}</div>`).join('') || '<div class="sub">なし</div>'}
        <h4>止まるユースケース</h4>${r.brokenScenarios.map(s => `<div class="item"><span class="tag high">停止</span>${s.label}</div>`).join('') || '<div class="sub">なし</div>'}`;
    }
    if (st.mode === 'lint') {
      h = `<h3>指摘 ${ISSUES.length} 件</h3><div class="sub">モデルに ${Analyze.RULES.filter(r => (r.for || "system") === (M.type || "system")).length} 種類のルールを当てた結果。クリックで該当箇所を強調。</div>` +
        ISSUES.map((i, k) => `<div class="item ${st.issue === k ? 'on' : ''}" data-issue="${k}"><span class="tag ${i.sev}">${i.title}</span><p>${i.msg}</p></div>`).join('');
    }
    if (st.mode === 'metric') {
      const rows = Object.entries(M.nodes).filter(([, n]) => n.metrics?.[st.metric] != null).sort((a, b) => b[1].metrics[st.metric] - a[1].metrics[st.metric]);
      const max = rows[0]?.[1].metrics[st.metric] || 1;
      h = `<div class="row">${METRICS.map(([k, n]) => `<button class="b ${st.metric === k ? 'on' : ''}" data-metric="${k}">${n}</button>`).join('')}</div>
        <div class="sub">値を立体の高さと色の濃さで表示。高く赤いほど大きい。</div>` +
        rows.map(([id, n]) => `<div class="item" data-sel="${id}"><b>${n.label}</b> <span class="mono">${fmt(st.metric, n.metrics[st.metric])}</span><div class="bar" style="width:${n.metrics[st.metric] / max * 100}%"></div></div>`).join('');
    }
    if (st.mode === 'diff') {
      h = `<h3>設計と実環境の差分</h3><div class="sub">設計モデルと実環境のスナップショット（${A?.capturedAt}）を比較。</div>` +
        DIFF.items.map(i => `<div class="item"><span class="tag ${i.kind === 'replicas' ? 'mid' : 'high'}">${{ missing: '欠落', extra: '設計書にない', replicas: '台数差' }[i.kind]}</span><p>${i.msg}</p></div>`).join('');
    }
    if (st.sel && st.mode !== 'struct' && st.mode !== 'fail') h += '<div style="margin-top:24px"></div>' + nodeDetail(st.sel);
    $('panel').innerHTML = h;
  }

  function renderModes() {
    $('modes').innerHTML = MODES.map(([k, n, c]) => `<button data-mode="${k}" class="${st.mode === k ? 'on' : ''}">${n}${c ? `<small>${c}</small>` : ''}</button>`).join('');
  }
  function setMode(m) { st.mode = m; st.sel = null; st.issue = null; stopPlay(); renderModes(); render(); }
  function stopPlay() { clearInterval(st.play); st.play = null; }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const d = k => e.target.closest(`[data-${k}]`)?.dataset[k];
    if (d('mode')) return setMode(d('mode'));
    const nodeEl = e.target.closest('.node');
    if (nodeEl) {
      const id = nodeEl.dataset.id;
      if (st.mode === 'fail' && M.nodes[id]) st.down = st.down.includes(id) ? st.down.filter(x => x !== id) : [...st.down, id];
      else st.sel = st.sel === id ? null : id;
      return render();
    }
    if (d('scen') != null) { st.scen = +d('scen'); st.step = 0; stopPlay(); }
    else if (d('step') != null) st.step += +d('step');
    else if (d('goto') != null) st.step = +d('goto');
    else if (e.target.closest('[data-play]')) {
      if (st.play) stopPlay();
      else st.play = setInterval(() => { const n = M.scenarios[st.scen].steps.length; st.step = (st.step + 1) % n; render(); }, 2500);
    }
    else if (e.target.closest('[data-reset]')) st.down = [];
    else if (d('down')) st.down = [...new Set([...st.down, d('down')])];
    else if (d('issue') != null) st.issue = st.issue === +d('issue') ? null : +d('issue');
    else if (d('metric')) st.metric = d('metric');
    else if (d('sel')) st.sel = d('sel');
    else return;
    render();
  });

  $('msel').innerHTML = Object.entries(REG).map(([k, r]) => `<option value="${k}" ${k === KEY ? 'selected' : ''}>${r.model.name}</option>`).join('');
  $('msel').onchange = e => { location.hash = e.target.value; };
  $('mname').textContent = M.name;
  $('msrc').textContent = M.source; $('msrc').href = M.source;
  document.title = `${M.name} — DeepDiverDown`;
  renderModes(); render();
})();
