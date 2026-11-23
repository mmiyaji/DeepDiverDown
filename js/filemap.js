/* ファイルの解剖図：1 つの物理ファイルをバイト順・大きさの比率どおりの帯で表す。
   区画（segment）を選ぶと入れ子の中身へズームし、シナリオの読み取り範囲を帯の上で光らせる。
   モデルの fileLayout: { file, size, note?, markers?, segments: [{ id, label, bytes, kind?, node?, description?, sample?, children? }] } を描く
   シナリオのステップは read（読む区画）、write（書く区画）、marks（位置の印：[{ label, at, tone }]）を持てる。
   at はバイト数、または [区画 ID, 区画内の割合 0〜1] */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const fmtBytes = n => {
  if (n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
};

/* 区画の木に、親・先頭オフセット・葉のバイト数を付ける */
function index(layout) {
  const byId = new Map();
  // 中身の合計から大きさを決める（子を先に計算する）
  const size = s => (s.bytes ??= (s.children || []).reduce((a, k) => a + size(k), 0));
  layout.segments.forEach(size);
  const walk = (segs, parent, start) => {
    let off = start;
    for (const s of segs) {
      const kids = s.children || [];
      byId.set(s.id, { seg: s, parent, offset: off });
      if (kids.length) walk(kids, s.id, off);
      off += s.bytes;
    }
  };
  walk(layout.segments, null, 0);
  layout.size = layout.size ?? layout.segments.reduce((a, s) => a + s.bytes, 0);
  return byId;
}

export class FileMap {
  constructor(el, layout, { onNode } = {}) {
    this.el = el; this.L = layout; this.onNode = onNode;
    this.byId = index(layout);
    this.zoom = null;     // 帯で開いている区画（null はファイル全体）
    this.sel = null;      // 説明を出している区画
    this.reads = null;    // { done, now, wdone, wnow: Set, finished: boolean }
    this.marks = layout.markers || [];
    new ResizeObserver(() => this.placeMarks()).observe(el);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-seg]'); if (b) return this.pick(b.dataset.seg);
      const c = e.target.closest('[data-crumb]'); if (c) { this.zoom = c.dataset.crumb || null; this.sel = this.zoom; this.render(); }
    });
    el.addEventListener('keydown', e => {
      const b = e.target.closest('[data-seg]'); if (!b || !['Enter', ' '].includes(e.key)) return;
      e.preventDefault(); this.pick(b.dataset.seg);
    });
    this.render();
  }

  pick(id) {
    const r = this.byId.get(id); if (!r) return;
    this.sel = id;
    if (r.seg.children?.length) this.zoom = id;  // 中身があればその区画へズーム
    if (r.seg.node) this.onNode?.(r.seg.node);
    this.render();
  }

  /* 部品の選択と同期：その部品に対応する最初の区画を見せる */
  showNode(nodeId) {
    if (!nodeId) return;
    const cur = this.sel && this.byId.get(this.sel)?.seg.node;
    if (cur === nodeId) return;
    for (const [id, r] of this.byId) if (r.seg.node === nodeId) {
      this.sel = id; this.zoom = r.seg.children?.length ? id : r.parent; this.render(); return;
    }
  }

  /* シナリオとの同期：read／write を現在のステップまで累積し、marks は最新の指定を使う */
  sync(ctx, sel) {
    if (ctx) {
      const { steps, idx } = ctx, upTo = steps.slice(0, idx), cur = steps[idx] || {};
      const acc = (list, k) => new Set(list.flatMap(x => x[k] || []));
      this.reads = { done: acc(upTo, 'read'), now: new Set(cur.read || []), wdone: acc(upTo, 'write'), wnow: new Set(cur.write || []), finished: idx >= steps.length - 1 };
      this.marks = [...steps.slice(0, idx + 1)].reverse().find(x => x.marks)?.marks || this.L.markers || [];
    } else { this.reads = null; this.marks = this.L.markers || []; }
    this.render();
    this.showNode(sel);
  }
  setReads(reads) { this.reads = reads; this.render(); }

  /* 区画の状態：今のステップで読む／もう読んだ／読まずに済んだ／未定 */
  state(id) {
    const R = this.reads; if (!R) return '';
    const hit = set => { if (!set) return false; for (let x = id; x; x = this.byId.get(x)?.parent) if (set.has(x)) return true; return false; };
    const desc = set => [...(set || [])].some(s => { for (let x = s; x; x = this.byId.get(x)?.parent) if (x === id) return true; return false; });
    if (hit(R.wnow)) return 'wnow';
    if (hit(R.now)) return 'now';
    if (hit(R.wdone)) return 'wdone';
    if (hit(R.done)) return 'done';
    if (desc(R.now)) return 'part-now';
    if (desc(R.done)) return 'part';
    return R.finished ? 'skip' : 'wait';
  }

  /* 読んだバイト数（入れ子の重複は数えない） */
  readBytes() {
    const all = new Set([...(this.reads?.done || []), ...(this.reads?.now || [])]);
    let sum = 0;
    for (const id of all) {
      let covered = false;
      for (let x = this.byId.get(id)?.parent; x; x = this.byId.get(x)?.parent) if (all.has(x)) covered = true;
      if (!covered) sum += this.byId.get(id)?.seg.bytes || 0;
    }
    return sum;
  }

  render() {
    const L = this.L, z = this.zoom && this.byId.get(this.zoom);
    const segs = z ? z.seg.children : L.segments;
    const base = z ? z.offset : 0, total = z ? z.seg.bytes : L.size;
    const path = [];
    for (let x = this.zoom; x; x = this.byId.get(x).parent) path.unshift(x);

    // 帯：大きさの比率どおり。ただし小さい区画は読めるよう最小幅を確保する
    const bar = segs.map(s => {
      const r = this.byId.get(s.id), st = this.state(s.id), ratio = s.bytes / total;
      return `<button type="button" class="fm-seg k-${esc(s.kind || 'data')} ${st ? 's-' + st : ''} ${this.sel === s.id ? 'sel' : ''}"
        data-seg="${esc(s.id)}" style="flex:${Math.max(ratio, 0.0001)} 1 0" title="${esc(s.label)}｜${fmtBytes(s.bytes)}｜オフセット ${r.offset.toLocaleString()}"
        aria-label="${esc(s.label)} ${fmtBytes(s.bytes)}${s.children?.length ? '（中を開く）' : ''}">
        <span class="fm-name">${esc(s.label)}${s.children?.length ? ' <i>▸</i>' : ''}</span><span class="fm-size">${fmtBytes(s.bytes)}</span></button>`;
    }).join('');

    // 目盛り：この帯の先頭・中央・末尾のオフセット
    const ticks = [0, 0.5, 1].map(f => `<span style="left:${f * 100}%">${Math.round(base + total * f).toLocaleString()}</span>`).join('');

    const crumbs = [`<button type="button" class="fm-crumb" data-crumb="">${esc(L.file || 'ファイル')}</button>`]
      .concat(path.map(id => `<button type="button" class="fm-crumb" data-crumb="${esc(id)}">${esc(this.byId.get(id).seg.label)}</button>`)).join('<span class="fm-sep">›</span>');

    const R = this.reads, rb = R ? this.readBytes() : 0;
    const meter = R && rb ? `<div class="fm-meter"><b>${fmtBytes(rb)}</b> / ${fmtBytes(L.size)} を読む（${(rb / L.size * 100).toFixed(rb / L.size < 0.01 ? 3 : 1)}%）${R.finished ? '・灰色は読まずに済んだ範囲' : ''}</div>` : '';

    const s = this.sel && this.byId.get(this.sel);
    const info = s ? `<div class="fm-info"><div class="fm-info-head"><b>${esc(s.seg.label)}</b><span class="mono">${fmtBytes(s.seg.bytes)}・バイト ${s.offset.toLocaleString()}〜${(s.offset + s.seg.bytes - 1).toLocaleString()}</span></div>
        ${s.seg.description ? `<p>${esc(s.seg.description)}</p>` : ''}
        ${s.seg.sample ? `<div class="fm-sample-h">中身の例</div><pre class="fm-sample">${esc(String(s.seg.sample).trimEnd())}</pre>` : ''}</div>`
      : `<div class="fm-info fm-hint">区画を選ぶと中身へズームし、説明と中身の例を表示します。シナリオを再生すると、読む範囲が帯の上で光ります。</div>`;

    this.el.innerHTML = `<div class="fm-head"><span class="fm-title">ファイルの解剖図</span><nav class="fm-crumbs" aria-label="区画の階層">${crumbs}</nav>${meter}</div>
      <div class="fm-barwrap"><div class="fm-bar" role="group" aria-label="バイト順の区画">${bar}</div><div class="fm-marks"></div></div><div class="fm-ticks">${ticks}</div>
      ${L.note ? `<div class="fm-note">${esc(L.note)}</div>` : ''}${info}`;
    this.placeMarks();
  }

  /* 位置の印（読み取り位置・末尾など）：その位置を含む区画の中に、区画内の割合で置く */
  placeMarks() {
    const box = this.el.querySelector('.fm-marks'); if (!box) return;
    const abs = m => Array.isArray(m.at) ? (r => r ? r.offset + r.seg.bytes * (m.at[1] ?? 0) : null)(this.byId.get(m.at[0])) : m.at;
    box.innerHTML = this.marks.map((m, i) => {
      const at = abs(m); if (at == null) return '';
      const btn = [...this.el.querySelectorAll('.fm-seg')].find(b => { const r = this.byId.get(b.dataset.seg); return at >= r.offset && at <= r.offset + r.seg.bytes; });
      if (!btn) return '';
      const r = this.byId.get(btn.dataset.seg), f = r.seg.bytes ? (at - r.offset) / r.seg.bytes : 0;
      const x = btn.offsetLeft + f * btn.offsetWidth, edge = x > box.clientWidth * 0.85 ? " ar" : x < box.clientWidth * 0.15 ? " al" : "";
      return `<span class="fm-mark t-${esc(m.tone || 'pos')} lv${i % 3}${edge}" style="left:${x}px" title="${esc(m.label)}"><b>${esc(m.label)}</b></span>`;
    }).join('');
  }
}
