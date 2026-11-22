/* モデルの読み込み：リポジトリのモデル（registry.json）と、ブラウザに読み込んだローカルのモデル */
const LOCAL = 'ddd.local';      // 読み込んだ YAML（最大 5 件）
const CMP = 'ddd.compare.';     // モデルごとの比較対象 YAML

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* noop */ } },
};
const text = async p => { const r = await fetch(p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.text(); };

/* 最低限の形をチェック。問題があればメッセージの配列を返す */
export function validate(m) {
  const e = [];
  if (!m || typeof m !== 'object') return ['YAML の最上位がオブジェクトではありません'];
  if (!m.name) e.push('name がありません');
  if (!Array.isArray(m.tiers) || !m.tiers.length) e.push('tiers（フロア）がありません');
  if (!m.nodes || typeof m.nodes !== 'object') e.push('nodes がありません');
  if (!Array.isArray(m.links)) e.push('links がありません');
  if (e.length) return e;
  const tiers = new Set(m.tiers.map(t => t.id));
  for (const [id, n] of Object.entries(m.nodes)) if (!tiers.has(n.tier)) e.push(`nodes.${id}.tier「${n.tier}」が tiers にありません`);
  for (const l of m.links) if (!m.nodes[l.from] || !m.nodes[l.to]) e.push(`links.${l.id} の from / to が nodes にありません`);
  return e;
}

export async function loadRegistry() {
  const reg = JSON.parse(await text('models/registry.json'));
  const local = store.get(LOCAL, []).map(x => ({ id: x.id, local: true, name: x.name }));
  return [...reg, ...local];
}

export async function loadEntry(entry) {
  if (entry.local) {
    const x = store.get(LOCAL, []).find(y => y.id === entry.id);
    return { model: jsyaml.load(x.yaml), actual: null, docs: {} };
  }
  const model = jsyaml.load(await text(`models/${entry.id}/model.yaml`));
  const actual = entry.actual ? jsyaml.load(await text(`models/${entry.id}/actual.yaml`)) : null;
  return { model, actual, docs: await loadDocs(model) };
}

export async function loadDocs(model) {
  const docs = {};
  for (const src of model.sources || []) { try { docs[src] = Analyze.parseSections(await text(src)); } catch { /* 設計書がない */ } }
  return docs;
}

/* YAML テキストをローカルモデルとして保存し、ID を返す */
export function saveLocal(yamlText, fileName) {
  const model = jsyaml.load(yamlText), errors = validate(model);
  if (errors.length) return { errors };
  const id = 'local-' + Date.now().toString(36);
  const list = [{ id, name: `${model.name}（${fileName}）`, yaml: yamlText }, ...store.get(LOCAL, [])].slice(0, 5);
  return store.set(LOCAL, list) ? { id } : { errors: ['ブラウザに保存できませんでした（容量やプライベートモードを確認してください）'] };
}
export function removeLocal(id) { store.set(LOCAL, store.get(LOCAL, []).filter(x => x.id !== id)); }

/* 比較対象：ユーザーが読み込んだもの → registry の compare の順で探す */
export async function loadCompare(key, entry) {
  const own = store.get(CMP + key, null);
  if (own) return { model: jsyaml.load(own.yaml), label: own.label, own: true };
  if (entry.compare) return { model: jsyaml.load(await text(entry.compare.path)), label: entry.compare.label, own: false };
  return null;
}
export function saveCompare(key, yamlText, fileName) {
  const model = jsyaml.load(yamlText), errors = validate(model);
  if (errors.length) return { errors };
  return store.set(CMP + key, { yaml: yamlText, label: fileName }) ? {} : { errors: ['ブラウザに保存できませんでした'] };
}
export function clearCompare(key) { store.del(CMP + key); }
