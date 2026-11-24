/* 初期表示の状態を、モデルと図の準備が終わるまでビュー内に示す。 */
(() => {
  const overlay = document.getElementById('viewer-loading');
  const title = document.getElementById('viewer-loading-title');
  const detail = document.getElementById('viewer-loading-detail');
  const retry = document.getElementById('viewer-loading-retry');
  const view = document.getElementById('view');
  let pending = true;
  view.setAttribute('aria-busy', 'true');
  retry.addEventListener('click', () => location.reload());
  function fail() {
    if (!pending) return;
    pending = false;
    view.setAttribute('aria-busy', 'false');
    overlay.classList.add('is-error');
    title.textContent = '構成図を読み込めませんでした';
    detail.textContent = '通信状態を確認して、もう一度お試しください。';
    retry.hidden = false;
  }
  window.addEventListener('error', fail);
  window.addEventListener('unhandledrejection', fail);
  window.viewerLoading = {
    drawing() {
      if (!pending) return;
      title.textContent = '構成図を組み立てています';
      detail.textContent = '部品と接続を配置しています。';
    },
    ready() {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!pending) return;
        pending = false;
        view.setAttribute('aria-busy', 'false');
        overlay.hidden = true;
      }));
    },
  };
})();
