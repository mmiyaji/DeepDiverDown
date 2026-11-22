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
