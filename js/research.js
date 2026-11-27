import { applyAppearance, loadSettings } from './settings.js';

applyAppearance(loadSettings());

const byId = id => document.getElementById(id);
const query = byId('research-query');
const domain = byId('research-domain');
const intents = byId('research-intents');
const intentOptions = byId('research-intent-options');
const reset = byId('research-reset');
const status = byId('research-status');
const table = byId('research-table-wrap');
const results = byId('research-results');
const historyList = byId('history-list');
const historyPanel = byId('history-panel');
const historySelection = byId('history-selection');
const error = byId('research-error');
const narrow = matchMedia('(max-width: 760px)');
const candidatesPath = 'docs/reference-modern-data-stack-candidates.md';
const validDocument = path => path === 'README.md' || /^docs\/[a-z0-9-]+\.md$/.test(path);

const intentLabels = new Map([
  ['', 'すべて'],
  ['製品・技術のアーキテクチャ', '製品・技術の構成を知る'],
  ['設計パターン・ユースケース', '設計パターンを学ぶ'],
  ['仕組みの深掘り', '内部の仕組みを理解する'],
]);

let entries = [];
let historyEntries = [];
let selectedHistory = '';
let selectedIntent = '';
let normalizedEntries = [];

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(text, href) {
  const anchor = element('a', text);
  anchor.href = href;
  return anchor;
}

function readerAddress(path, hash = '') {
  const url = new URL(location.href);
  if (path) url.searchParams.set('doc', path);
  else url.searchParams.delete('doc');
  url.hash = hash;
  return url;
}

function documentLink(text, path) {
  if (!validDocument(path)) return null;
  return link(text, readerAddress(path));
}

function sourceLink({ title, url }) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      const anchor = link(title, parsed.href);
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      return anchor;
    }
  } catch {
    return null;
  }
  return null;
}

function appendLinks(container, links) {
  for (const anchor of links.filter(Boolean)) {
    const li = element('li');
    li.append(anchor);
    container.append(li);
  }
}

function diagramLink(id, text, implementation) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return null;
  const base = './#/m/' + encodeURIComponent(id) + '/struct';
  if (!implementation) return link(text, base);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(implementation)) return null;
  return link(text, base + '?w=' + encodeURIComponent('impl:' + implementation));
}

function sourcesFor(entry) {
  const candidates = [...entry.sources, ...entry.implementations.flatMap(impl => impl.sources)];
  return [...new Map(candidates.map(source => [source.url, source])).values()];
}

function rowFor(entry) {
  const row = element('tr');
  row.setAttribute('role', 'row');
  const name = element('th');
  name.scope = 'row';
  name.setAttribute('role', 'rowheader');
  name.append(element('div', entry.name, 'research-title'));
  if (entry.description) name.append(element('p', entry.description, 'research-description'));
  for (const metadata of [
    [entry.domain, entry.kind, entry.category].filter(Boolean).join(' / '),
    entry.tags.join('・'),
  ].filter(Boolean)) name.append(element('div', metadata, 'research-meta'));

  const diagrams = element('td');
  diagrams.setAttribute('role', 'cell');
  const diagramsList = element('ul', '', 'research-link-list');
  appendLinks(diagramsList, [
    diagramLink(entry.id, '機能配置'),
    ...entry.implementations.map(({ id, label }) => diagramLink(entry.id, '実装例 ' + label, id)),
  ]);
  diagrams.append(diagramsList);

  const docs = element('td');
  docs.setAttribute('role', 'cell');
  const docList = element('ul', '', 'research-link-list');
  appendLinks(docList, entry.documents.map((path, index) =>
    documentLink(index === 0 ? '日本語解説' : path.split('/').at(-1), path)));
  if (docList.childElementCount) docs.append(docList);
  const sourceLinks = sourcesFor(entry).map(sourceLink).filter(Boolean);
  if (sourceLinks.length) {
    const disclosure = element('details');
    const list = element('ul', '', 'research-link-list');
    appendLinks(list, sourceLinks);
    disclosure.append(element('summary', '公式資料 ' + sourceLinks.length + '件'), list);
    docs.append(disclosure);
  }
  row.append(name, diagrams, docs);
  return row;
}

function dateLabel(date) {
  const time = element('time', date);
  time.dateTime = date;
  return time;
}

function renderHistoryChoices() {
  const all = element('button', 'すべての収録・見直し', 'history-choice');
  all.type = 'button';
  all.dataset.history = '';
  const choices = historyEntries.map(event => {
    const button = element('button', '', 'history-choice');
    button.type = 'button';
    button.dataset.history = event.id;
    const metadata = element('span', '', 'history-meta');
    metadata.append(dateLabel(event.date), ' ・ ' + event.modelIds.length + '件');
    button.append(element('strong', event.title), metadata);
    return button;
  });
  historyList.replaceChildren(all, ...choices);
}

function renderIntentChoices() {
  const available = new Set(entries.map(entry => entry.kind).filter(Boolean));
  const choices = new Map(intentLabels);
  for (const kind of available) if (!choices.has(kind)) choices.set(kind, kind);
  const options = [];
  for (const [kind, label] of choices) {
    if (kind && !available.has(kind)) continue;
    const option = element('label', '', 'research-intent');
    const radio = element('input');
    radio.type = 'radio';
    radio.name = 'kind';
    radio.value = kind;
    radio.checked = kind === selectedIntent;
    option.append(radio, element('span', label));
    options.push(option);
  }
  intentOptions.replaceChildren(...options);
}

function renderHistorySelection(event) {
  for (const button of historyList.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.history === selectedHistory));
  }
  historySelection.hidden = !event;
  historySelection.replaceChildren();
  if (!event) return;
  const selected = element('p');
  selected.append(element('strong', event.title), ' ・ ', dateLabel(event.date));
  historySelection.append(selected);
  const list = element('ul');
  appendLinks(list, (event.documents || []).map(({ title, path }) => documentLink(title, path)));
  if (list.childElementCount) historySelection.append(list);
}

const normalize = text => text.toString().normalize('NFKC').toLowerCase();

function updateAddress() {
  const address = new URL(location.href);
  for (const [key, value] of [
    ['q', query.value.trim()],
    ['domain', domain.value],
    ['kind', selectedIntent],
    ['history', selectedHistory],
  ]) {
    if (value) address.searchParams.set(key, value);
    else address.searchParams.delete(key);
  }
  history.replaceState(null, '', address);
  byId('research-candidates').href = readerAddress(candidatesPath);
}

function render() {
  const words = normalize(query.value).trim().split(/\s+/).filter(Boolean);
  const event = historyEntries.find(item => item.id === selectedHistory);
  const eventIds = event ? new Set(event.modelIds) : null;
  const output = normalizedEntries.filter(({ entry, searchable }) =>
    (!eventIds || eventIds.has(entry.id))
    && (!domain.value || entry.domain === domain.value)
    && (!selectedIntent || entry.kind === selectedIntent)
    && words.every(word => searchable.includes(word)));
  renderHistorySelection(event);
  results.replaceChildren(...output.map(({ entry }) => rowFor(entry)));
  table.hidden = !output.length;
  status.textContent = output.length
    ? output.length + '件 / リファレンス全' + entries.length + '件'
    : '条件に一致するリファレンスがありません。キーワードや絞り込み条件を変更してください。';
  reset.disabled = !(query.value.trim() || domain.value || selectedIntent || selectedHistory);
}

async function load() {
  error.hidden = true;
  status.hidden = false;
  status.textContent = '調査一覧を読み込み中です。';
  try {
    const response = await fetch('./models/research-index.json');
    if (!response.ok) throw new Error('Research index request failed');
    const data = await response.json();
    if (!Array.isArray(data.entries) || !Array.isArray(data.history)) throw new Error('Invalid research index');
    entries = data.entries;
    historyEntries = data.history.slice().reverse();
    normalizedEntries = entries.map(entry => ({
      entry,
      searchable: normalize([
        entry.id, entry.name, entry.description, entry.domain, entry.kind, entry.category,
        ...entry.tags, ...entry.objectives, ...entry.implementations.map(impl => impl.label),
        ...sourcesFor(entry).map(source => source.title),
      ].join(' ')),
    }));
    const domains = [...new Set(entries.map(entry => entry.domain).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
    domain.append(...domains.map(value => new Option(value, value)));
    const filters = new URLSearchParams(location.search);
    byId('research-candidates').href = readerAddress(candidatesPath);
    query.value = filters.get('q') || '';
    domain.value = domains.includes(filters.get('domain')) ? filters.get('domain') : '';
    selectedIntent = entries.find(entry => entry.kind === filters.get('kind'))?.kind || '';
    selectedHistory = historyEntries.find(event => event.id === filters.get('history'))?.id || '';
    if (selectedHistory) historyPanel.open = true;
    query.disabled = domain.disabled = intents.disabled = false;
    renderIntentChoices();
    renderHistoryChoices();
    render();
  } catch {
    error.hidden = false;
    status.hidden = true;
  }
}

function markdownLink(title, href, currentPath) {
  const external = sourceLink({ title, url: href });
  if (external) return external;
  if (href.startsWith('#')) return link(title, href);
  const root = new URL('./', location.href);
  const target = new URL(href, new URL(currentPath, root));
  if (target.origin !== root.origin || !target.pathname.startsWith(root.pathname)) return null;
  const path = target.pathname.slice(root.pathname.length);
  return validDocument(path) ? link(title, readerAddress(path, target.hash)) : null;
}

function appendInline(element, text, path) {
  let offset = 0;
  for (const token of text.matchAll(/\[([^\]\n]+)\]\(([^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g)) {
    element.append(text.slice(offset, token.index));
    const [, label, href, code, strong] = token;
    let node;
    if (label) {
      try { node = markdownLink(label, href, path); }
      catch { node = null; }
    } else {
      node = document.createElement(code ? 'code' : 'strong');
      node.textContent = code || strong;
    }
    element.append(node || label || token[0]);
    offset = token.index + token[0].length;
  }
  element.append(text.slice(offset));
}

function renderMarkdown(article, markdown, path) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const listLine = /^(?:[-*]|\d+\.)\s+(.+)/;
  const tableLine = /^\s*\|.*\|\s*$/;
  const appendText = (tag, text, container = article) => {
    const node = element(tag);
    appendInline(node, text, path);
    container.append(node);
    return node;
  };
  for (let i = 0; i < lines.length;) {
    const line = lines[i++].trim();
    if (!line) continue;
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const node = appendText('h' + heading[1].length, heading[2]);
      node.id = node.textContent.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');
    } else if (line.startsWith('```')) {
      const code = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++]);
      i++;
      const pre = element('pre');
      pre.append(element('code', code.join('\n')));
      article.append(pre);
    } else if (tableLine.test(line) && /^\s*\|[\s|:-]+\|\s*$/.test(lines[i] || '')) {
      i++;
      const wrap = element('div', '', 'article-table-wrap');
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', '解説の表');
      const table = element('table');
      const header = table.createTHead().insertRow();
      const body = table.createTBody();
      const addCells = (row, text, tag) => {
        for (const cell of text.trim().slice(1, -1).split('|')) {
          const node = appendText(tag, cell.trim(), row);
          if (tag === 'th') node.scope = 'col';
        }
      };
      addCells(header, line, 'th');
      while (tableLine.test(lines[i] || '')) addCells(body.insertRow(), lines[i++], 'td');
      wrap.append(table);
      article.append(wrap);
    } else if (listLine.test(line)) {
      const list = element(/^\d/.test(line) ? 'ol' : 'ul');
      appendText('li', line.match(listLine)[1], list);
      while (listLine.test(lines[i] || '')) appendText('li', lines[i++].match(listLine)[1], list);
      article.append(list);
    } else if (line.startsWith('> ')) {
      appendText('blockquote', line.slice(2));
    } else {
      appendText('p', line);
    }
  }
}

async function openReader(path) {
  const reader = byId('research-reader');
  const article = byId('research-article');
  byId('research-heading').hidden = byId('research-list-view').hidden = true;
  reader.hidden = false;
  byId('research-back').href = readerAddress(null);
  document.querySelector('.skip').href = '#research-reader';
  reader.tabIndex = -1;
  try {
    if (!validDocument(path)) throw new Error('Invalid document path');
    const response = await fetch('./' + path);
    if (!response.ok) throw new Error('Document request failed');
    renderMarkdown(article, await response.text(), path);
    const heading = article.querySelector('h1');
    if (heading) document.title = heading.textContent + ' | DeepDiverDown';
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  } catch {
    byId('research-reader-error').hidden = false;
  } finally {
    byId('research-reader-status').hidden = true;
  }
}

function refreshFilters() {
  updateAddress();
  render();
}

query.addEventListener('input', refreshFilters);
domain.addEventListener('change', refreshFilters);
intentOptions.addEventListener('change', event => {
  selectedIntent = event.target.value;
  refreshFilters();
});
byId('filters').addEventListener('submit', event => event.preventDefault());
byId('filters').addEventListener('reset', event => {
  event.preventDefault();
  query.value = domain.value = selectedHistory = selectedIntent = '';
  intentOptions.querySelector('input').checked = true;
  refreshFilters();
  query.focus();
});
historyList.addEventListener('click', event => {
  const button = event.target.closest('button[data-history]');
  if (!button) return;
  selectedHistory = button.dataset.history;
  refreshFilters();
  if (narrow.matches) {
    historyPanel.open = false;
    byId('reference-search').focus();
  }
});
byId('research-retry').addEventListener('click', load);
const requestedDoc = new URLSearchParams(location.search).get('doc');
if (requestedDoc) openReader(requestedDoc);
else load();
