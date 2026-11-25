// 性能計測（部品の選択＝描き直しの内訳）。selectBench(版) を実行する
export async function selectBench(version) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const { Scene3D } = await import(`../../js/scene3d.js?v=${version}`);
  const T = {};
  for (const n of ['begin', 'end', 'mergeStatic', 'node', 'link', 'group', 'floor', 'placeLabels', 'layoutLabels']) {
    const o = Scene3D.prototype[n]; if (!o || o.__w) continue;
    const f = function (...a) { const s = performance.now(); try { return o.apply(this, a); } finally { T[n] = (T[n] || 0) + performance.now() - s; T[n + '#'] = (T[n + '#'] || 0) + 1; } };
    f.__w = 1; Scene3D.prototype[n] = f;
  }
  if (!window.__selInstalled) { window.__selInstalled = 1; const b0 = Scene3D.prototype.begin; Scene3D.prototype.begin = function (...a) { window.__sc = this; return b0.apply(this, a); }; }
  document.querySelector('[data-legend-toggle="management"]').click(); await sleep(500);
  const sc = window.__sc, res = [];
  for (const id of ['n010', 'n050', 'n090', 'n020', 'n070']) {
    for (const k in T) T[k] = 0;
    const t0 = performance.now(); sc.onPick(id); const sync = performance.now() - t0;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    res.push({ id, syncMs: +sync.toFixed(0), fourFramesMs: +(performance.now() - t0).toFixed(0), parts: Object.fromEntries(Object.entries(T).filter(([k, v]) => !k.endsWith('#') && v > 0.8).map(([k, v]) => [k, `${v.toFixed(1)}ms/${T[k + '#']}`])) });
    await sleep(300);
  }
  return res;
}
