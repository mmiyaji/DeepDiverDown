/* 要件と設計案を段階的に整理し、ビューアと同じモデル形式で保存する。 */
import { loadDesignDrafts, saveDesignDraft } from './loader.js';
import { AI_PROVIDERS } from './settings.js';
import { applyInterview, isUndecided } from './design-interview.js';

const pendingInterviews = new Set();
let refreshInterview;
const AI_LOCAL_URL = 'http://127.0.0.1:8125/';

const STEPS = [
  ['overview', '目的・範囲'], ['interview', 'AI と対話'], ['assist', 'AI 取り込み・指摘'], ['requirements', '要件'], ['nodes', '構成部品'],
  ['links', '接続'], ['unknowns', '未決事項'], ['review', 'レビュー'],
];
const TIERS = [['entry', '利用者・入口'], ['app', 'アプリケーション'], ['data', 'データ']];
const KINDS = [
  ['actor', '利用者・運用者'], ['client', 'クライアント'], ['cdn', 'CDN'], ['external', '外部システム'], ['lb', 'ロードバランサー'],
  ['service', 'サービス'], ['worker', 'ワーカー'], ['db', 'データベース'], ['queue', 'キュー'], ['cache', 'キャッシュ'],
];
const REQUIREMENTS = [['usecase', 'ユースケース'], ['rule', '業務ルール'], ['nfr', '非機能要件']];
const esc = value => String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const idFor = prefix => `${prefix}-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
const options = (items, value) => items.map(([id, label]) =>
  `<option value="${esc(id)}"${id === value ? ' selected' : ''}>${esc(label)}</option>`).join('');
const select = (name, items, value, required = true) => `<select name="${name}"${required ? ' required' : ''}>${options(items, value)}</select>`;
const input = (name, value, extra = '') => `<input name="${name}" value="${esc(value)}" ${extra}>`;
const area = (name, value, required = false) => `<textarea name="${name}" rows="3"${required ? ' required' : ''}>${esc(value)}</textarea>`;
const details = (label, body) => `<details class="design-details"><summary>${label}</summary><div>${body}</div></details>`;
const requirement = (id, title, fields = {}) => ({
  id, title, kind: 'usecase', text: '', nodes: [], links: [], status: 'claim', ...fields,
});
const linesOf = notes => notes.split(/\r?\n/)
  .map(line => line.trim().replace(/^(?:[-*]\s+|[・•]\s*|\d+[.)、]\s+)/, ''))
  .map(line => line.trim()).filter(Boolean);

function newDraft() {
  return {
    id: idFor('design'), step: 'overview',
    model: {
      name: '', description: '',
      tiers: TIERS.map(([id, label], i) => ({ id, label, z: 2 - i })),
      nodes: {}, links: [], requirements: [], unknowns: [],
    },
  };
}

export function openDesign(root, { key, download, finding, base, aiProvider }) {
  const provider = aiProvider === 'codex' ? 'codex' : 'claude';
  const providerLabel = AI_PROVIDERS[provider];
  const drafts = loadDesignDrafts();
  const recent = Object.values(drafts).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  let draft = drafts[key] || recent[0] || newDraft();
  let editing = null;
  let assistBusy = false, assistPreview = null, assistError = '';
  if (finding) {
    if (!drafts[key] && base) {
      draft = newDraft();
      draft.model = structuredClone(base);
      draft.model.name += '（対応案）';
      draft.model.requirements ||= [];
      draft.model.unknowns ||= [];
    }
    draft.assistFinding = finding;
    draft.step = 'assist';
  }
  const model = () => draft.model;
  const nodeChoices = () => Object.entries(model().nodes).map(([id, n]) => [id, n.label]);
  const linkChoices = () => model().links.map(l => [l.id, `${model().nodes[l.from].label} → ${model().nodes[l.to].label}`]);
  const references = (name, items, values = []) => items.length
    ? `<fieldset><legend>${name === 'nodes' ? '関連する部品' : name === 'links' ? '関連する接続' : '関連する項目'}</legend>
        ${items.map(([id, label]) => `<label><input type="checkbox" name="${name}" value="${esc(id)}"${values.includes(id) ? ' checked' : ''}> ${esc(label)}</label>`).join('')}
      </fieldset>`
    : '';
  const records = step => step === 'nodes' ? Object.entries(model().nodes) : model()[step].map(e => [e.id, e]);
  const labelOf = (step, item) => {
    if (step === 'links') return `${model().nodes[item.from].label} → ${model().nodes[item.to].label}${item.sync ? '（同期）' : '（非同期）'}`;
    return item.title || item.label || item.text;
  };

  function persist() {
    draft.updatedAt = Date.now();
    drafts[draft.id] = draft;
    if (!saveDesignDraft(draft)) {
      root.querySelector('[role="status"]').textContent = 'ブラウザに保存できませんでした。データはこの画面を閉じるまで保持されます。';
      return false;
    }
    return true;
  }

  function editFields(step, entry) {
    if (step === 'requirements') return `
      <label>要件名 ${input('title', entry.title, 'required')}</label>
      ${details('種別・受け入れ条件・関連づけ（任意）', `
        <label>種別 ${select('kind', REQUIREMENTS, entry.kind)}</label>
        <label>受け入れ条件 ${area('text', entry.text)}</label>
        ${references('nodes', nodeChoices(), entry.nodes)}
        ${references('links', linkChoices(), entry.links)}`)}`;
    if (step === 'nodes') return `
      <label>部品名 ${input('label', entry.label, 'required')}</label>
      ${details('種別・配置・台数など（任意）', `
      <label>種別 ${select('kind', KINDS, entry.kind || 'service')}</label>
      <label>配置 ${select('tier', model().tiers.map(tier => [tier.id, tier.label]), entry.tier || model().tiers.find(t => t.id === 'app')?.id)}</label>
      <label>クラウドサービス（任意）
        ${select('svc', [['', '指定なし'], ...Object.entries(Catalog.SERVICES).flatMap(([provider, services]) =>
          Object.entries(services).map(([id, service]) => [`${provider}:${id}`, `${Catalog.PROVIDERS[provider].label} / ${service.name}`]))], entry.svc, false)}
      </label>
      <label>台数（未決なら空欄） ${input('replicas', entry.replicas, 'type="number" min="1" step="1"')}</label>
      <label>採用理由・前提（任意） ${area('description', entry.description)}</label>`)}`;
    if (step === 'links') return `
      <label>送信元 ${select('from', nodeChoices(), entry.from)}</label>
      <label>宛先 ${select('to', nodeChoices(), entry.to || nodeChoices()[1]?.[0])}</label>
      ${details('通信方式・タイムアウト（任意、初期値は同期）', `
      <label>方式 ${select('sync', [['sync', '同期'], ['async', '非同期']], entry.sync === false ? 'async' : 'sync')}</label>
      <label>タイムアウト（ms、未決なら空欄） ${input('timeoutMs', entry.timeoutMs, 'type="number" min="1" step="1"')}</label>
      <label>目的・通信内容（任意） ${input('label', entry.label)}</label>`)}`;
    return `
      <label>確認すべきこと ${area('text', entry.text, true)}</label>
      ${details('関連づけ（任意）', references(
        'refs', [...nodeChoices(), ...linkChoices(), ...model().requirements.map(q => [q.id, q.title])], entry.refs,
      ) || '<p class="sub">関連づけるには、先に要件や構成部品を追加してください。</p>')}`;
  }

  function editor(step) {
    const entries = records(step);
    const hints = {
      requirements: 'いま分かっている要件名だけで追加できます。受け入れ条件や関連づけは後から追記できます。',
      nodes: '利用者、外部システム、データの保存先など、要件を実現する部品を追加します。',
      links: 'どの部品がどの部品に依存するか、応答を待つかを整理します。',
      unknowns: '根拠がまだない事項や、確認が必要な判断を残します。',
    };
    const locked = step === 'links' && nodeChoices().length < 2;
    const current = entries.find(([id]) => id === editing)?.[1] || {};
    return `<p>${hints[step]}</p>
      <ul class="design-records">${entries.map(([id, item]) => `
        <li><span>${esc(labelOf(step, item))}</span>
          <button type="button" class="b small" data-design-edit="${id}">編集</button>
          <button type="button" class="b small" data-design-delete="${id}">削除</button></li>`).join('')}</ul>
      ${locked ? '<p class="sub">接続を追加するには部品を2つ以上登録してください。</p>' : `
        <form class="design-form" data-design-form>
          ${editFields(step, current)}
          <div class="row"><button class="b on" type="submit">${editing ? '変更を保存' : '追加'}</button>
          ${editing ? '<button class="b" type="button" data-design-cancel>編集をキャンセル</button>' : ''}</div>
        </form>`}`;
  }

  function review() {
    const m = model(), gates = Analyze.gates(m, null, {});
    const missing = [
      !m.name && '目的・範囲で設計名を入力してください。',
      !m.description && '目的と対象範囲を記録してください。',
      !m.requirements.length && '要件を追加してください。',
      !Object.keys(m.nodes).length && '構成部品を追加してください。',
    ].filter(Boolean);
    const withoutCriteria = m.requirements.filter(q => !q.text?.trim());
    const trace = gates.results.find(g => g.id === 'REQ_TRACE');
    const ready = Boolean(m.name && Object.keys(m.nodes).length);
    return `<h4>設計の確認</h4>
      <ul>${missing.map(x => `<li>${x}</li>`).join('')}
        <li>未紐付け要件 ${trace.detail}${trace.items.length ? `（${trace.items.map(esc).join('、')}）` : ''}</li>
        ${withoutCriteria.length ? `<li>受け入れ条件が未記入 ${withoutCriteria.length} 件</li>` : ''}
        <li>未決事項 ${m.unknowns.length} 件</li>
      </ul>
      ${m.unknowns.length ? `<ul>${m.unknowns.map(u => `<li>${esc(u.text)}</li>`).join('')}</ul>
        <button type="button" class="b small" data-design-step="unknowns">未決事項を見直す</button>` : ''}
      <h4>構成の指摘（${gates.issues.length}件）</h4>
      ${gates.issues.length ? `<ul>${gates.issues.map((i, index) => `<li>${i.sev === 'high' ? '重大' : '注意'}｜${esc(i.msg)}
        <button type="button" class="b small" data-assist-finding="${index}">AI に対応を相談</button></li>`).join('')}</ul>` : '<p>構成の指摘はありません。</p>'}
      <div class="row">
        <button type="button" class="b on" data-design-output="view" ${ready ? '' : 'disabled'}>構成図で確認</button>
        <button type="button" class="b" data-design-output="yaml" ${m.name ? '' : 'disabled'}>YAML を保存</button>
      </div>`;
  }

  const localAI = () => ['127.0.0.1:8125', 'localhost:8125'].includes(location.host);
  const localAIHelp = () => `<p>起動PCで <code>npm run serve:ai</code> を実行し、<a href="${AI_LOCAL_URL}">AI 用ビューア</a>を開いてください。</p>`;
  async function askAI(input) {
    const response = await fetch('/api/design-interview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, provider }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'AI に接続できませんでした。');
    return data;
  }

  function previewRows(before, after) {
    const rows = [];
    for (const section of ['requirements', 'nodes', 'links', 'unknowns']) {
      const entries = m => section === 'nodes' ? m.nodes : Object.fromEntries(m[section].map(item => [item.id, item]));
      const previous = entries(before);
      for (const [id, next] of Object.entries(entries(after))) {
        const old = previous[id];
        if (JSON.stringify(old) === JSON.stringify(next)) continue;
        const name = next.title || next.label || (section === 'links' ? `${after.nodes[next.from].label} → ${after.nodes[next.to].label}` : next.text);
        const fields = { title: '要件名', text: '内容', label: '名前', kind: '種別', tier: '配置',
          description: '説明', sync: '同期', replicas: '台数', az: 'AZ', subnet: 'サブネット',
          timeoutMs: 'タイムアウト ms', retry: '再試行', from: '送信元', to: '宛先', nodes: '関連部品', links: '関連接続' };
        const changes = Object.entries(fields).filter(([field]) => next[field] !== undefined &&
          JSON.stringify(next[field]) !== JSON.stringify(old?.[field])).map(([field, label]) =>
          `${label}: ${old?.[field] === undefined ? '' : `${String(old[field])} → `}${String(next[field])}`);
        rows.push(`<li><strong>${old ? '更新' : '追加'}｜${esc(name)}</strong>
          ${changes.length ? `<div>${changes.map(esc).join(' / ')}</div>` : ''}
          ${next.evidence?.[0]?.quote ? `<blockquote>${esc(next.evidence[0].quote)}</blockquote>` : ''}</li>`);
      }
    }
    return rows;
  }

  function assistEditor() {
    if (!localAI()) return localAIHelp();
    const issue = draft.assistFinding, preview = assistPreview?.id === draft.id ? assistPreview : null;
    return `<p class="sub">送信した資料または設計案は ${providerLabel} 経由で処理されます。</p>
      ${issue ? `<h4>対応する指摘</h4><p>${esc(issue.title)}｜${esc(issue.msg)}</p>
        <button type="button" class="b small" data-assist-action="import">設計書の取り込みへ</button>` : ''}
      <form class="design-form" data-assist-form>
        ${issue ? `<label>${esc(preview?.question || '分かっている条件・対応方針（任意）')} ${area('decision', draft.assistDecision)}</label>` : `
          <label>設計書（テキストまたは Markdown ファイル） <input type="file" accept=".md,.txt,text/plain,text/markdown" data-assist-file></label>
          <label>設計書の本文 ${area('document', draft.assistDocument, true)}</label>`}
        <button class="b on" type="submit" ${assistBusy ? 'disabled' : ''}>${issue ? '対応案を作る' : '取り込み案を作る'}</button>
      </form>
      ${assistBusy ? '<p role="status">AI が案を作成しています…</p>' : ''}
      ${assistError ? `<p role="status">${esc(assistError)}</p>` : ''}
      ${preview ? `<h4>反映前の確認</h4><p>${esc(preview.summary)}</p>
        ${preview.rows.length ? `<ul>${preview.rows.join('')}</ul>` : '<p>反映できる変更はありません。</p>'}
        ${issue && preview.rows.length ? `<p>${preview.remaining ? '再点検では同じ指摘が残ります。' : 'この案を反映すると、この指摘はモデルの再点検で検出されません。'}</p>` : ''}
        ${preview.rows.length ? '<button type="button" class="b on" data-assist-action="apply">この案を下書きに反映</button>' : ''}
      ` : ''}`;
  }

  async function generateAssistance(data) {
    if (assistBusy || !localAI()) return;
    const issue = draft.assistFinding, id = draft.id;
    const question = assistPreview?.question;
    const original = structuredClone(model()), baseline = JSON.stringify(original);
    const document = String(data.get('document') || '').trim();
    const decision = String(data.get('decision') || '').trim();
    if (!issue && !document) return;
    if (document.length > 60_000) { assistError = '資料を6万文字以内に分けてください。'; render(); return; }
    if (issue) draft.assistDecision = decision;
    else draft.assistDocument = document;
    if (!persist()) return;
    assistBusy = true;
    assistError = '';
    assistPreview = null;
    render();
    try {
      const answer = await askAI({ task: issue ? 'finding' : 'import',
        goal: original.name || (issue ? issue.title : '設計書を取り込む'), history: [], model: original,
        finding: issue, document: issue ? undefined : document, question, userDecision: decision });
      if (draft.id !== id || draft.assistFinding !== issue) return;
      const trial = { model: structuredClone(original), interview: { history: [] } };
      applyInterview(trial, answer, issue ? { approved: true } : { document });
      if (!issue) {
        const other = new Set(trial.model.unknowns.map(u => u.text));
        for (const item of Array.isArray(answer.unknowns) ? answer.unknowns.slice(0, 30) : []) {
          if (typeof item !== 'string' || !item.trim() || other.has(item.trim())) continue;
          const text = item.trim().slice(0, 2000);
          other.add(text);
          trial.model.unknowns.push({ id: idFor('unknowns'), text, refs: [] });
        }
        if (!trial.model.name) trial.model.name = '取り込んだ設計案';
      }
      const rows = previewRows(original, trial.model);
      const sameTargets = (a = [], b = []) => a.length === b.length && a.every(target => b.includes(target));
      const remaining = issue && Analyze.lint(trial.model).some(i =>
        i.rule === issue.rule && sameTargets(i.nodes, issue.nodes) && sameTargets(i.links, issue.links));
      assistPreview = { id, baseline, model: trial.model, rows, remaining, question: trial.interview.question,
        summary: typeof answer.summary === 'string' ? answer.summary.slice(0, 4000) : '' };
    } catch (error) {
      assistError = error instanceof SyntaxError ? 'AI 用サーバーに接続できませんでした。' : error.message;
    } finally {
      assistBusy = false;
      if (root.isConnected && draft.id === id && draft.step === 'assist') render();
    }
  }

  function interviewEditor() {
    if (!localAI()) {
      return `<p>AI 対話は起動PCで利用できます。起動PCで <code>npm run serve:ai</code> を実行し、<a href="${AI_LOCAL_URL}">AI 対話用のビューア</a>を開いてください。</p>
        <p class="sub">このページの下書きは引き続き各工程で編集できます。AI 対話用ビューアの下書きは別に保存されます。</p>`;
    }
    const ai = draft.interview;
    const busy = pendingInterviews.has(draft.id);
    return `<p class="sub">送信すると、目的・回答・設計案が ${providerLabel} 経由で処理されます。</p>
      ${!ai ? `
        <form class="design-form" data-interview-form>
          <label>やりたいこと ${area('goal', draft.startNotes || model().description || model().name, true)}</label>
          <button class="b on" type="submit">AI に相談する</button>
        </form>` : `
        <p><strong>やりたいこと</strong> ${esc(ai.goal)}</p>
        ${ai.history.length ? details('回答履歴', `<ul>${ai.history.map(turn =>
          `<li>${esc(turn.question)}<br><strong>回答</strong> ${esc(turn.answer)}</li>`).join('')}</ul>`) : ''}
        ${busy ? '<p role="status">AI が設計案を更新しています…</p>' : ai.inProgress ? `
          <p>前回の応答を取得できませんでした。入力済みの回答から再開できます。</p>
          <button type="button" class="b on" data-interview-action="retry">再試行</button>` : ai.question ? `
          <form class="design-form" data-interview-form>
            <label>${esc(ai.question)} ${area('answer', ai.answer, true)}</label>
            <div class="row">
              <button class="b on" type="submit">回答する</button>
              <button class="b" type="button" data-interview-action="undecided">未定</button>
            </div>
          </form>` : '<p>追加の質問はありません。下書きを確認して編集できます。</p>'}
        <div class="row">
          <button class="b" type="button" data-design-step="requirements">要件（${model().requirements.length}）</button>
          <button class="b" type="button" data-design-step="nodes">構成部品（${Object.keys(model().nodes).length}）</button>
          <button class="b" type="button" data-design-step="review">レビュー</button>
        </div>`}`;
  }

  async function runInterview() {
    const id = draft.id;
    if (pendingInterviews.has(id)) return;
    const ai = draft.interview;
    if (!persist()) return;
    const request = askAI({ goal: ai.goal, history: ai.history, model: model() });
    pendingInterviews.add(id);
    render();
    let status;
    try {
      const data = await request;
      const latest = loadDesignDrafts()[id];
      if (!latest) return;
      const changes = applyInterview(latest, data);
      if (!saveDesignDraft(latest)) throw new Error('AI の下書きを保存できませんでした。');
      status = changes ? `下書きを ${changes} 件更新しました。` : '下書きの変更はありません。';
    } catch (error) {
      status = error instanceof SyntaxError ? 'AI 対話サーバーに接続できませんでした。' : error.message;
    } finally {
      pendingInterviews.delete(id);
      refreshInterview?.(id, status);
    }
  }

  function answerInterview(answer) {
    const ai = draft.interview;
    if (!answer || !ai?.question || ai.inProgress || pendingInterviews.has(draft.id)) return;
    const question = ai.question;
    const undecided = isUndecided(answer);
    ai.history.push({ question, answer: undecided ? '未定' : answer, undecided });
    if (undecided) model().unknowns.push({ id: idFor('unknowns'), text: question, refs: [] });
    ai.answer = '';
    ai.inProgress = true;
    return runInterview();
  }

  function render() {
    const m = model(), position = STEPS.findIndex(([step]) => step === draft.step);
    const choices = Object.values({ ...drafts, [draft.id]: draft }).map(d => [d.id, d.model.name || '無題の設計']);
    root.innerHTML = `
      <div class="row design-picker"><label>下書き <select data-design-picker>${options(choices, draft.id)}</select></label>
        <button type="button" class="b" data-design-new>新しい設計</button></div>
      <nav class="row" aria-label="設計の工程">${STEPS.map(([step, title]) =>
        `<button type="button" data-design-step="${step}" class="b${step === draft.step ? ' on' : ''}"${step === draft.step ? ' aria-current="step"' : ''}>${title}</button>`).join('')}</nav>
      <h3 tabindex="-1" data-design-heading>${STEPS[position][1]}</h3>
      ${draft.step === 'overview' ? `
        <form class="design-form" data-design-form>
          <label>やりたいこと（1行に1件）
            <textarea name="startNotes" rows="4" placeholder="例：利用者が注文できる&#10;担当者が注文状況を確認できる">${esc(draft.startNotes)}</textarea>
          </label>
          ${details('設計名・対象範囲（任意）', `
            <label>設計名 ${input('name', m.name)}</label>
            <label>目的・対象範囲 ${area('description', m.description)}</label>`)}
          <div class="row">
            <button class="b on" type="button" data-design-step="interview">AI と設計する</button>
            <button class="b" type="button" data-assist-action="import">AI で設計書を取り込む</button>
            <button class="b" type="submit">要件へ進む</button>
          </div>
        </form>` : draft.step === 'interview' ? interviewEditor() : draft.step === 'assist' ? assistEditor() : draft.step === 'review' ? review() : editor(draft.step)}
      <div class="row">
        ${position > 0 ? `<button type="button" class="b" data-design-step="${STEPS[position - 1][0]}">前へ</button>` : ''}
        ${position > 0 && position < STEPS.length - 1 ? `<button type="button" class="b" data-design-step="${STEPS[position + 1][0]}">次へ</button>` : ''}
      </div>
      <p class="sub" role="status"></p>`;
  }

  function changeStep(step) {
    draft.step = step;
    editing = null;
    render();
    persist();
    root.querySelector('[data-design-heading]').focus();
  }

  function remove(step, id) {
    const m = model(), removed = new Set([id]);
    if (step === 'nodes') {
      delete m.nodes[id];
      for (const link of m.links) if (link.from === id || link.to === id) removed.add(link.id);
      m.links = m.links.filter(l => !removed.has(l.id));
    } else m[step] = m[step].filter(item => item.id !== id);
    if (m.scenarios) {
      m.scenarios = m.scenarios.map(s => ({ ...s, steps: s.steps.map(item =>
        ({ ...item, links: item.links.filter(ref => !removed.has(ref)) })).filter(item => item.links.length) }))
        .filter(s => s.steps.length);
    }
    if (m.failPresets) m.failPresets = m.failPresets.filter(ref => !removed.has(ref));
    for (const req of m.requirements) {
      if (req.scenario && !m.scenarios?.some(s => s.id === req.scenario)) delete req.scenario;
      req.nodes = (req.nodes || []).filter(ref => !removed.has(ref));
      req.links = (req.links || []).filter(ref => !removed.has(ref));
    }
    for (const item of m.unknowns) item.refs = (item.refs || []).filter(ref => !removed.has(ref));
  }

  root.addEventListener('input', event => {
    if (draft.step === 'interview' && event.target.name === 'answer') {
      draft.interview.answer = event.target.value;
      persist();
      return;
    }
    if (draft.step !== 'overview' || !['startNotes', 'name', 'description'].includes(event.target.name)) return;
    if (event.target.name === 'startNotes') {
      draft.startNotes = event.target.value;
      persist();
      return;
    }
    const value = event.target.value.trim();
    if (draft.opened && event.target.name === 'name' && !value) return;
    model()[event.target.name] = value;
    persist();
  });
  root.addEventListener('change', async event => {
    if (event.target.matches('[data-assist-file]')) {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 240_000) {
        assistError = '資料を6万文字以内に分けてください。';
        render();
        return;
      }
      const id = draft.id;
      try {
        const content = await file.text();
        if (draft.id === id && draft.step === 'assist') root.querySelector('[name="document"]').value = content;
      } catch {
        assistError = '資料を読み込めませんでした。';
        render();
      }
      return;
    }
    if (!event.target.matches('[data-design-picker]')) return;
    draft = drafts[event.target.value];
    editing = null;
    render();
  });
  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const data = button.dataset;
    if (data.assistFinding != null) {
      draft.assistFinding = Analyze.lint(model())[Number(data.assistFinding)];
      draft.assistDecision = '';
      assistPreview = null;
      assistError = '';
      return changeStep('assist');
    }
    if (data.assistAction === 'import') {
      delete draft.assistFinding;
      assistPreview = null;
      assistError = '';
      return changeStep('assist');
    }
    if (data.assistAction === 'apply') {
      if (assistPreview?.id !== draft.id || JSON.stringify(model()) !== assistPreview.baseline) {
        assistPreview = null;
        assistError = '下書きが変更されました。最新の内容から案を作り直してください。';
        return render();
      }
      draft.model = assistPreview.model;
      assistPreview = null;
      return changeStep('review');
    }
    if (data.interviewAction === 'retry') return runInterview();
    if (data.interviewAction === 'undecided') return answerInterview('未定');
    if (data.designStep) return changeStep(data.designStep);
    if (data.designNew != null) { draft = newDraft(); return changeStep('overview'); }
    if (data.designEdit) { editing = data.designEdit; render(); return root.querySelector('form :is(input,select,textarea)')?.focus(); }
    if (data.designCancel != null) { editing = null; return render(); }
    if (data.designDelete) {
      if (!confirm('この項目と関連づけを削除しますか？')) return;
      remove(draft.step, data.designDelete);
      editing = null;
      render();
      persist();
    }
    if (data.designOutput === 'yaml') {
      const yaml = jsyaml.dump(model(), { lineWidth: 120, noRefs: true });
      return download(`${draft.id}.yaml`, new Blob([yaml], { type: 'application/yaml;charset=utf-8' }));
    }
    if (data.designOutput === 'view') {
      draft.opened = true;
      if (!persist()) return;
      location.hash = `#/m/${draft.id}/struct`;
      if (draft.id === key) location.reload();
    }
  });
  root.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.target), value = name => String(data.get(name) || '').trim();
    const m = model(), step = draft.step;
    if (step === 'assist') return generateAssistance(data);
    if (step === 'interview') {
      if (draft.interview) return answerInterview(value('answer'));
      const goal = value('goal');
      if (!goal) return;
      if (!m.name) m.name = linesOf(goal)[0] || goal;
      if (!m.description) m.description = goal;
      if (draft.startNotes?.trim() === goal) draft.startNotes = '';
      draft.interview = { goal, history: [], inProgress: true };
      return runInterview();
    }
    if (step === 'overview') {
      const notes = linesOf(value('startNotes'));
      const existing = new Set(m.requirements.map(q => q.title));
      for (const title of new Set(notes)) {
        if (!existing.has(title)) m.requirements.push(requirement(idFor('requirements'), title));
      }
      if (!m.name && notes.length) m.name = notes[0];
      draft.startNotes = '';
      return changeStep('requirements');
    }
    const id = editing || idFor(step);
    let item;
    if (step === 'nodes') {
      item = { ...m.nodes[id], label: value('label'), kind: value('kind'), tier: value('tier'), status: 'claim' };
      for (const field of ['svc', 'replicas', 'description']) delete item[field];
      if (value('svc')) item.svc = value('svc');
      if (value('replicas')) item.replicas = Number(value('replicas'));
      if (value('description')) item.description = value('description');
    } else if (step === 'links') {
      item = { ...m.links.find(l => l.id === id), id, from: value('from'), to: value('to'), sync: value('sync') === 'sync', status: 'claim' };
      if (item.from === item.to) { root.querySelector('[role="status"]').textContent = '送信元と宛先には別の部品を選んでください。'; return; }
      delete item.timeoutMs;
      delete item.label;
      if (value('timeoutMs')) item.timeoutMs = Number(value('timeoutMs'));
      if (value('label')) item.label = value('label');
    } else if (step === 'requirements') {
      const previous = m.requirements.find(q => q.id === id);
      item = { ...previous, ...requirement(id, value('title'), {
        kind: value('kind'), text: value('text'), nodes: data.getAll('nodes'), links: data.getAll('links'),
      }) };
    } else {
      item = { id, text: value('text'), refs: data.getAll('refs') };
    }
    if ((step === 'requirements' && !item.title) || (step === 'nodes' && !item.label) || (step === 'unknowns' && !item.text)) {
      root.querySelector('[role="status"]').textContent = '空欄の項目を入力してください。';
      return;
    }
    if (!m.name && step === 'requirements') m.name = item.title;
    if (step === 'nodes') m.nodes[id] = item;
    else if (editing) m[step] = m[step].map(old => old.id === id ? item : old);
    else m[step].push(item);
    editing = null;
    render();
    if (persist()) root.querySelector('[role="status"]').textContent = '保存しました。';
  });

  refreshInterview = (id, status) => {
    if (!root.isConnected) return;
    const latest = loadDesignDrafts()[id];
    if (latest) drafts[id] = latest;
    if (draft.id !== id) return;
    if (latest) draft = latest;
    if (draft.step !== 'interview' || root.closest('.modal')?.hidden) return;
    render();
    root.querySelector(':scope > [role="status"]').textContent = status || '';
    root.querySelector('[name="answer"]')?.focus();
  };
  render();
}
