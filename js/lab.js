/* モデルビューの試作を切り替えるフラグ。index.html?lab=名前,名前 で有効にし、タブの間は sessionStorage に覚える。
   ?lab=off で全部解除。試作の名前は docs/model-view-lab.md に一覧がある。 */
const KEY = 'ddd.lab';
function read() {
  let raw = null;
  try { raw = new URLSearchParams(location.search).get('lab'); } catch {}
  try {
    if (raw === null) raw = sessionStorage.getItem(KEY);
    else sessionStorage.setItem(KEY, raw === 'off' ? '' : raw);
  } catch {}
  return new Set(raw && raw !== 'off' ? raw.split(',').map(s => s.trim()).filter(Boolean) : []);
}
export const LAB = read();
export const lab = name => LAB.has(name);
