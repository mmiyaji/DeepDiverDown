// <select> を、ボタンとメニューのプルダウンに置き換える。値と change イベントは元の <select> のものを使う。
export function enhanceSelect(select) {
  if (!select || select._dd) return select?._dd;
  const wrap = document.createElement('div');
  wrap.className = 'dd';
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'dd-button';
  button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', 'false');
  const label = document.createElement('span'); label.className = 'dd-label';
  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chevron.setAttribute('viewBox', '0 0 24 24'); chevron.setAttribute('class', 'dd-chevron'); chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML = '<path d="M6 9l6 6 6-6"/>';
  button.append(label, chevron);
  const menu = document.createElement('ul');
  menu.className = 'dd-menu'; menu.setAttribute('role', 'listbox'); menu.hidden = true;
  select.after(wrap); wrap.append(button, menu);
  select.classList.add('dd-native'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
  if (select.id) button.setAttribute('aria-labelledby', select.labels?.[0]?.id || '');
  const sync = () => { label.textContent = select.selectedOptions[0]?.textContent || ''; };
  const close = (focus) => { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', outside, true); if (focus) button.focus(); };
  const outside = e => { if (!wrap.contains(e.target)) close(); };
  const items = () => [...menu.children];
  const focusItem = i => { const list = items(); if (!list.length) return; list[(i + list.length) % list.length].focus(); };
  const open = () => {
    menu.replaceChildren(...[...select.options].map(o => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option'); li.tabIndex = -1; li.textContent = o.textContent; li.dataset.value = o.value;
      li.setAttribute('aria-selected', String(o.value === select.value));
      return li;
    }));
    menu.hidden = false; button.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside, true);
    const cur = items().findIndex(li => li.getAttribute('aria-selected') === 'true');
    focusItem(Math.max(cur, 0));
  };
  const choose = li => {
    if (select.value !== li.dataset.value) { select.value = li.dataset.value; select.dispatchEvent(new Event('change', { bubbles: true })); }
    sync(); close(true);
  };
  button.addEventListener('click', () => menu.hidden ? open() : close());
  button.addEventListener('keydown', e => { if (menu.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); open(); } });
  menu.addEventListener('click', e => { const li = e.target.closest('li'); if (li) choose(li); });
  menu.addEventListener('keydown', e => {
    const list = items(), i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); focusItem(list.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (i >= 0) choose(list[i]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close();
  });
  select.addEventListener('change', sync);
  sync();
  select._dd = { sync };
  return select._dd;
}
