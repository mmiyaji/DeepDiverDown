import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CLI_NAMES, launchCLI, SESSION_ID } from './admin-cli.mjs';

const PREFIX = '/api/admin-chat';
const DISPLAY_LIMIT = 100_000;
const clip = text => text.length > DISPLAY_LIMIT ? `${text.slice(0, DISPLAY_LIMIT)}\n…（表示上限）` : text;

async function readBody(req) {
  let body = '';
  req.setEncoding('utf8');
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 50_000) return null;
  }
  try { return JSON.parse(body); } catch { return null; }
}

export async function createAdminChat({ cwd, stateFile, token, send, launch = launchCLI }) {
  const secret = Buffer.from(`Bearer ${token}`);
  const authorized = req => {
    const header = Buffer.from(req.headers.authorization || '');
    return header.length === secret.length && timingSafeEqual(header, secret);
  };

  let previous = [];
  try { previous = JSON.parse(await readFile(stateFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const sessions = new Map(previous.map(session => [session.id, session]));
  const interrupted = [];
  for (const session of sessions.values()) {
    const last = session.messages.at(-1);
    if (last?.state === 'running') { last.state = 'interrupted'; interrupted.push(last); }
  }

  let writes = Promise.resolve(), active = null;
  function save() {
    const contents = JSON.stringify([...sessions.values()]);
    const write = writes.then(async () => {
      await mkdir(path.dirname(stateFile), { recursive: true, mode: 0o700 });
      const temp = `${stateFile}.tmp`;
      await writeFile(temp, contents, { mode: 0o600 });
      await rename(temp, stateFile);
    });
    writes = write.catch(() => {});
    return write;
  }
  if (interrupted.length) await save();

  const summary = ({ id, provider, title, updatedAt }) => ({ id, provider, title, updatedAt });
  const detail = session => ({ ...summary(session), messages: session.messages, activeId: active?.session.id ?? null,
    working: active?.session === session && active.working });

  async function run(turn, prompt) {
    const { session, reply } = turn;
    const emit = event => {
      if (!session.cliSessionId && SESSION_ID.test(event.sessionId)) {
        session.cliSessionId = event.sessionId;
        void save().catch(() => {}); // 応答が途切れても CLI の会話を再開できるようにする。
      }
      if (event.working) turn.working = true;
      if (typeof event.text === 'string' && event.text && reply.text.length < DISPLAY_LIMIT) {
        reply.text = clip([reply.text, event.text].filter(Boolean).join('\n\n'));
      }
      if (typeof event.final === 'string' && event.final && !reply.text.endsWith(event.final) && reply.text.length < DISPLAY_LIMIT) {
        reply.text = clip([reply.text, event.final].filter(Boolean).join('\n\n'));
      }
    };
    let error = '';
    if (!turn.stopping) {
      try {
        turn.worker = launch({ provider: session.provider, sessionId: session.cliSessionId, cwd, prompt, emit });
        error = await turn.worker.done;
      } catch {
        error = `${CLI_NAMES[session.provider]} を実行できませんでした。`;
      }
      if (!error && !session.cliSessionId) error = 'CLI のセッションIDを取得できませんでした。';
    }
    reply.state = turn.stopping ? 'stopped' : error ? 'error' : 'done';
    if (error && !turn.stopping) reply.error = error;
    session.updatedAt = Date.now();
    try { await save(); } catch { reply.error = '会話をディスクに保存できませんでした。'; }
    finally { active = null; }
  }

  function stop(turn) {
    if (!turn.stopping) { turn.stopping = true; turn.worker?.stop(); }
  }

  async function sendTurn(input, res) {
    if (active) return send(res, 409, { error: '別の依頼を実行中です。完了後に送信してください。' });
    const message = typeof input.message === 'string' ? input.message.trim() : '';
    if (!message || message.length > 12_000) return send(res, 400, { error: '依頼を1〜12,000文字で入力してください。' });
    const existing = input.id ? sessions.get(input.id) : null;
    if (input.id && !existing) return send(res, 404, { error: '会話が見つかりません。' });
    const provider = existing?.provider ?? input.provider;
    if (typeof provider !== 'string' || !Object.hasOwn(CLI_NAMES, provider)) return send(res, 400, { error: '実行先を選んでください。' });

    const updatedAt = Date.now();
    const session = existing || { id: randomUUID(), provider, title: message.split(/\r?\n/, 1)[0].slice(0, 64), updatedAt, messages: [] };
    const previousAt = session.updatedAt;
    const reply = { role: 'assistant', text: '', state: 'running' };
    const turn = { session, reply, working: false, stopping: false };
    session.messages.push({ role: 'user', text: message }, reply);
    session.updatedAt = updatedAt;
    sessions.set(session.id, session);
    active = turn;
    try { await save(); }
    catch {
      session.messages.splice(-2);
      session.updatedAt = previousAt;
      if (!existing) sessions.delete(session.id);
      active = null;
      return send(res, 500, { error: '会話を保存できないため、依頼を開始できませんでした。' });
    }

    send(res, 202, detail(session));
    const model = typeof input.modelId === 'string' && /^[a-z0-9-]{1,100}$/.test(input.modelId) ? input.modelId : '';
    const instructions = 'DeepDiverDown の管理者チャットからの依頼です。既存の変更を保ち、依頼の範囲で作業してください。モデルを扱う場合は docs/AGENTS.md に従ってください。コミットや公開は明示依頼時だけ行ってください。';
    const context = model ? `\n画面で開いている DeepDiverDown のモデル ID: ${model}` : '';
    const prompt = `${instructions}${context}\n\n${message}`;
    void run(turn, prompt);
  }

  return {
    async handle(req, res, pathname) {
      if (req.method === 'GET' && pathname === `${PREFIX}/status`) return send(res, 200, { enabled: true });
      if (!authorized(req)) return send(res, 401, { error: '起動ターミナルに表示されたアクセスキーを確認してください。' });
      if (req.method === 'GET') {
        if (pathname === `${PREFIX}/sessions`) return send(res, 200, { sessions: [...sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt).map(summary), activeId: active?.session.id ?? null });
        const id = pathname.slice(`${PREFIX}/sessions/`.length);
        const session = pathname.startsWith(`${PREFIX}/sessions/`) && sessions.get(id);
        return session ? send(res, 200, detail(session)) : send(res, 404, { error: '会話が見つかりません。' });
      }
      if (req.method !== 'POST' || req.headers.origin !== `http://${req.headers.host}` ||
          req.headers['content-type']?.split(';')[0] !== 'application/json') {
        return send(res, 403, { error: '管理者チャットの画面からアクセスしてください。' });
      }
      const input = await readBody(req);
      if (!input || typeof input !== 'object') return send(res, 400, { error: '依頼の形式を確認してください。' });
      if (pathname === `${PREFIX}/turn`) return sendTurn(input, res);
      if (pathname === `${PREFIX}/stop` && active && active.session.id === input.id) {
        stop(active);
        return send(res, 202, { stopping: true });
      }
      send(res, 404, { error: '実行中の依頼が見つかりません。' });
    },
    stop() { if (active) stop(active); },
  };
}
