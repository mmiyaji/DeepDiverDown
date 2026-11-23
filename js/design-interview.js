import { NODE_KINDS } from './node-kinds.js';

const kinds = {
  requirements: ['usecase', 'rule', 'nfr'],
};
const prefix = { requirements: 'req-', nodes: 'node-', links: 'link-' };
const clean = value => typeof value === 'string' ? value.trim().slice(0, 2000) : '';
const list = value => Array.isArray(value) ? value.slice(0, 30) : [];
const references = (value, known) => [...new Set(list(value).filter(id => known.has(id)))];

export function isUndecided(answer) {
  return /^未定[。！!\s]*$/.test(answer.trim());
}

export function applyInterview(draft, proposal, { approved = false, document } = {}) {
  const { model, interview } = draft;
  const owned = interview.owned ||= {};
  let changes = 0;
  function apply(section, make, duplicate) {
    const items = model[section];
    for (const entry of list(proposal?.[section])) {
      const id = entry?.id;
      if (typeof id !== 'string') continue;
      const index = section === 'nodes' ? -1 : items.findIndex(item => item.id === id);
      const current = section === 'nodes' ? (Object.hasOwn(items, id) ? items[id] : undefined) : items[index];
      if (!current && (!id.startsWith(prefix[section]) || !/^[a-z][a-z0-9-]{2,63}$/.test(id))) continue;
      if (current && document !== undefined) continue;
      // AI が生成したときの値と一致する項目だけを更新する。削除された項目も復元しない。
      if ((!approved && current ? owned[id] !== JSON.stringify(current) : !current && Object.hasOwn(owned, id))) continue;
      const quote = typeof entry.quote === 'string' ? entry.quote.trim() : '';
      if (document !== undefined && (!quote || !document.includes(quote))) continue;
      const next = make(entry, current);
      if (next && document !== undefined) next.evidence = [{ type: 'doc', ref: 'inline:取り込み資料', quote }];
      if (!next || duplicate(next, id)) continue;
      if (section === 'nodes') items[id] = next;
      else if (index >= 0) items[index] = next;
      else items.push(next);
      owned[id] = JSON.stringify(next);
      if (!current || owned[id] !== JSON.stringify(current)) changes++;
    }
  }
  apply('nodes', (n, current) => {
    const label = clean(n.label);
    if (!label || (!Object.hasOwn(NODE_KINDS, n.kind) && n.kind !== current?.kind) || !model.tiers.some(t => t.id === n.tier)) return null;
    const next = { ...current, label, kind: n.kind, tier: n.tier, description: clean(n.description), status: 'claim' };
    if (Number.isSafeInteger(n.replicas) && n.replicas > 0) next.replicas = n.replicas;
    if (Array.isArray(n.az) && n.az.length) next.az = n.az.map(clean).filter(Boolean);
    if (['private', 'public'].includes(n.subnet)) next.subnet = n.subnet;
    return next;
  }, (n, id) => Object.entries(model.nodes).some(([key, other]) => key !== id && other.label === n.label));

  apply('links', (l, current) => {
    if (typeof l.from !== 'string' || typeof l.to !== 'string' ||
        !Object.hasOwn(model.nodes, l.from) || !Object.hasOwn(model.nodes, l.to) ||
        l.from === l.to || typeof l.sync !== 'boolean') return null;
    const next = { ...current, id: l.id, from: l.from, to: l.to, sync: l.sync, label: clean(l.label), status: 'claim' };
    if (Number.isSafeInteger(l.timeoutMs) && l.timeoutMs > 0) next.timeoutMs = l.timeoutMs;
    if (Number.isSafeInteger(l.retry) && l.retry >= 0) next.retry = l.retry;
    return next;
  }, (l, id) => model.links.some(other => other.id !== id && other.from === l.from && other.to === l.to && other.sync === l.sync));

  const nodes = new Set(Object.keys(model.nodes)), links = new Set(model.links.map(l => l.id));
  apply('requirements', (q, current) => {
    const title = clean(q.title);
    if (!title || !kinds.requirements.includes(q.kind)) return null;
    return { ...current, id: q.id, title, kind: q.kind, text: clean(q.text), nodes: references(q.nodes, nodes), links: references(q.links, links), status: 'claim' };
  }, (q, id) => model.requirements.some(other => other.id !== id && other.title === q.title));

  const line = clean(proposal?.question).split(/\r?\n/, 1)[0].trim();
  const question = line.match(/^.*?[？?]/)?.[0] || line;
  interview.question = interview.history.some(turn => turn.question === question) ? '' : question;
  interview.inProgress = false;
  return changes;
}
