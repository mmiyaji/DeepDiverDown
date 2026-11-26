import { drawThumbnail } from './home-thumbnail.js';
const $ = id => document.getElementById(id);
const site = $('site');
const notice = $('notice');
const consentKey = 'deepdiverdown-notice-consent-v1';

let accepted = false;
try { accepted = sessionStorage.getItem(consentKey) === 'accepted'; } catch { /* Storage may be unavailable. */ }
if (!accepted) {
  notice.hidden = false;
  site.inert = true;
  $('accept-notice').focus();
}
$('accept-notice').addEventListener('click', () => {
  try { sessionStorage.setItem(consentKey, 'accepted'); } catch { /* Continue without persistence. */ }
  notice.hidden = true;
  site.inert = false;
});
notice.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...notice.querySelectorAll('button')].filter(el => !el.disabled);
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
const modelCache = new Map();
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    observer.unobserve(entry.target);
    const { modelId } = entry.target.dataset;
    if (!modelCache.has(modelId)) {
      const request = fetch(`models/${encodeURIComponent(modelId)}/model.yaml`, { cache: 'no-cache' })
        .then(response => { if (!response.ok) throw new Error('model unavailable'); return response.text(); })
        .then(raw => Layout.apply(jsyaml.load(raw)))
        .catch(error => { modelCache.delete(modelId); throw error; });
      modelCache.set(modelId, request);
    }
    modelCache.get(modelId).then(model => {
      if (entry.target.isConnected) drawThumbnail(entry.target, model);
    }).catch(() => { entry.target.textContent = 'プレビューを読み込めませんでした'; });
  }
}, { rootMargin: '150px' });
function card(entry) {
  const a = element('a', 'card');
  a.href = `index.html#/m/${encodeURIComponent(entry.id)}/struct`;
  const title = element('div', 'card-title');
  title.append(element('h3', '', entry.name), element('p', '', entry.description));
  const content = element('div', 'card-preview', '構成図を読み込み中…');
  content.dataset.modelId = entry.id;
  content.setAttribute('aria-hidden', 'true');
  observer.observe(content);
  const bottom = element('div', 'card-bottom');
  bottom.append(element('span', '', [entry.domain, entry.category].filter(Boolean).join(' / ')), element('span', '', '構成図を開く →'));
  a.append(title, content, bottom);
  return a;
}
let entries = [];
let showAll = false;
let loading = true;
const featured = ['spark', 'kafka', 'spark-streaming', 'flink', 'apache-iceberg', 'databricks', 'snowflake', 'kubernetes', 'monitoring-datadog', 'analytics-agent', 'slack-real-time-messaging', 'autoware-autonomous-driving'];
function render() {
  if (loading) return;
  observer.disconnect();
  const query = $('search').value.trim().toLocaleLowerCase();
  const domain = $('domain').value;
  const matching = entries.filter(entry => (!domain || entry.domain === domain) && [entry.name, entry.description, entry.domain, entry.category, ...(entry.tags || [])].join(' ').toLocaleLowerCase().includes(query));
  const filtered = !showAll && !query && !domain ? matching.filter(entry => featured.includes(entry.id)) : matching;
  $('cards').replaceChildren(...filtered.map(card));
  $('count').textContent = !showAll && !query && !domain ? `代表例 ${filtered.length} 件 / 全 ${entries.length} 件` : `${filtered.length} 件のリファレンス`;
  $('empty').hidden = filtered.length > 0;
  $('show-all').hidden = !!query || !!domain;
  $('show-all').textContent = showAll ? '代表例に戻す' : 'すべてのリファレンスを表示';
  $('show-all').setAttribute('aria-expanded', String(showAll));
}
async function loadEntries() {
  loading = true;
  $('loading').hidden = false;
  $('load-error').hidden = true;
  $('empty').hidden = true;
  $('show-all').hidden = true;
  $('count').textContent = '読み込み中…';
  $('cards').setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('models/research-index.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Reference index unavailable');
    const data = await response.json();
    if (!Array.isArray(data.entries)) throw new Error('Invalid reference index');
    entries = data.entries;
    $('domain').replaceChildren(element('option', '', 'すべて'));
    $('domain').firstElementChild.value = '';
    [...new Set(entries.map(entry => entry.domain).filter(Boolean))].sort().forEach(domain => {
      const option = element('option', '', domain);
      option.value = domain;
      $('domain').append(option);
    });
    loading = false;
    render();
  } catch {
    $('count').textContent = '読み込みエラー';
    $('load-error').hidden = false;
  } finally {
    $('loading').hidden = true;
    $('cards').setAttribute('aria-busy', 'false');
  }
}
loadEntries();
$('retry-load').addEventListener('click', loadEntries);
$('search').addEventListener('input', render);
$('domain').addEventListener('change', render);
$('show-all').addEventListener('click', () => { showAll = !showAll; render(); });
