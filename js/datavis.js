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
      meter = `<div class="fm-meter">${unit} ${total} 件中 <b>${cut} 件を開かずに除外</b>${read ? `・${read} 件を読む` : ''}</div>`;
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
    new ResizeObserver(() => { if (el.clientWidth !== this.w0) { this.w0 = el.clientWidth; this.render(); } }).observe(el);
    this.render();
  }
  bars() {
    const C = this.ctx;
    return (C && [...C.steps.slice(0, C.idx + 1)].reverse().find(x => x.bars)?.bars) || this.L.bars;
  }
  pick(id) { this.sel = id; const b = this.bars().find(x => x.id === id); if (b?.node) this.onNode?.(b.node); this.render(); }
  sync(ctx, sel) { this.ctx = ctx; this.render(); }
  render() {
    const L = this.L, bars = this.bars(), C = this.ctx;
    const hi = new Set(C ? C.steps[C.idx]?.highlight || [] : []);
    const vals = bars.map(b => b.value), max = Math.max(...vals), sorted = [...vals].sort((a, b) => a - b);
    const med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const top = Math.max(max, L.scaleMax || 0), H = 150, w = Math.max(320, this.el.clientWidth - 30), gap = 4;
    const bw = Math.max(10, (w - 40) / bars.length - gap), Y = v => H - (v / top) * (H - 16);
    const unit = L.unit || '';
    const g = bars.map((b, i) => {
      const x = 36 + i * (bw + gap), h = H - Y(b.value), cls = [hi.has(b.id) ? 'hi' : '', b.value === max ? 'max' : '', this.sel === b.id ? 'sel' : ''].join(' ');
      return `<g class="dm-b ${cls}" data-bar="${esc(b.id)}" role="button" tabindex="0" aria-label="${esc(b.label)} ${b.value}${unit}">
        <rect x="${x}" y="${Y(b.value)}" width="${bw}" height="${Math.max(1, h)}" rx="2"/>
        <text class="dm-v" x="${x + bw / 2}" y="${Y(b.value) - 3}">${b.value}</text>
        <text class="dm-l" x="${x + bw / 2}" y="${H + 12}">${esc(b.short || b.label)}</text></g>`;
    }).join('');
    const line = (v, cls, label) => `<line class="dm-line ${cls}" x1="32" x2="${w}" y1="${Y(v)}" y2="${Y(v)}"/><text class="dm-lt ${cls}" x="${w}" y="${Y(v) - 3}">${esc(label)}</text>`;
    const ratio = med ? (max / med).toFixed(1) : '—';
    const sel = this.sel && bars.find(b => b.id === this.sel);
    this.el.innerHTML = `<div class="fm-head"><span class="fm-title">${esc(L.title || '分布')}</span>
        <div class="fm-meter">最大 <b>${max}${unit}</b> は中央値 ${med}${unit} の <b>${ratio} 倍</b>${L.maxNote ? `・${esc(L.maxNote)}` : ''}</div></div>
      <svg class="dm" width="${w}" height="${H + 18}" viewBox="0 0 ${w} ${H + 18}">
        ${line(med, 'med', `中央値 ${med}${unit}`)}${line(max, 'mx', `最大 ${max}${unit}`)}${g}</svg>
      ${L.note ? `<div class="fm-note">${esc(L.note)}</div>` : ''}
      ${infoBox(sel && { ...sel, sub: `${sel.value}${unit}` }, '棒を選ぶと説明を表示します。シナリオを再生すると、注目する棒が強調され、対処後の分布に切り替わります。')}`;
  }
}
