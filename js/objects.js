import { NODE_KINDS, SHAPE_OVERRIDES, nodeGlyph } from './node-kinds.js';
import { applyAppearance, loadSettings } from './settings.js';

applyAppearance(loadSettings());

const form = document.querySelector('.objects-search');
const query = document.querySelector('#objects-query');
const clear = document.querySelector('#objects-clear');
const status = document.querySelector('#objects-count');
const catalog = window.Catalog;

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

function symbol(shape) {
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
  svg.innerHTML = nodeGlyph(shape);
  el.append(svg);
  return el;
}

function objectRow(info, showExample) {
  const row = element('tr');
  const title = element('th');
  title.scope = 'row';
  const key = element('div', '', 'objects-kind');
  const name = element('span', info.label);
  name.append(element('code', info.id));
  key.append(symbol(info.shape || info.id), name);
  title.append(key);
  row.append(title, element('td', info.description));
  if (showExample) {
    const example = element('td');
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
  value.append(element('code', service.id));
  row.append(name, element('td', service.providerLabel), value);
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
