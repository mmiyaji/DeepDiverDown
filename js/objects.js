import { NODE_KINDS, SHAPE_OVERRIDES, nodeGlyph } from './node-kinds.js';
import { loadServiceIcons } from './service-icons.js';
import { applyAppearance, loadSettings } from './settings.js';

const settings = loadSettings();
applyAppearance(settings);
const iconsReady = settings.officialIcons ? loadServiceIcons() : Promise.resolve({});

const form = document.querySelector('.objects-search');
const query = document.querySelector('#objects-query');
const clear = document.querySelector('#objects-clear');
const status = document.querySelector('#objects-count');
const catalog = window.Catalog;
const sampleDialog = document.querySelector('#objects-sample-dialog');
const sampleModes = [['2d', '2Dカード'], ['3d', '3D立体']];
const serviceSamples = { box: 'service', cyl: 'db', queue: 'queue' };

const kinds = Object.entries(NODE_KINDS).map(([id, info]) => ({ id, ...info }));
const shapes = Object.entries(SHAPE_OVERRIDES).map(([id, info]) => ({ id, ...info }));
const services = Object.entries(catalog.SERVICES).flatMap(([provider, entries]) =>
  Object.keys(entries).map(key => catalog.lookup(`${provider}:${key}`))
).sort((a, b) => a.providerLabel.localeCompare(b.providerLabel, 'ja') || a.name.localeCompare(b.name, 'ja'));

function element(tag, content, className) {
  const el = document.createElement(tag);
  if (content) el.textContent = content;
  if (className) el.className = className;
  return el;
}

function symbol(shape, kind) {
  const el = element('span', '', 'objects-symbol');
  el.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('stroke-linecap', 'round');
  // The shared renderer only returns fixed glyph markup.
  svg.innerHTML = nodeGlyph(shape, kind);
  el.append(svg);
  return el;
}

function sampleImage(id, mode, alt, lazy = false) {
  const img = element('img');
  img.src = `docs/object-samples/${mode}-${id}.png`;
  img.alt = alt;
  img.width = mode === '2d' ? 328 : 672;
  img.height = mode === '2d' ? 176 : 392;
  img.decoding = 'async';
  if (lazy) img.loading = 'lazy';
  return img;
}

function preview(id, name, serviceId) {
  const compact = Boolean(serviceId);
  const cell = element('td', '', compact ? 'objects-preview-cell objects-preview-compact' : 'objects-preview-cell');
  cell.setAttribute('role', 'cell');
  const button = element('button', '', 'objects-preview');
  button.type = 'button';
  let title = compact ? name + 'の形状見本' : name + 'の画像サンプル';
  let officialIcon;
  button.setAttribute('aria-label', title + 'を拡大');
  const modes = compact ? sampleModes.slice(1) : sampleModes;
  for (const [mode, caption] of modes) {
    const item = element('span', '', 'objects-preview-item');
    item.append(sampleImage(id, mode, '', true));
    if (!compact) item.append(element('span', caption));
    button.append(item);
  }
  if (compact) {
    iconsReady.then(icons => {
      if (!icons[serviceId] || !button.isConnected) return;
      const item = button.firstElementChild;
      const icon = element('img', '', 'objects-service-icon-pending');
      icon.alt = '';
      icon.loading = 'lazy';
      icon.addEventListener('load', () => {
        officialIcon = icon.src;
        title = name + 'の公式アイコン';
        button.setAttribute('aria-label', title + 'を拡大');
        icon.classList.remove('objects-service-icon-pending');
        icon.classList.add('objects-service-icon');
        item.replaceChildren(icon);
      }, { once: true });
      icon.addEventListener('error', () => icon.remove(), { once: true });
      icon.src = icons[serviceId];
      item.append(icon);
    });
  }
  button.addEventListener('click', () => {
    sampleDialog.querySelector('h2').textContent = title;
    const images = sampleModes.map(([mode, caption]) => {
      const figure = element('figure');
      figure.append(element('figcaption', compact ? caption + 'の形状見本' : caption),
        sampleImage(id, mode, NODE_KINDS[id]?.label || name));
      return figure;
    });
    if (officialIcon) {
      const figure = element('figure', '', 'objects-official-figure');
      const icon = element('img', '', 'objects-service-icon');
      icon.alt = name + 'の公式アイコン';
      icon.src = officialIcon;
      figure.append(element('figcaption', '公式アイコン'), icon);
      images.unshift(figure);
    }
    sampleDialog.querySelector('#objects-sample-figures').replaceChildren(...images);
    sampleDialog.showModal();
  });
  cell.append(button);
  return cell;
}

function objectRow(info, showExample) {
  const row = element('tr');
  const title = element('th');
  row.setAttribute('role', 'row');
  title.setAttribute('role', 'rowheader');
  title.scope = 'row';
  const key = element('div', '', 'objects-kind');
  const name = element('span', info.label);
  name.append(element('code', info.id));
  key.append(symbol(info.shape || info.id, showExample ? info.id : undefined), name);
  title.append(key);
  const description = element('td', info.description);
  description.setAttribute('role', 'cell');
  row.append(title, preview(info.id, info.label), description);
  if (showExample) {
    const example = element('td');
    example.className = 'objects-example';
    example.setAttribute('role', 'cell');
    if (info.example) {
      const link = element('a', '図を開く');
      link.href = './#/m/' + encodeURIComponent(info.example) + '/struct';
      link.setAttribute('aria-label', info.label + 'の使用例の図を開く');
      example.append(link);
    } else {
      example.textContent = '—';
    }
    row.append(example);
  }
  return row;
}

function serviceRow(service) {
  const row = element('tr');
  const name = element('th', '', 'objects-service-name');
  name.scope = 'row';
  const display = element('div', '', 'objects-kind');
  display.append(symbol(service.shape || 'box'), element('span', service.name));
  name.append(display);
  const value = element('td');
  const shape = serviceSamples[service.shape] || serviceSamples.box;
  value.append(element('span', service.providerLabel), element('code', service.id));
  row.append(name, preview(shape, service.name, service.id), value);
  return row;
}

function showRows(sectionId, pool, needles, searchable, rowFor) {
  const matches = pool.filter(item => {
    const content = searchable(item).filter(Boolean).join(' ').normalize('NFKC').toLowerCase();
    return needles.every(needle => content.includes(needle));
  });
  const section = document.getElementById(sectionId);
  section.querySelector('tbody').replaceChildren(...matches.map(rowFor));
  section.querySelector('table').hidden = !matches.length;
  section.querySelector('.objects-empty').hidden = !!matches.length;
  return matches.length;
}

function render() {
  const value = query.value.trim().normalize('NFKC').toLowerCase();
  const words = value ? value.split(/\s+/) : [];
  const objectTerms = info => [info.id, info.label, info.description, info.shape];
  const kindCount = showRows('kinds', kinds, words, objectTerms, info => objectRow(info, true));
  const shapeCount = showRows('shapes', shapes, words, objectTerms, info => objectRow(info, false));
  const serviceCount = showRows('services', services, words,
    service => [service.id, service.name, service.abbr, service.providerLabel], serviceRow);
  clear.disabled = !query.value;
  status.textContent = `部品の種類 ${kindCount} 件 · 形状 ${shapeCount} 件 · サービス ${serviceCount} 件`;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('reset', event => {
  event.preventDefault();
  query.value = '';
  render();
  query.focus();
});
query.addEventListener('input', render);
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === '/' && !document.activeElement.matches('input, textarea, select, [contenteditable]')) {
    event.preventDefault();
    query.focus();
  }
  if (event.key === 'Escape' && document.activeElement === query && query.value) form.reset();
});

render();
