/* lab=diag2d：2D の図の大きさの食い違いを調べる診断表示。画面の左上に数値を出す（iPad などで再現しないときの調査用） */
const box = document.createElement('pre');
box.style.cssText = 'position:fixed;left:4px;top:60px;z-index:99999;margin:0;padding:6px 8px;background:#000c;color:#9f9;font:11px/1.35 monospace;max-width:92vw;white-space:pre-wrap;pointer-events:none';
document.body.append(box);
const r = e => { const b = e?.getBoundingClientRect(); return b ? `${b.width.toFixed(0)}x${b.height.toFixed(0)}` : '-'; };
const f = (n, d = 2) => (typeof n === 'number' ? n.toFixed(d) : String(n));

function sceneLines() {
  const S = window.__ddScene, out = [];
  if (S) {
    const c = S.camera;
    out.push(`camera zoom ${f(c.zoom, 3)} frustum ${f(S.frustum)} l/r ${f(c.left, 1)}/${f(c.right, 1)} t/b ${f(c.top, 1)}/${f(c.bottom, 1)} flat ${S.flat} unitsPerPx ${f(S.comparisonScale, 5)}`);
  }
  for (const e of document.querySelectorAll('.n-card')) {
    const b = e.getBoundingClientRect();
    out.push(`${(e.textContent || '').trim().slice(0, 10)} x${b.left.toFixed(0)} y${b.top.toFixed(0)} ${b.width.toFixed(0)}x${b.height.toFixed(0)} vis=${e.style.visibility || 'v'} room=${e.style.getPropertyValue('--card-room')}`);
  }
  return out;
}

function update() {
  const v = document.getElementById('view'), cv = document.querySelector('.compare-viewport');
  const card = document.querySelector('.n-card'), canvas = v?.querySelector('canvas');
  const cs = v && getComputedStyle(v);
  box.textContent = [
    navigator.userAgent.replace(/\).*/, ')'),
    `inner ${innerWidth}x${innerHeight} dpr ${devicePixelRatio} vv.scale ${f(visualViewport?.scale)} vv ${f(visualViewport?.width, 0)}x${f(visualViewport?.height, 0)}`,
    `view.style.zoom=${v?.style.zoom} computed.zoom=${cs?.zoom} min=${v?.style.minWidth}x${v?.style.minHeight}`,
    `view rect ${r(v)} offset ${v?.offsetWidth}x${v?.offsetHeight} client ${v?.clientWidth}x${v?.clientHeight}`,
    `stage rect ${r(cv)} client ${cv?.clientWidth}x${cv?.clientHeight} scroll ${cv?.scrollWidth}x${cv?.scrollHeight}`,
    `canvas rect ${r(canvas)} attr ${canvas?.width}x${canvas?.height} css ${canvas?.style.width}x${canvas?.style.height}`,
    `card0 font ${card && getComputedStyle(card).fontSize} labelScale ${getComputedStyle(document.documentElement).getPropertyValue('--lbl-scale')}`,
    ...sceneLines(),
  ].join('\n');
}
setInterval(update, 700); update();
