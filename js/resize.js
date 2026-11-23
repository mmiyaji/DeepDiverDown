/* 領域の大きさをドラッグで変える：サイドバーの幅・詳細パネルの幅・図の下の見取り図の高さ。
   境界の取っ手をドラッグ（キーボードでは ← → ↑ ↓）、ダブルクリックで既定に戻す。大きさはブラウザに保存する */
const KEY = 'ddd.sizes';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 保存できなくても動かす */ } };

const SPECS = {
  side: { cssVar: '--side', min: 180, max: () => Math.min(520, innerWidth * 0.4), axis: 'x', sign: 1, label: 'サイドバーの幅' },
  pane: { cssVar: '--pane', min: 280, max: () => Math.min(900, innerWidth * 0.6), axis: 'x', sign: -1, label: '詳細パネルの幅' },
  dock: { cssVar: '--dock', min: 120, max: () => Math.max(160, (document.querySelector('.stage')?.clientHeight || innerHeight) - 200), axis: 'y', sign: -1, label: '見取り図の高さ' },
};

export function initResize({ onChange } = {}) {
  const sizes = load(), root = document.documentElement;
  const apply = (k, v) => {
    const s = SPECS[k], px = Math.round(Math.max(s.min, Math.min(s.max(), v)));
    root.style.setProperty(s.cssVar, px + 'px');
    if (k === 'dock') document.body.classList.add('dock-sized');
    sizes[k] = px; return px;
  };
  for (const k of Object.keys(SPECS)) if (sizes[k]) apply(k, sizes[k]);

  const current = k => {
    if (k === 'dock') return document.getElementById('filemap')?.getBoundingClientRect().height || 240;
    return parseFloat(getComputedStyle(root).getPropertyValue(SPECS[k].cssVar)) || 0;
  };
  const make = (k, parent, before) => {
    const s = SPECS[k], h = document.createElement('div');
    h.className = `rz rz-${k}`; h.tabIndex = 0; h.setAttribute('role', 'separator');
    h.setAttribute('aria-orientation', s.axis === 'x' ? 'vertical' : 'horizontal');
    h.setAttribute('aria-label', `${s.label}（ドラッグで変更、ダブルクリックで元に戻す）`); h.title = h.getAttribute('aria-label');
    before ? parent.insertBefore(h, before) : parent.append(h);
    h.addEventListener('pointerdown', e => {
      e.preventDefault(); h.setPointerCapture(e.pointerId);
      const start = s.axis === 'x' ? e.clientX : e.clientY, base = current(k);
      document.body.classList.add('rz-dragging', `rz-dragging-${s.axis}`);
      const move = ev => { apply(k, base + ((s.axis === 'x' ? ev.clientX : ev.clientY) - start) * s.sign); onChange?.(); };
      const up = () => { h.removeEventListener('pointermove', move); document.body.classList.remove('rz-dragging', `rz-dragging-${s.axis}`); save(sizes); onChange?.(); };
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', up, { once: true });
      h.addEventListener('pointercancel', up, { once: true });
    });
    h.addEventListener('dblclick', () => {
      delete sizes[k]; root.style.removeProperty(s.cssVar);
      if (k === 'dock') document.body.classList.remove('dock-sized');
      save(sizes); onChange?.();
    });
    h.addEventListener('keydown', e => {
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[e.key]; if (!d) return;
      e.preventDefault(); apply(k, current(k) + d * 20 * s.sign); save(sizes); onChange?.();
    });
  };
  const shell = document.querySelector('.shell');
  if (shell) { make('side', shell); make('pane', shell); }
  const dock = document.getElementById('filemap');
  if (dock) make('dock', dock.parentNode, dock);
}
