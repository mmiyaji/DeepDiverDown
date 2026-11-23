/* 最大化はモデルの読込や 3D 描画の初期化を待たずに操作できる。 */
(() => {
  const toggle = document.querySelector('[data-act="maximize-view"]');
  const nav = document.querySelector('.top [data-act="nav"]');
  toggle.addEventListener('click', event => {
    event.stopPropagation();
    const expanded = document.body.classList.toggle('viewer-maximized');
    toggle.setAttribute('aria-pressed', expanded);
    toggle.querySelector('span').textContent = expanded ? '元に戻す' : '最大化';
    toggle.title = expanded ? '構成図を元の表示に戻す' : '構成図を画面内で最大化';
    nav.disabled = expanded;
  });
})();

/* プルダウン（書き出し・図の表示）：項目を選んだら閉じる。外側クリック・Esc でも閉じる。開くのは 1 つだけ。
   チェックボックスの欄（図の表示の「表示」）は続けて操作できるよう開いたままにする */
(() => {
  const menus = [...document.querySelectorAll('details.menu')];
  for (const menu of menus) {
    menu.addEventListener('click', e => { if (e.target.closest('[role^="menuitem"]')) menu.open = false; });
    menu.addEventListener('toggle', () => { if (menu.open) menus.forEach(m => { if (m !== menu) m.open = false; }); });
  }
  document.addEventListener('click', e => { menus.forEach(m => { if (m.open && !m.contains(e.target)) m.open = false; }); });
  document.addEventListener('keydown', e => {
    const open = menus.find(m => m.open);
    if (e.key === 'Escape' && open) { e.stopPropagation(); open.open = false; open.querySelector('summary').focus(); }
  }, true);
})();

/* 詳細ペインは広い画面では右列、狭い画面では下から開く。 */
(() => {
  const panel = document.getElementById('panel');
  const toggle = document.getElementById('detail-toggle');
  const close = document.getElementById('detail-close');
  const compact = matchMedia('(max-width:900px)');
  let userOpen;

  function render() {
    const open = userOpen ?? !compact.matches;
    if (!open && panel.contains(document.activeElement)) toggle.focus();
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', open);
    toggle.classList.toggle('on', open);
    toggle.title = open ? '詳細パネルを閉じる' : '詳細パネルを開く';
  }

  toggle.addEventListener('click', () => {
    userOpen = panel.hidden;
    render();
    if (userOpen && compact.matches) panel.focus({ preventScroll: true });
  });
  close.addEventListener('click', () => {
    userOpen = false;
    render();
    toggle.focus();
  });
  document.querySelector('a.skip[href="#panel"]').addEventListener('click', event => {
    event.preventDefault();
    if (document.body.classList.contains('viewer-maximized')) {
      document.querySelector('[data-act="maximize-view"]').click();
    }
    userOpen = true;
    render();
    panel.focus();
  });
  compact.addEventListener('change', render);
  render();
})();
