/* lab perf-log：描き直しの所要時間を計り、window.__ddPerf.report() で console.table に出す（フラグが無いときは読み込まれない） */
const rows = [];
let cur = null;
export function perfWrap(object, names, prefix = '') {
  for (const name of names) {
    const original = object[name];
    if (typeof original !== 'function') continue;
    object[name] = function (...args) {
      const t0 = performance.now();
      try { return original.apply(this, args); }
      finally { if (cur) { const e = cur[prefix + name] ??= { ms: 0, n: 0 }; e.ms += performance.now() - t0; e.n++; } }
    };
  }
}
export function perfRecord(fn) {
  return function (...args) {
    cur = {}; rows.push(cur);
    const t0 = performance.now();
    try { return fn.apply(this, args); } finally { cur.__total = { ms: performance.now() - t0, n: 1 }; }
  };
}
export function installReport(extra = {}) {
  const api = window.__ddPerf = {
    rows, ...extra,
    reset() { rows.length = 0; cur = null; },
    last() { return rows[rows.length - 1]; },
    report(label = '') {
      const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
      const table = {};
      for (const k of keys) {
        const v = rows.map(r => r[k]?.ms ?? 0).sort((a, b) => a - b);
        table[k] = { calls: +(rows.reduce((s, r) => s + (r[k]?.n || 0), 0) / rows.length).toFixed(1), median_ms: +v[v.length >> 1].toFixed(2), mean_ms: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) };
      }
      console.log('perf-log ' + label + ' samples=' + rows.length); console.table(table);
      return table;
    },
  };
  return api;
}
export function perfFn(name, fn) {
  return function (...args) {
    const t0 = performance.now();
    try { return fn.apply(this, args); }
    finally { if (cur) { const e = cur[name] ??= { ms: 0, n: 0 }; e.ms += performance.now() - t0; e.n++; } }
  };
}
/* 部品を n 個（等間隔）順に選び、1 回ごとの内訳の中央値を返す。sync = select() が返るまで、frame = 2 フレーム後まで */
export async function perfSelectRun(api, n = 12, pick = id => api.select(id)) {
  const all = api.nodeIds(), step = Math.max(1, Math.floor(all.length / n)), ids = all.filter((_, i) => i % step === 0).slice(0, n);
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  api.st.sel = null; api.draw(); await new Promise(r => setTimeout(r, 700));
  const out = [];
  for (const id of ids) {
    api.reset(); const t0 = performance.now(); pick(id); const sync = performance.now() - t0;
    let settled = null;
    const S = api.scene, layout = S.layoutLabels;
    S.layoutLabels = function (...args) { const r = layout.apply(this, args); if (settled === null && !this.ghost && !(this.gateFrames > 0)) settled = performance.now() - t0; return r; };
    for (let i = 0; i < 90 && settled === null; i++) await raf();
    S.layoutLabels = layout;
    const frame = settled ?? NaN; await new Promise(r => setTimeout(r, 350));
    const row = { sync, settled: frame }; for (const [k, v] of Object.entries(api.last() || {})) row[k] = v.ms;
    out.push(row);
  }
  const med = k => { const v = out.map(r => r[k] ?? 0).sort((a, b) => a - b); return +v[v.length >> 1].toFixed(1); };
  const result = { nodes: all.length, links: api.linkIds().length, samples: out.length };
  for (const k of new Set(out.flatMap(r => Object.keys(r)))) result[k] = med(k);
  return result;
}
