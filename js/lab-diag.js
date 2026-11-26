/* lab=diag2d：2D の図の大きさの食い違いを調べる診断表示。画面の左上に数値を出す（iPad などで再現しないときの調査用） */
const box = document.createElement('pre');
box.style.cssText = 'position:fixed;left:4px;top:60px;z-index:99999;margin:0;padding:6px 8px;background:#000c;color:#9f9;font:11px/1.35 monospace;max-width:92vw;white-space:pre-wrap;pointer-events:none';
document.body.append(box);
const r = e => { const b = e?.getBoundingClientRect(); return b ? `${b.width.toFixed(0)}x${b.height.toFixed(0)}` : '-'; };
function update() {
  const v = document.getElementById('view'), cv = document.querySelector('.compare-viewport');
  const card = document.querySelector('.n-card'), canvas = v?.querySelector('canvas');
  const cs = v && getComputedStyle(v);
  box.textContent = [
    navigator.userAgent.replace(/\).*/, ')'),
    `inner ${innerWidth}x${innerHeight} dpr ${devicePixelRatio} vv.scale ${visualViewport?.scale?.toFixed(2)} vv ${visualViewport?.width?.toFixed(0)}x${visualViewport?.height?.toFixed(0)}`,
    `view.style.zoom=${v?.style.zoom} computed.zoom=${cs?.zoom} min=${v?.style.minWidth}x${v?.style.minHeight}`,
    `view rect ${r(v)} offset ${v?.offsetWidth}x${v?.offsetHeight} client ${v?.clientWidth}x${v?.clientHeight}`,
    `stage rect ${r(cv)} client ${cv?.clientWidth}x${cv?.clientHeight} scroll ${cv?.scrollWidth}x${cv?.scrollHeight}`,
    `canvas rect ${r(canvas)} attr ${canvas?.width}x${canvas?.height} css ${canvas?.style.width}x${canvas?.style.height}`,
    `card rect ${r(card)} offset ${card?.offsetWidth}x${card?.offsetHeight} font ${card && getComputedStyle(card).fontSize} room ${card?.style.getPropertyValue('--card-room')}`,
    `labelScale var ${getComputedStyle(document.documentElement).getPropertyValue('--lbl-scale')} cards ${document.querySelectorAll('.n-card').length}`,
  ].join('\n');
}
setInterval(update, 700); update();
