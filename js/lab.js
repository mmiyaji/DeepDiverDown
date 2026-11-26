/* モデルビューの機能フラグ。採用済みの試作（DEFAULT_ON）は既定で有効。
   index.html?lab=名前,名前 で試作を追加し、?lab=-名前 で採用済みを外し、?lab=off で全部外す（比較用）。
   指定はタブの間は sessionStorage に覚える。名前と内容は docs/model-view-lab.md。 */
const KEY = 'ddd.lab';
export const DEFAULT_ON = ['layout-flow', 'layout-layers', 'select-fast', 'flow-numbers', 'flow-trail', 'camera-auto'];
function read() {
  let raw = null;
  try { raw = new URLSearchParams(location.search).get('lab'); } catch {}
  try {
    if (raw === null) raw = sessionStorage.getItem(KEY);
    else sessionStorage.setItem(KEY, raw);
  } catch {}
  const names = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (names.includes('off')) return new Set();
  const on = new Set(DEFAULT_ON);
  for (const n of names) { if (n.startsWith('-')) on.delete(n.slice(1)); else on.add(n); }
  return on;
}
export const LAB = read();
export const lab = name => LAB.has(name);
