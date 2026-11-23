import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createAdminChat } from '../tools/admin-chat.mjs';
import { cliArgs, readEvent } from '../tools/admin-cli.mjs';

const CLI_SESSION = '719cbb89-3017-42f6-834f-5e3d26a70935';
const TOKEN = 'access-for-test-only';
const send = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

async function testServer(t, config) {
  const admin = await createAdminChat({ token: TOKEN, send, ...config });
  const server = createServer((req, res) => admin.handle(req, res, req.url).catch(() => send(res, 500, {})));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { admin.stop(); server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return async (route, body, headers = {}) => {
    const response = await fetch(`${origin}/api/admin-chat/${route}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${TOKEN}`, ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...headers },
      body: body && JSON.stringify(body),
    });
    return { status: response.status, payload: await response.json() };
  };
}

async function waitForCompletion(request, id) {
  for (let i = 0; i < 40; i++) {
    const { payload } = await request(`sessions/${id}`);
    if (!payload.activeId) return payload;
    await delay(10);
  }
  assert.fail('CLI の処理が完了しませんでした');
}

test('管理者チャット：認証を行い、再起動後も元の CLI セッションで続けられる', async t => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'ddd-admin-test-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const stateFile = path.join(cwd, 'state', 'sessions.json');
  const calls = [];
  const config = { cwd, stateFile, launch(options) {
    const deferred = Promise.withResolvers();
    calls.push({ ...options, deferred });
    options.emit({ sessionId: CLI_SESSION, working: true });
    return { done: deferred.promise, stop: () => deferred.resolve('') };
  } };
  const first = await testServer(t, config);
  assert.equal((await first('sessions', null, { Authorization: '' })).status, 401);
  assert.equal((await first('turn', { provider: 'codex', message: 'test' }, { Origin: 'http://example.test' })).status, 403);
  assert.equal((await first('stop', {})).status, 404);
  const start = await first('turn', { provider: 'codex', message: '最初の依頼です', modelId: 'file-formats' });
  assert.equal(start.status, 202);
  const id = start.payload.id;
  assert.equal(start.payload.activeId, id);
  assert.equal(calls[0].cwd, cwd);
  assert.match(calls[0].prompt, /file-formats\n\n最初の依頼です/);
  assert.equal(calls[0].sessionId, undefined);
  assert.equal((await first('turn', { provider: 'claude', message: '別の依頼' })).status, 409);
  calls[0].emit({ text: '変更しました。' });
  calls[0].deferred.resolve('');
  const saved = await waitForCompletion(first, id);
  assert.deepEqual(saved.messages.at(-1), { role: 'assistant', text: '変更しました。', state: 'done' });
  assert.equal(JSON.parse(await readFile(stateFile, 'utf8'))[0].cliSessionId, CLI_SESSION);

  const second = await testServer(t, config);
  const { payload: catalog } = await second('sessions');
  assert.equal(catalog.sessions[0].id, id);
  assert.deepEqual((await second(`sessions/${id}`)).payload.messages, saved.messages);
  assert.equal((await second('turn', { id, provider: 'claude', message: '続けてください' })).status, 202);
  assert.equal(calls[1].provider, 'codex');
  assert.equal(calls[1].sessionId, CLI_SESSION);
  assert.equal((await second('stop', { id })).status, 202);
  assert.equal((await waitForCompletion(second, id)).messages.at(-1).state, 'stopped');
});

test('管理者チャット：両 CLI の構造化イベントからセッション ID と応答を読み取る', () => {
  const seen = [];
  const emit = event => seen.push(event);
  readEvent('codex', { type: 'thread.started', thread_id: CLI_SESSION }, emit);
  readEvent('codex', { type: 'item.completed', item: { type: 'agent_message', text: 'Codex の応答' } }, emit);
  assert.equal(readEvent('codex', { type: 'turn.completed' }, emit), 'done');
  readEvent('claude', { type: 'system', subtype: 'init', session_id: CLI_SESSION }, emit);
  readEvent('claude', { type: 'assistant', message: { content: [{ type: 'tool_use' }, { type: 'text', text: 'Claude の応答' }] } }, emit);
  assert.equal(readEvent('claude', { type: 'result', subtype: 'success', session_id: CLI_SESSION, result: 'Claude の応答' }, emit), 'done');
  assert.deepEqual(seen, [
    { sessionId: CLI_SESSION }, { text: 'Codex の応答' }, { sessionId: CLI_SESSION }, { text: 'Claude の応答' },
    { working: true }, { sessionId: CLI_SESSION, final: 'Claude の応答' },
  ]);
  assert.deepEqual(cliArgs('codex', CLI_SESSION).slice(-3), ['resume', CLI_SESSION, '-']);
  assert.deepEqual(cliArgs('claude', CLI_SESSION).slice(-2), ['--resume', CLI_SESSION]);
});
