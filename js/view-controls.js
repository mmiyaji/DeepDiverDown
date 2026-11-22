/* 最大化はモデルの読込や 3D 描画の初期化を待たずに操作できる。 */
(() => {
  const toggle = document.querySelector('[data-act="maximize-view"]');
  const nav = document.querySelector('.top [data-act="nav"]');
  toggle.addEventListener('click', event => {
    event.stopPropagation();
    const expanded = document.body.classList.toggle('viewer-maximized');
    toggle.setAttribute('aria-pressed', expanded);
    toggle.textContent = expanded ? '元の表示' : '最大化';
    toggle.title = expanded ? '構成図を元の表示に戻す' : '構成図を画面内で最大化';
    nav.disabled = expanded;
  });
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
    toggle.textContent = open ? '詳細を閉じる' : '詳細を開く';
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
