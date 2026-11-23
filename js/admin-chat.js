import { AI_PROVIDERS } from './settings.js?v=3d-styles';

const API = '/api/admin-chat';
const memory = name => {
  const key = `ddd.admin.${name}`;
  return {
    get() { try { return sessionStorage.getItem(key); } catch { return null; } },
    set(value) { try { sessionStorage.setItem(key, value); } catch { /* 現在の画面では引き続き使える */ } },
  };
};

export async function initAdminChat({ modelId, provider }) {
  let enabled;
  try { enabled = (await (await fetch(`${API}/status`)).json()).enabled === true; } catch { return; }
  if (!enabled) return;

  const root = document.createElement('div');
  root.innerHTML = `
    <button type="button" class="b on admin-launch" aria-controls="admin-chat" aria-expanded="false">管理者チャット</button>
    <dialog id="admin-chat" class="admin-chat" aria-labelledby="admin-chat-title">
      <header class="admin-head"><h2 id="admin-chat-title">管理者チャット</h2>
        <button type="button" class="b" data-admin-close aria-label="管理者チャットを閉じる">×</button></header>
      <form class="admin-unlock">
        <p>起動ターミナルに表示されたアクセスキーを入力してください。</p>
        <label for="admin-key">アクセスキー</label>
        <div class="row"><input id="admin-key" type="password" autocomplete="off" required>
          <button type="submit" class="b on">チャットを開く</button></div>
      </form>
      <div class="admin-body" hidden>
        <div class="admin-controls">
          <label>会話 <select class="admin-sessions"></select></label>
          <button type="button" class="b" data-admin-new>新しい会話</button>
          <label>実行先 <select class="admin-provider"></select></label>
          <button type="button" class="b" data-admin-reload>図を再読み込み</button>
        </div>
        <div class="admin-log" role="log" aria-label="会話履歴" tabindex="0"></div>
        <form class="admin-compose">
          <label for="admin-message">依頼内容</label>
          <textarea id="admin-message" rows="3" maxlength="12000" placeholder="例：このモデルに復旧シナリオを追加してください" required></textarea>
          <div class="row"><button type="submit" class="b on">送信</button>
            <button type="button" class="b" data-admin-stop hidden>実行を停止</button>
            <small>このリポジトリを編集します</small></div>
        </form>
      </div>
      <p class="admin-status" role="status"></p>
    </dialog>`;
  document.body.append(root);
  const $ = selector => root.querySelector(selector);
  const launcher = $('.admin-launch'), dialog = $('#admin-chat'), unlock = $('.admin-unlock');
  const body = $('.admin-body'), picker = $('.admin-sessions'), providers = $('.admin-provider');
  const newChat = $('[data-admin-new]');
  const log = $('.admin-log'), compose = $('.admin-compose'), message = $('#admin-message');
  const send = compose.querySelector('[type="submit"]'), stop = $('[data-admin-stop]'), status = $('.admin-status');
  const keyStore = memory('key'), idStore = memory('session'), openStore = memory('open');
  let key = keyStore.get() || '', id = idStore.get(), activeId = null, providerForNew = provider === 'codex' ? provider : 'claude';
  let submitting = false, stopping = false, timer, requestVersion = 0, renderedId = null, errorMessage = '';
  let catalogKey;
  let displayed = [];
  for (const [value, label] of Object.entries(AI_PROVIDERS)) providers.add(new Option(label, value));

  function locked(locked) { unlock.hidden = !locked; body.hidden = locked; }

  async function request(path, input) {
    const requestKey = key;
    const headers = { Authorization: `Bearer ${key}` };
    const options = input ? { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(input) } : { headers };
    const response = await fetch(`${API}/${path}`, options);
    if (response.status === 401) {
      if (requestKey === key) { key = ''; keyStore.set(''); locked(true); }
      throw new Error('起動ターミナルに表示されたアクセスキーを確認してください。');
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) throw new Error(result?.error || '管理者チャットに接続できませんでした。');
    return result;
  }

  function renderLog(messages) {
    const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 50;
    if (renderedId !== id) { log.replaceChildren(); displayed = []; renderedId = id; }
    const tip = log.querySelector('.admin-empty');
    if (!messages.length && !tip) {
      const empty = document.createElement('p'); empty.className = 'admin-empty';
      empty.textContent = 'いま見ている図の修正や、リファレンスの追加を依頼できます。';
      log.append(empty);
    } else if (messages.length) tip?.remove();
    for (const [index, update] of messages.entries()) {
      if (!displayed[index]) {
        const item = document.createElement('article');
        item.className = update.role === 'user' ? 'admin-message admin-user' : 'admin-message';
        const label = document.createElement('b');
        label.textContent = update.role === 'user' ? 'あなた' : AI_PROVIDERS[providers.value];
        const text = document.createElement('div');
        item.append(label, text); log.append(item); displayed.push(text);
      }
      const note = update.error || { stopped: '停止しました。', interrupted: 'サーバー終了で中断されました。' }[update.state];
      const value = [update.text, note].filter(Boolean).join('\n\n') ||
        ({ running: '応答を待っています…', done: 'CLI の実行が完了しました。' }[update.state] || '');
      if (displayed[index].textContent !== value) displayed[index].textContent = value;
    }
    if (atEnd || !messages.length) log.scrollTop = log.scrollHeight;
  }

  function controls(session) {
    const runningHere = Boolean(activeId && activeId === id);
    if (!activeId) stopping = false;
    providers.disabled = Boolean(id) || submitting;
    picker.disabled = newChat.disabled = submitting;
    send.disabled = submitting || Boolean(activeId);
    stop.hidden = !runningHere;
    stop.disabled = stopping;
    status.textContent = errorMessage || (stopping && runningHere ? '停止中…' : runningHere
      ? (session?.working ? 'リポジトリで作業中…' : '応答を待っています…') : activeId ? '別の会話で実行中です。' : '');
  }

  async function refresh() {
    clearTimeout(timer);
    if (!dialog.open || !key) return;
    const version = ++requestVersion;
    try {
      const data = await request('sessions');
      if (version !== requestVersion) return;
      if (id === null || (id && !data.sessions.some(session => session.id === id))) id = data.activeId || data.sessions[0]?.id || '';
      const session = id ? await request(`sessions/${id}`) : null;
      if (version !== requestVersion) return;
      activeId = session ? session.activeId : data.activeId;
      locked(false);
      const nextKey = JSON.stringify(data.sessions.map(({ id, title }) => [id, title]));
      if (catalogKey !== nextKey) {
        picker.replaceChildren(new Option('新しい会話', ''), ...data.sessions.map(item =>
          new Option(`${item.title} · ${AI_PROVIDERS[item.provider]}`, item.id)));
        catalogKey = nextKey;
      }
      picker.value = id;
      providers.value = session?.provider || providerForNew;
      idStore.set(id);
      renderLog(session?.messages || []);
      controls(session);
    } catch (error) {
      if (version === requestVersion) status.textContent = error.message;
    } finally {
      if (version === requestVersion && activeId && dialog.open && key) timer = setTimeout(refresh, 900);
    }
  }

  function open() {
    dialog.show(); openStore.set('1'); launcher.setAttribute('aria-expanded', 'true');
    locked(!key);
    if (key) void refresh(); else $('#admin-key').focus();
  }

  launcher.addEventListener('click', () => { if (dialog.open) dialog.close(); else open(); });
  $('[data-admin-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    ++requestVersion; clearTimeout(timer); openStore.set('');
    launcher.setAttribute('aria-expanded', 'false'); launcher.focus();
  });
  dialog.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape' && !event.isComposing) dialog.close();
  });
  unlock.addEventListener('submit', async event => {
    event.preventDefault(); errorMessage = ''; key = $('#admin-key').value.trim();
    if (!key) return;
    await refresh();
    if (key && !body.hidden) { keyStore.set(key); $('#admin-key').value = ''; message.focus(); }
  });
  function choose(next) {
    id = next; errorMessage = ''; idStore.set(id); void refresh();
  }
  picker.addEventListener('change', () => choose(picker.value));
  providers.addEventListener('change', () => { providerForNew = providers.value; });
  newChat.addEventListener('click', () => { choose(''); message.focus(); });
  $('[data-admin-reload]').addEventListener('click', () => location.reload());
  message.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault(); if (!send.disabled) compose.requestSubmit();
    }
  });
  compose.addEventListener('submit', async event => {
    event.preventDefault();
    const text = message.value.trim();
    if (!text || submitting || activeId) return;
    submitting = true; errorMessage = ''; controls();
    try {
      const response = await request('turn', { id, provider: providers.value, message: text, modelId });
      id = response.id; idStore.set(id); activeId = response.activeId; message.value = '';
      renderLog(response.messages);
    } catch (error) { errorMessage = error.message; }
    finally { submitting = false; controls(); void refresh(); }
  });
  stop.addEventListener('click', async () => {
    stopping = true; errorMessage = ''; controls();
    try { await request('stop', { id }); }
    catch (error) { stopping = false; errorMessage = error.message; }
    void refresh();
  });

  if (openStore.get()) open();
}
