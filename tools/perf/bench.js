// 性能計測（回転・拡大縮小・切り替えの 1 フレームあたりの時間）。ブラウザで合成モデルを開き、コンソールで import { bench } from "/tools/perf/bench.js" して bench(版) を実行する
export async function bench(version) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const { Scene3D } = await import(`../../js/scene3d.js?v=${version}`);
  if (!window.__benchInstalled) {
    window.__benchInstalled = true;
    const ob = Scene3D.prototype.begin;
    Scene3D.prototype.begin = function (...a) { window.__scene = this; return ob.apply(this, a); };
  }
  const cb = document.getElementById('minimap');
  const poke = () => document.querySelector('[data-legend-toggle="labels"]').click();
  poke(); await sleep(300); poke(); await sleep(300);
  const sc = window.__scene;
  if (!cb.checked) { cb.click(); await sleep(500); }
  if (!sc.miniOn) throw new Error('minimap off');
  const P = { t: {}, n: {} };
  const wrap = (o, name, label) => {
    if (o[name].__w) { o[name].__reset?.(); }
    const orig = o[name].__orig || o[name];
    const f = function (...a) { const s = performance.now(); try { return orig.apply(this, a); } finally { P.t[label] = (P.t[label] || 0) + performance.now() - s; P.n[label] = (P.n[label] || 0) + 1; } };
    f.__w = 1; f.__orig = orig; o[name] = f;
  };
  wrap(sc.renderer, 'render', 'webgl.render'); wrap(sc.labels, 'render', 'css2d.render');
  for (const n of ['placeLabels', 'renderMinimap', 'updateMinimapCamera']) wrap(sc, n, n);
  const report = ms => Object.fromEntries(Object.keys(P.t).map(k => [k, `${P.n[k]}回 ${(P.t[k] / P.n[k]).toFixed(2)}ms/回 計${P.t[k].toFixed(0)}ms (${(P.t[k] / ms * 100).toFixed(0)}%)`]));
  const run = async (label, ms, action) => {
    P.t = {}; P.n = {};
    const frames = []; let first = null, last = null, stop = false;
    const tick = t => {
      if (stop) return;
      if (first === null) first = t;
      if (last !== null) frames.push(t - last);
      last = t; requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    await (action ? action(ms) : sleep(ms));
    stop = true; await sleep(30);
    const s = [...frames].sort((a, b) => a - b);
    return { label, fps: +(frames.length * 1000 / (last - first)).toFixed(1), median: +s[s.length >> 1].toFixed(1), p95: +s[Math.floor(s.length * .95)].toFixed(1), max: +s[s.length - 1].toFixed(1), cost: report(ms) };
  };
  const canvas = document.querySelector('#view canvas');
  const r = canvas.getBoundingClientRect();
  const drag = async ms => {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ev = (type, x, y, buttons) => canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons, isPrimary: true }));
    ev('pointerdown', cx, cy, 1); const t0 = performance.now(); let i = 0;
    while (performance.now() - t0 < ms) { i++; ev('pointermove', cx + Math.sin(i / 10) * 120, cy + Math.cos(i / 14) * 60, 1); await new Promise(res => requestAnimationFrame(res)); }
    ev('pointerup', cx, cy, 0);
  };
  const zoom = async ms => {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const t0 = performance.now(); let i = 0;
    while (performance.now() - t0 < ms) { i++; canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, deltaY: (i % 40 < 20 ? -40 : 40) })); await new Promise(res => requestAnimationFrame(res)); }
  };
  const out = [];
  out.push(await run('idle', 2500));
  if (sc.controls.enableRotate) {
    sc.setDragMode('rotate');
    out.push(await run('rotate', 2500, drag));
  }
  const dragMode = sc.dragMode;
  sc.setDragMode('pan');
  out.push(await run('pan', 2500, drag));
  sc.setDragMode(dragMode);
  out.push(await run('zoom', 2500, zoom));
  // 切り替えの 1 回あたりの待ち時間（クリックから次の描画まで）
  const lat = [];
  for (let i = 0; i < 6; i++) { const labelsBtn = document.querySelector('[data-legend-toggle="labels"]'); const t0 = performance.now(); labelsBtn.click(); const dt = performance.now() - t0; await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))); lat.push([+dt.toFixed(0), +(performance.now() - t0).toFixed(0)]); await sleep(200); }
  out.push({ label: 'toggle labels [click同期ms, 2フレーム後ms]', lat });
  out.push({ info: { drawCalls: sc.renderer.info.render.calls, objects: sc.root.children.length, labels: sc.lbl.children.length, dpr: devicePixelRatio } });
  return out;
}
