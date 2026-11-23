import { execFile, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export const CLI_NAMES = { codex: 'Codex CLI', claude: 'Claude Code CLI' };
export const SESSION_ID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function cliArgs(provider, sessionId) {
  if (provider === 'codex') {
    return ['exec', '--sandbox', 'workspace-write', '-c', 'approval_policy="never"', '--json',
      ...(sessionId ? ['resume', sessionId] : []), '-'];
  }
  return ['--print', '--verbose', '--output-format', 'stream-json', '--restricted', '--strict-mcp-config',
    '--no-chrome', '--permission-mode', 'acceptEdits', '--permission-prompts', 'none',
    ...(sessionId ? ['--resume', sessionId] : [])];
}

export function readEvent(provider, e, emit) {
  if (provider === 'codex') {
    if (e.type === 'thread.started') emit({ sessionId: e.thread_id });
    if (e.type === 'item.completed' && e.item?.type === 'agent_message') emit({ text: e.item.text });
    if (e.type === 'item.started' && ['command_execution', 'file_change'].includes(e.item?.type)) emit({ working: true });
    return e.type === 'turn.failed' ? 'failed' : e.type === 'turn.completed' ? 'done' : undefined;
  }
  if (e.type === 'system' && e.subtype === 'init') emit({ sessionId: e.session_id });
  if (e.type === 'assistant' && Array.isArray(e.message?.content) && !e.parent_tool_use_id) {
    const content = e.message.content;
    const text = content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    if (text) emit({ text });
    if (content.some(b => b.type === 'tool_use')) emit({ working: true });
  }
  if (e.type === 'result') {
    emit({ sessionId: e.session_id, final: e.result });
    return e.is_error || (e.subtype && e.subtype !== 'success') ? 'failed' : 'done';
  }
}

export function launchCLI({ provider, sessionId, cwd, prompt, emit }) {
  const windows = process.platform === 'win32';
  const cli = spawn(provider, cliArgs(provider, sessionId), { cwd, windowsHide: true, detached: !windows });
  let failure = '', outcome;
  const lines = createInterface({ input: cli.stdout, crlfDelay: Infinity });
  lines.on('line', line => {
    let event;
    try { event = JSON.parse(line); } catch { return; }
    if (event && typeof event === 'object') outcome = readEvent(provider, event, emit) || outcome;
  });
  cli.stderr.resume();
  cli.stdin.on('error', () => {});
  const done = new Promise(resolve => {
    cli.once('error', error => { failure = error.code === 'ENOENT' ? `${CLI_NAMES[provider]} が PATH に見つかりません。` : `${CLI_NAMES[provider]} を起動できませんでした。`; });
    cli.once('close', code => {
      lines.close();
      resolve(failure || (code !== 0 || outcome !== 'done'
        ? `${CLI_NAMES[provider]} の実行が完了しませんでした。ログイン状態と CLI のセッションを確認してください。` : ''));
    });
  });
  cli.stdin.end(prompt, 'utf8');
  return { done, stop() {
    if (!cli.pid || cli.exitCode !== null || cli.signalCode) return;
    if (windows) {
      execFile('taskkill.exe', ['/PID', String(cli.pid), '/T', '/F'], { windowsHide: true }, error => { if (error) cli.kill(); });
    } else {
      try { process.kill(-cli.pid, 'SIGTERM'); } catch { cli.kill(); }
    }
  } };
}
