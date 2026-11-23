/* データの見取り図：部品の箱では伝わりにくい「枝分かれ」と「量の分布」を、図の下の欄に描く。
   - TreeMap：treeLayout（メタデータの木など）。ステップの prune で枝を灰色に、read で読む葉を光らせる
   - DistMap：distribution（パーティションごとの量など）。ステップの highlight で棒を強調し、bars で値を差し替える
   どちらも sync({ steps, idx } | null, 選択中の部品) でシナリオと同期する */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const acc = (steps, k) => new Set(steps.flatMap(x => x[k] || []));

function infoBox(item, hint) {
  if (!item) return `<div class="fm-info fm-hint">${esc(hint)}</div>`;
  return `<div class="fm-info"><div class="fm-info-head"><b>${esc(item.label)}</b>${item.sub ? `<span class="mono">${esc(item.sub)}</span>` : ''}</div>
    ${item.description ? `<p>${esc(item.description)}</p>` : ''}
    ${item.sample ? `<div class="fm-sample-h">中身の例</div><pre class="fm-sample">${esc(String(item.sample).trimEnd())}</pre>` : ''}</div>`;
}

/* ---------- 木：左から右へ枝分かれする ---------- */
export class TreeMap {
  constructor(el, layout, { onNode } = {}) {
    this.el = el; this.L = layout; this.onNode = onNode; this.sel = null; this.ctx = null;
    this.byId = new Map(); this.leaves = [];
    const walk = (n, parent, depth) => {
      this.byId.set(n.id, { n, parent, depth });
      if (n.children?.length) n.children.forEach(c => walk(c, n.id, depth + 1)); else this.leaves.push(n.id);
    };
    walk(layout.root, null, 0);
    el.addEventListener('click', e => { const g = e.target.closest('[data-tn]'); if (g) this.pick(g.dataset.tn); });
    el.addEventListener('keydown', e => { const g = e.target.closest('[data-tn]'); if (g && ['Enter', ' '].includes(e.key)) { e.preventDefault(); this.pick(g.dataset.tn); } });
    this.render();
  }
  pick(id) { this.sel = id; const n = this.byId.get(id)?.n; if (n?.node) this.onNode?.(n.node); this.render(); }
  sync(ctx, sel) {
    this.ctx = ctx && { prune: acc(ctx.steps.slice(0, ctx.idx + 1), 'prune'), pnow: new Set(ctx.steps[ctx.idx]?.prune || []),
      done: acc(ctx.steps.slice(0, ctx.idx), 'read'), now: new Set(ctx.steps[ctx.idx]?.read || []), finished: ctx.idx >= ctx.steps.length - 1 };
    if (sel && this.byId.get(this.sel)?.n.node !== sel) for (const [id, r] of this.byId) if (r.n.node === sel) { this.sel = id; break; }
    this.render();
  }
  up(id, set) { for (let x = id; x; x = this.byId.get(x)?.parent) if (set.has(x)) return x; return null; }
  state(id) {
    const C = this.ctx; if (!C) return '';
    const p = this.up(id, C.prune);
    if (p) return C.pnow.has(p) ? 'cut' : 'skip';
    if (C.now.has(id)) return 'now';
    if (C.done.has(id)) return 'done';
    return '';
  }
  render() {
    const L = this.L, colW = 150, boxW = 132, rowH = 30, boxH = 22, pad = 6;
    const maxDepth = Math.max(...[...this.byId.values()].map(r => r.depth));
    const y = new Map();
    this.leaves.forEach((id, i) => y.set(id, pad + i * rowH));
    const place = id => { const n = this.byId.get(id).n; if (!n.children?.length) return y.get(id);
      const ys = n.children.map(c => place(c.id)); const v = (Math.min(...ys) + Math.max(...ys)) / 2; y.set(id, v); return v; };
    place(L.root.id);
    const W = (maxDepth + 1) * colW, H = this.leaves.length * rowH + pad * 2;
    const X = id => this.byId.get(id).depth * colW + 4;
    let edges = '', boxes = '';
    for (const [id, r] of this.byId) {
      const st = this.state(id), x = X(id), yy = y.get(id);
      if (r.parent) {
        const px = X(r.parent) + boxW, py = y.get(r.parent) + boxH / 2, cy = yy + boxH / 2;
        edges += `<path class="tm-e ${st ? 's-' + st : ''}" d="M${px},${py} C${px + 14},${py} ${x - 14},${cy} ${x},${cy}"/>`;
      }
      boxes += `<g class="tm-n k-${esc(r.n.kind || 'meta')} ${st ? 's-' + st : ''} ${this.sel === id ? 'sel' : ''}" data-tn="${esc(id)}" tabindex="0" role="button" aria-label="${esc(r.n.label)}">
        <rect x="${x}" y="${yy}" width="${boxW}" height="${boxH}" rx="4"/>
        <text x="${x + 7}" y="${yy + 15}">${esc(r.n.label)}</text>${r.n.sub ? `<title>${esc(r.n.sub)}</title>` : ''}</g>`;
    }
    const C = this.ctx, unit = L.unit || 'ファイル';
    let meter = '';
    if (C) {
      const total = this.leaves.length, cut = this.leaves.filter(id => this.up(id, C.prune)).length;
      const read = this.leaves.filter(id => C.now.has(id) || C.done.has(id)).length;
      meter = `<div class="fm-meter">${esc(unit)} ${total} 件中 <b>${cut} 件を開かずに除外</b>${read ? `・${read} 件を読む` : ''}</div>`;
    }
    const lv = (L.levels || []).map((t, i) => `<span style="left:${i * colW + 4}px;width:${boxW}px">${esc(t)}</span>`).join('');
    this.el.innerHTML = `<div class="fm-head"><span class="fm-title">${esc(L.title || 'メタデータの木')}</span>${meter}</div>
      <div class="tm-scroll">${lv ? `<div class="tm-levels" style="width:${W}px">${lv}</div>` : ''}<svg class="tm" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(L.title || 'メタデータの木')}">${edges}${boxes}</svg></div>
      ${L.note ? `<div class="fm-note">${esc(L.note)}</div>` : ''}
      ${infoBox(this.sel && this.byId.get(this.sel)?.n, '枝を選ぶと説明と中身の例を表示します。シナリオを再生すると、除外された枝が灰色になり、読むファイルが光ります。')}`;
  }
}

/* ---------- 分布：棒グラフと中央値・最大値 ---------- */
export class DistMap {
  constructor(el, layout, { onNode } = {}) {
    this.el = el; this.L = layout; this.onNode = onNode; this.sel = null; this.ctx = null;
    el.addEventListener('click', e => { const b = e.target.closest('[data-bar]'); if (b) this.pick(b.dataset.bar); });
    // 幅が変わったら描き直す。ただし動いている途中は、終わってから描き直す（スクロールバーの出入りで幅が変わるため）
    new ResizeObserver(() => {
      if (el.clientWidth === this.w0) return;
      this.w0 = el.clientWidth;
      const wait = (this.animEnd || 0) - performance.now();
      clearTimeout(this.rt); this.rt = setTimeout(() => this.render(), Math.max(0, wait));
    }).observe(el);
    this.render();
  }
  bars() {
    const C = this.ctx;
    return (C && [...C.steps.slice(0, C.idx + 1)].reverse().find(x => x.bars)?.bars) || this.L.bars;
  }
  pick(id) { this.sel = id; const b = this.bars().find(x => x.id === id); if (b?.node) this.onNode?.(b.node); this.render(); }
  sync(ctx, sel) {
    // 同じステップの再描画は飛ばす（動いている途中のアニメーションを消さないため）
    const key = ctx ? ctx.steps[ctx.idx] : null;
    if (this.ctx && ctx && this.key === key && this.ctx.steps === ctx.steps) return;
    this.ctx = ctx; this.key = key; this.render();
  }
  render() {
    const L = this.L, bars = this.bars(), C = this.ctx;
    const hi = new Set(C ? C.steps[C.idx]?.highlight || [] : []);
    const vals = bars.map(b => b.value), max = Math.max(...vals), sorted = [...vals].sort((a, b) => a - b);
    const med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const top = Math.max(max, L.scaleMax || 0), H = 150, w = Math.max(320, this.el.clientWidth - 30), gap = 4;
    const bw = Math.max(10, (w - 40) / bars.length - gap), Y = v => H - (v / top) * (H - 16);
    const unit = L.unit || '', geom = new Map();
    const g = bars.map((b, i) => {
      const x = 36 + i * (bw + gap), h = H - Y(b.value);
      geom.set(b.id, { x, y: Y(b.value), w: bw, h: Math.max(1, h) });
      const cls = [hi.has(b.id) ? 'hi' : '', b.value === max ? 'max' : '', this.sel === b.id ? 'sel' : ''].join(' ');
      return `<g class="dm-b ${cls}" data-bar="${esc(b.id)}" role="button" tabindex="0" aria-label="${esc(`${b.label} ${b.value}${unit}`)}">
        <rect x="${x}" y="${Y(b.value)}" width="${bw}" height="${Math.max(1, h)}" rx="2"/>
        <text class="dm-v" x="${x + bw / 2}" y="${Y(b.value) - 3}">${esc(b.value)}</text>
        <text class="dm-l" x="${x + bw / 2}" y="${H + 12}">${esc(b.short || b.label)}</text></g>`;
    }).join('');
    const line = (v, cls, label) => `<line class="dm-line ${cls}" x1="32" x2="${w}" y1="${Y(v)}" y2="${Y(v)}"/><text class="dm-lt ${cls}" x="${w}" y="${Y(v) - 3}">${esc(label)}</text>`;
    const ratio = med ? (max / med).toFixed(1) : '—', tot = vals.reduce((a, b) => a + b, 0);
    const sel = this.sel && bars.find(b => b.id === this.sel);
    this.el.innerHTML = `<div class="fm-head"><span class="fm-title">${esc(L.title || '分布')}</span>
        ${L.summary === 'files'
          ? `<div class="fm-meter">ファイル <b>${bars.length} 個</b>・合計 ${esc(`${tot}${unit}`)}${L.target ? `・目標 ${esc(`${L.target}${unit}`)} の 3/4 未満 <b>${vals.filter(v => v < L.target * 0.75).length} 個</b>` : ''}</div>`
          : `<div class="fm-meter">最大 <b>${esc(`${max}${unit}`)}</b> は中央値 ${esc(`${med}${unit}`)} の <b>${ratio} 倍</b>${L.maxNote ? `・${esc(L.maxNote)}` : ''}</div>`}</div>
      <svg class="dm" width="${w}" height="${H + 18}" viewBox="0 0 ${w} ${H + 18}">
        ${L.summary === 'files' ? (L.target ? line(L.target, 'mx', `目標 ${L.target}${unit}`) : '') : line(med, 'med', `中央値 ${med}${unit}`) + line(max, 'mx', `最大 ${max}${unit}`)}${g}</svg>
      ${L.note ? `<div class="fm-note">${esc(L.note)}</div>` : ''}
      ${infoBox(sel && { ...sel, sub: `${sel.value}${unit}` }, '棒を選ぶと説明を表示します。シナリオを再生すると、注目する棒が強調され、対処後の分布に切り替わります。')}`;
    const prev = this.prev; this.prev = { bars, geom };
    if (prev && prev.bars !== bars) this.animate(prev, bars, geom);
  }

  /* 分布が切り替わったときの動き：
     - 同じ ID の棒は新しい位置へ滑らせる
     - from に複数の棒を持つ新しい棒（結合）は、元の棒が飛んできて下から積み重なり、1 本にまとまる
     - from に 1 本を持つ新しい棒（分割）は、元の棒の位置から切り出されて新しい位置へ移る
     - 逆向き（結合した棒が元に戻る）も同じ対応関係から割り出す */
  animate(prev, bars, geom) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const svg = this.el.querySelector('svg.dm'); if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg', D = 900;
    this.animEnd = performance.now() + D * 1.6;
    const EASE = 'cubic-bezier(.45,0,.2,1)';
    const P = prev.geom, prevBars = new Map(prev.bars.map(b => [b.id, b]));
    const el = id => svg.querySelector(`[data-bar="${CSS.escape(id)}"]`);
    const tf = (from, to) => `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(${from.w / to.w}, ${from.h / to.h})`;
    const fadeIn = (node, delay) => node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay, fill: 'backwards' });
    // 元の 1 本から切り出した部分の位置：元の棒の底から順に積む
    const portion = (src, list, id) => {
      let cum = 0;
      for (const x of list) { const gx = geom.get(x.id) || P.get(x.id); if (x.id === id) return { x: src.x, w: src.w, h: gx.h, y: src.y + src.h - cum - gx.h }; cum += gx.h; }
      return src;
    };
    let busy = 0;
    bars.forEach(b => {
      const g = el(b.id), fin = geom.get(b.id); if (!g || !fin) return;
      const rect = g.querySelector('rect'), texts = g.querySelectorAll('text');
      const from = (b.from || []).filter(id => P.has(id));
      if (P.has(b.id)) {                                   // 同じ棒：横へ滑らせる
        const o = P.get(b.id);
        rect.animate([{ transform: tf(o, fin) }, { transform: 'none' }], { duration: D, easing: EASE });
        texts.forEach(t => t.animate([{ transform: `translateX(${o.x - fin.x}px)` }, { transform: 'none' }], { duration: D, easing: EASE }));
        return;
      }
      if (from.length > 1) {                               // 結合：元の棒が飛んできて積み重なる
        busy = Math.max(busy, D + from.length * 40);
        let cum = 0;
        from.forEach((id, k) => {
          const o = P.get(id), gh = document.createElementNS(NS, 'rect');
          const to = { x: fin.x, w: fin.w, h: o.h, y: fin.y + fin.h - cum - o.h }; cum += o.h;
          for (const [a, v] of Object.entries({ x: o.x, y: o.y, width: o.w, height: o.h, rx: 2 })) gh.setAttribute(a, v);
          gh.setAttribute('class', 'dm-ghost'); svg.append(gh);
          const delay = k * 40;
          gh.animate([{ transform: 'none' }, { transform: `translate(${to.x - o.x}px, ${to.y - o.y}px) scale(${to.w / o.w}, 1)` }],
            { duration: D, delay, easing: EASE, fill: 'forwards' }).finished.then(() => gh.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).finished.then(() => gh.remove()));
        });
        g.animate([{ opacity: 0 }, { opacity: 0, offset: 0.99 }, { opacity: 1 }], { duration: busy, fill: 'backwards' });
        return;
      }
      if (from.length === 1) {                             // 分割：元の 1 本から切り出して移動
        const sib = bars.filter(x => x.from?.length === 1 && x.from[0] === from[0]);
        const start = portion(P.get(from[0]), sib, b.id);
        rect.animate([{ transform: tf(start, fin) }, { transform: 'none' }], { duration: D, easing: EASE });
        texts.forEach(t => fadeIn(t, D));
        return;
      }
      if ([...prevBars.values()].some(x => x.from?.length === 1 && x.from[0] === b.id)) return; // 分割を戻す：下のループで扱う
      const parent = [...prevBars.values()].find(x => x.from?.length > 1 && x.from.includes(b.id));
      if (parent && P.has(parent.id)) {                    // 逆向きの結合：まとめた棒から元の棒へばらす
        const sib = parent.from.map(id => bars.find(x => x.id === id)).filter(Boolean);
        const start = portion(P.get(parent.id), sib, b.id);
        rect.animate([{ transform: tf(start, fin) }, { transform: 'none' }], { duration: D, delay: sib.indexOf(b) * 25, easing: EASE, fill: 'backwards' });
        texts.forEach(t => fadeIn(t, D));
        return;
      }
      rect.animate([{ transform: `translateY(${fin.h}px) scale(1, 0)` }, { transform: 'none' }], { duration: D * 0.6, easing: EASE });
    });
    // 結合・分割で消える元の棒が、逆向き（分割した棒が戻る）でまとまるとき
    for (const [id, ob] of prevBars) {
      if (geom.has(id)) continue;
      const target = bars.find(x => (x.from || []).includes(id)); if (target) continue;
      const back = ob.from?.length === 1 && bars.find(x => x.id === ob.from[0]);
      if (!back) continue;
      const fin = geom.get(back.id), o = P.get(id), gh = document.createElementNS(NS, 'rect');
      for (const [a, v] of Object.entries({ x: o.x, y: o.y, width: o.w, height: o.h, rx: 2 })) gh.setAttribute(a, v);
      gh.setAttribute('class', 'dm-ghost'); svg.append(gh);
      const sib = [...prevBars.values()].filter(x => x.from?.length === 1 && x.from[0] === back.id);
      const to = portion(fin, sib, id);
      gh.animate([{ transform: 'none' }, { transform: `translate(${to.x - o.x}px, ${to.y - o.y}px) scale(${to.w / o.w}, 1)` }], { duration: D, easing: EASE, fill: 'forwards' })
        .finished.then(() => gh.remove());
      el(back.id)?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.99 }, { opacity: 1 }], { duration: D, fill: 'backwards' });
    }
  }
}

/* ---------- 表：行×列のマス目（パーティション×保存ブロックなど） ----------
   grid: { title, rowLabel, colLabel, unit, note, rows: [{id,label}], cols: [{id,label}], values: [[行ごとの値]], node? }
   ステップの prune / read は 'row:行ID'、'col:列ID'、'行ID:列ID' で指定する */
export class GridMap {
  constructor(el, layout, { onNode } = {}) {
    this.el = el; this.L = layout; this.onNode = onNode; this.ctx = null; this.sel = null;
    el.addEventListener('click', e => { const c = e.target.closest('[data-cell]'); if (c) { this.sel = c.dataset.cell; if (layout.node) onNode?.(layout.node); this.render(); } });
    this.render();
  }
  sync(ctx) {
    this.ctx = ctx && { prune: acc(ctx.steps.slice(0, ctx.idx + 1), 'prune'), pnow: new Set(ctx.steps[ctx.idx]?.prune || []),
      read: acc(ctx.steps.slice(0, ctx.idx + 1), 'read'), rnow: new Set(ctx.steps[ctx.idx]?.read || []) };
    this.render();
  }
  match(set, r, c) { return set.has(`${r}:${c}`) || set.has(`row:${r}`) || set.has(`col:${c}`); }
  render() {
    const L = this.L, C = this.ctx, unit = L.unit || '';
    let total = 0, cut = 0, readN = 0, readV = 0, sum = 0;
    const head = `<tr><th class="gm-corner">${esc(L.rowLabel || '')} ＼ ${esc(L.colLabel || '')}</th>${L.cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>`;
    const body = L.rows.map((r, i) => `<tr><th>${esc(r.label)}</th>${L.cols.map((c, j) => {
      const v = L.values[i][j]; total++; sum += v;
      let st = '';
      if (C) {
        if (this.match(C.prune, r.id, c.id)) { st = this.match(C.pnow, r.id, c.id) ? 'cut' : 'skip'; cut++; }
        else if (this.match(C.read, r.id, c.id)) { st = this.match(C.rnow, r.id, c.id) ? 'now' : 'done'; readN++; readV += v; }
      }
      const id = `${r.id}:${c.id}`;
      return `<td class="gm-c ${st ? 's-' + st : ''} ${this.sel === id ? 'sel' : ''}" data-cell="${esc(id)}" style="--a:${Math.min(1, v / (L.scaleMax || Math.max(...L.values.flat())))}" title="${esc(r.label)} × ${esc(c.label)}：${esc(`${v}${unit}`)}">${esc(v)}</td>`;
    }).join('')}</tr>`).join('');
    const meter = C ? `<div class="fm-meter">マス ${total} 件中 <b>${cut} 件を除外</b>${readN ? `・${readN} 件を読む（${esc(`${readV}${unit}`)} / 全体 ${esc(`${sum}${unit}`)}、${(readV / sum * 100).toFixed(1)}%）` : ''}</div>` : '';
    const [sr, sc] = (this.sel || '').split(':');
    const selInfo = this.sel && { label: `${L.rows.find(r => r.id === sr)?.label} × ${L.cols.find(c => c.id === sc)?.label}`, sub: `${L.values[L.rows.findIndex(r => r.id === sr)]?.[L.cols.findIndex(c => c.id === sc)]}${unit}`, description: L.cellNote };
    this.el.innerHTML = `<div class="fm-head"><span class="fm-title">${esc(L.title || '分布の表')}</span>${meter}</div>
      <div class="gm-scroll"><table class="gm">${head}${body}</table></div>
      ${L.note ? `<div class="fm-note">${esc(L.note)}</div>` : ''}
      ${infoBox(selInfo, 'マスはパーティションと保存ブロックの組で、数値はデータ量です。シナリオを再生すると、除外されたマスが灰色になり、読むマスが光ります。')}`;
  }
}

/* ---------- タイムライン：コミット（スナップショット）の並び ----------
   timeline: { title, note, commits: [{ id, label, time, kind, node?, description?, sample? }] }
   ステップの current（現在の版）、travel（時点指定で読む版）、expire（失効した版）、highlight を反映する */
export class TimelineMap {
  constructor(el, layout, { onNode } = {}) {
    this.el = el; this.L = layout; this.onNode = onNode; this.ctx = null; this.sel = null;
    el.addEventListener('click', e => { const c = e.target.closest('[data-commit]'); if (c) this.pick(c.dataset.commit); });
    this.render();
  }
  pick(id) { this.sel = id; const c = this.L.commits.find(x => x.id === id); if (c?.node) this.onNode?.(c.node); this.render(); }
  sync(ctx) { this.ctx = ctx; this.render(); }
  latest(k) { const C = this.ctx; if (!C) return this.L[k]; const s = [...C.steps.slice(0, C.idx + 1)].reverse().find(x => x[k] !== undefined); return s ? s[k] : this.L[k]; }
  render() {
    const L = this.L, C = this.ctx, cs = L.commits;
    const cur = this.latest('current'), travel = this.latest('travel');
    const expired = new Set(C ? C.steps.slice(0, C.idx + 1).flatMap(x => x.expire || []) : []);
    const hi = new Set(C ? C.steps[C.idx]?.highlight || [] : []);
    const items = cs.map(c => {
      const cls = [`k-${c.kind || 'append'}`, expired.has(c.id) ? 's-expired' : '', hi.has(c.id) ? 's-hi' : '', c.id === cur ? 'cur' : '', c.id === travel ? 'travel' : '', this.sel === c.id ? 'sel' : ''].join(' ');
      return `<button type="button" class="tl-c ${esc(cls)}" data-commit="${esc(c.id)}" aria-label="${esc(c.label)} ${esc(c.time || '')}">
        ${c.id === cur ? '<span class="tl-pin cur">現在</span>' : ''}${c.id === travel ? '<span class="tl-pin travel">時点指定で読む</span>' : ''}
        <span class="tl-dot"></span><span class="tl-l">${esc(c.label)}</span><span class="tl-t">${esc(c.time || '')}</span><span class="tl-k">${esc({ append: '追記', overwrite: '上書き', delete: '削除', compact: 'コンパクション' }[c.kind] || c.kind || '')}</span></button>`;
    }).join('');
    const meter = expired.size ? `<div class="fm-meter">失効 <b>${expired.size} 件</b>・それらだけが参照するファイルは削除対象</div>` : '';
    this.el.innerHTML = `<div class="fm-head"><span class="fm-title">${esc(L.title || 'コミットのタイムライン')}</span>${meter}</div>
      <div class="tl-scroll"><div class="tl">${items}</div></div>
      ${L.note ? `<div class="fm-note">${esc(L.note)}</div>` : ''}
      ${infoBox(this.sel && cs.find(c => c.id === this.sel), 'コミットを選ぶと内容を表示します。シナリオを再生すると、現在の版・時点指定で読む版・失効した版が変わります。')}`;
  }
}

/* ---------- ブロックの移動：箱（Worker・Consumer・ノード・層など）の間をデータの塊が動く ----------
   blocks: { id, title, note, legend: {k: 説明}, lanes: [{ id, label, sub?, node?, optional? }], items: { 箱 ID: [塊] } }
   塊：{ id, label?, k?（色 0〜7）, w?（幅の倍率）, from?: [元の塊 ID], note? }
   ステップの blocks: { 箱 ID: [塊] } で配置を差し替えると、同じ ID の塊は新しい箱へ移動し、
   from を持つ塊は元の塊から飛んで来る（複数なら結合、元が残っていれば複製、1 つなら分割）。消えた塊はその場で消える。
   ステップの highlight: [塊 ID] で強調、lanes: { 箱 ID: { label, sub, tone } } で箱の見出しを差し替える */
export class BlockMap {
  constructor(el, layout, { onNode } = {}) {
    this.el = el; this.L = layout; this.onNode = onNode; this.ctx = null; this.key = undefined; this.sel = null;
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-item]'); if (t) { this.sel = t.dataset.item; this.render(false); return; }
      const l = e.target.closest('[data-lane]'); if (l) { const lane = this.L.lanes.find(x => x.id === l.dataset.lane); if (lane?.node) this.onNode?.(lane.node); }
    });
    this.render(false);
  }
  latest(k) { const C = this.ctx; return C ? [...C.steps.slice(0, C.idx + 1)].reverse().find(x => x[k])?.[k] : undefined; }
  state() { return this.latest('blocks') || this.L.items || {}; }
  sync(ctx) {
    const key = ctx ? ctx.steps[ctx.idx] : null;
    if (this.key === key && this.ctx?.steps === ctx?.steps) return;
    this.ctx = ctx; this.key = key; this.render(true);
  }
  render(animate) {
    const L = this.L, S = this.state(), C = this.ctx;
    const hi = new Set(C ? C.steps[C.idx]?.highlight || [] : []);
    const laneOver = this.latest('lanes') || {};
    // 直前の位置を覚えておく（FLIP）
    const box = this.el.querySelector('.bm'), base = box?.getBoundingClientRect();
    const before = new Map();
    if (box && animate) box.querySelectorAll('[data-item]').forEach(n => { const r = n.getBoundingClientRect(); before.set(n.dataset.item, { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, k: n.dataset.k, label: n.textContent }); });
    const prevItems = this.items || new Map();
    const lanes = L.lanes.filter(l => !l.optional || S[l.id]);
    const all = new Map();
    const width = item => Number(item.w) || 1;
    const html = lanes.map(l => {
      const its = S[l.id] || [], o = laneOver[l.id] || {};
      its.forEach(it => all.set(it.id, it));
      const size = its.reduce((a, it) => a + width(it), 0);
      const sub = o.sub ?? l.sub;
      return `<div class="bm-lane ${o.tone ? 'bm-' + esc(o.tone) : ''}" data-lane="${esc(l.id)}">
        <div class="bm-lh"><b>${esc(o.label || l.label)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}<i>${its.length ? (L.unit ? `${+size.toFixed(1)}${esc(L.unit)}` : `${its.length} 個`) : '空'}</i></div>
        <div class="bm-items">${its.map(it => `<button type="button" class="bm-it k${esc(it.k ?? 0)} ${hi.has(it.id) ? 'hi' : ''} ${this.sel === it.id ? 'sel' : ''}" data-item="${esc(it.id)}" data-k="${esc(it.k ?? 0)}" style="--w:${width(it)}" title="${esc(it.note || it.label || it.id)}">${esc(it.label ?? it.id)}</button>`).join('')}</div></div>`;
    }).join('');
    const legend = Object.entries(L.legend || {}).map(([k, v]) => `<span class="bm-lg"><span class="bm-sw k${esc(k)}"></span>${esc(v)}</span>`).join('');
    const sel = this.sel && all.get(this.sel);
    this.el.innerHTML = `<div class="fm-head"><span class="fm-title">${esc(L.title || 'データの移動')}</span>${legend ? `<div class="bm-legend">${legend}</div>` : ''}</div>
      <div class="bm" style="--lanes:${lanes.length}">${html}</div>
      ${L.note ? `<div class="fm-note">${esc(L.note)}</div>` : ''}
      ${infoBox(sel && { label: sel.label ?? sel.id, description: sel.note }, '塊を選ぶと説明を表示します。シナリオを再生すると、データの塊が箱の間を移動・結合・分割・複製します。')}`;
    this.items = all;
    if (before.size && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.animate(before, prevItems, all);
  }
  animate(before, prevItems, all) {
    const box = this.el.querySelector('.bm'), base = box.getBoundingClientRect(), D = 850, EASE = 'cubic-bezier(.45,0,.2,1)';
    const rectOf = n => { const r = n.getBoundingClientRect(); return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }; };
    const ghost = (g, cls) => { const d = document.createElement('div'); d.className = `bm-it bm-ghost k${g.k} ${cls || ''}`; d.textContent = g.label;
      Object.assign(d.style, { left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', height: g.h + 'px' }); box.append(d); return d; };
    const consumed = new Set();
    box.querySelectorAll('[data-item]').forEach((n, i) => {
      const id = n.dataset.item, it = all.get(id), to = rectOf(n), was = before.get(id);
      if (was) {                                                   // 同じ塊：箱の間を移動
        if (Math.abs(was.x - to.x) + Math.abs(was.y - to.y) > 1) n.animate([{ transform: `translate(${was.x - to.x}px, ${was.y - to.y}px)` }, { transform: 'none' }], { duration: D, easing: EASE, delay: (i % 12) * 15, fill: 'backwards' });
        return;
      }
      const src = (it.from || []).filter(f => before.has(f));
      if (src.length > 1) {                                        // 結合：元の塊が飛んできて 1 つになる
        src.forEach((f, k) => {
          consumed.add(f); const o = before.get(f), g = ghost(o), tr = `translate(${to.x - o.x}px, ${to.y - o.y}px)`;
          g.animate([{ transform: 'none', opacity: 1 }, { transform: tr, opacity: 0.9, offset: 0.85 }, { transform: tr, opacity: 0 }],
            { duration: D, delay: k * 50, easing: EASE, fill: 'forwards' }).finished.then(() => g.remove());
        });
        n.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 0, transform: 'scale(.6)', offset: 0.75 }, { opacity: 1, transform: 'none' }], { duration: D + src.length * 50 + 150, easing: EASE, fill: 'backwards' });
        return;
      }
      if (src.length === 1) {                                      // 分割・複製：元の塊の位置から出てくる
        const o = before.get(src[0]); if (!all.has(src[0])) consumed.add(src[0]);
        n.animate([{ transform: `translate(${o.x - to.x}px, ${o.y - to.y}px)`, opacity: 0.35 }, { transform: 'none', opacity: 1 }],
          { duration: D, delay: (i % 12) * 20, easing: EASE, fill: 'backwards' });
        return;
      }
      // 逆向き：前に 1 つへ結合していた塊から、元の塊へばらける
      const parent = [...prevItems.values()].find(p => p.from?.includes(id) && before.has(p.id));
      if (parent) {
        consumed.add(parent.id); const o = before.get(parent.id);
        n.animate([{ transform: `translate(${o.x - to.x}px, ${o.y - to.y}px)`, opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: D, easing: EASE, fill: 'backwards' });
        return;
      }
      n.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: D * 0.6, easing: EASE, fill: 'backwards' });
    });
    // 消えた塊：戻る方向の分割元なら子の位置へ吸い込まれ、そうでなければその場で沈んで消える
    for (const [id, g] of before) {
      if (all.has(id) || consumed.has(id)) continue;
      const d = ghost(g, 'bm-gone');
      const child = [...all.values()].find(x => prevItems.get(id)?.from?.includes(x.id));
      const n = child && box.querySelector(`[data-item="${CSS.escape(child.id)}"]`);
      if (n) { const to = rectOf(n); d.animate([{ transform: 'none' }, { transform: `translate(${to.x - g.x}px, ${to.y - g.y}px)`, opacity: 0 }], { duration: D, easing: EASE, fill: 'forwards' }).finished.then(() => d.remove()); continue; }
      d.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(14px) scale(.7)' }], { duration: D * 0.7, easing: EASE, fill: 'forwards' }).finished.then(() => d.remove());
    }
  }
}
