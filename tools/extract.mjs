#!/usr/bin/env node
// 設計書 → モデルの半自動化：書き手（抽出）→ 形式チェック（必要なら修正依頼）→ 検証役（別会話）→ 点検
//   node tools/extract.mjs --id <モデルID> --doc docs/x.md [--doc ...] [--actual models/<id>/actual.yaml] [--force] [--dry-run]
// 認証：ANTHROPIC_API_KEY、または `ant auth login` のプロファイル（SDK が自動で読む）
// 出力：models/<id>/model.yaml（既にあれば model.draft.yaml）・models/<id>/verify.yaml・registry.json への登録
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import Anthropic from '@anthropic-ai/sdk';
import { ROOT, loadAnalyze, loadDocs } from './load.mjs';
import { validate } from '../js/loader.js';

const MODEL = 'claude-opus-5-5';
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const all = k => args.flatMap((x, i) => (x === k ? [args[i + 1]] : []));
const id = opt('--id'), docs = all('--doc'), actualPath = opt('--actual'), dry = args.includes('--dry-run'), force = args.includes('--force');
if (!id || !docs.length) { console.error('usage: node tools/extract.mjs --id <id> --doc <file.md> [--doc ...] [--actual actual.yaml] [--force] [--dry-run]'); process.exit(2); }

const read = p => fs.readFileSync(path.isAbsolute(p) ? p : path.join(ROOT, p), 'utf8');
const strip = s => s.split('\n---\n').slice(1).join('\n---\n') || s; // プロンプト md の説明部分を除く
const SCHEMA = read('docs/model-schema.md');
const WRITER = strip(read('prompts/extract-model.md')).replace(/<資料>[\s\S]*<\/資料>/, '').trim();
const VERIFIER = strip(read('prompts/verify-model.md')).trim();
const sources = docs.map(d => `<document path="${d}">\n${read(d)}\n</document>`).join('\n\n');
const actualText = actualPath ? read(actualPath) : null;

const client = dry ? null : new Anthropic();

/* 1 回の呼び出し。長い出力に備えてストリーミングし、最終メッセージだけ使う */
async function ask(system, messages, label) {
  process.stdout.write(`… ${label}（${MODEL}）\n`);
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // 安全分類で断られた場合はサーバー側で既定の代替モデルに切り替える
    cache_control: { type: 'ephemeral' }, // 仕様書・プロンプト部分を再利用（修正依頼の 2 回目以降が安くなる）
    system,
    messages,
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error(`応答が拒否されました（${msg.stop_details?.category ?? '分類なし'}）: ${msg.stop_details?.explanation ?? ''}`);
  if (msg.stop_reason === 'max_tokens') throw new Error('出力が上限に達して途中で切れました。資料を分けて実行してください');
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  const u = msg.usage;
  console.log(`  入力 ${u.input_tokens} / キャッシュ読込 ${u.cache_read_input_tokens ?? 0} / 出力 ${u.output_tokens} tokens`);
  return { msg, text };
}
const yamlBlock = text => { const m = text.match(/```ya?ml\s*\n([\s\S]*?)```/); return (m ? m[1] : text).trim(); };

const writerSystem = [{ type: 'text', text: `${WRITER}\n\n# モデル仕様（docs/model-schema.md）\n\n${SCHEMA}\n\n# 出力形式\nモデル全体を 1 つの \`\`\`yaml コードブロックで出力する。YAML の最上位は name / sources / tiers / nodes / links / scenarios / requirements / unknowns / review。座標 x, y は省略してよい（自動配置される）。` }];
const userContent = `次の資料からモデルを作ってください。モデル ID は「${id}」、sources には資料のパスをそのまま入れること。\n\n${sources}${actualText ? `\n\n<actual path="${actualPath}">\n${actualText}\n</actual>\n実環境スナップショットの部品と対応する部品には evidence に { type: actual, ref: <スナップショットのキー> } を付けること。` : ''}`;

if (dry) {
  console.log(`[dry-run] 書き手 system ${writerSystem[0].text.length} 文字 / user ${userContent.length} 文字`);
  console.log(`[dry-run] 検証役 system ${VERIFIER.length} 文字`);
  console.log('[dry-run] API は呼び出していません');
  process.exit(0);
}

try {
  /* 1. 書き手 */
  const conv = [{ role: 'user', content: userContent }];
  let { msg, text } = await ask(writerSystem, conv, '書き手：抽出');
  let model, errors = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try { model = yaml.load(yamlBlock(text)); errors = validate(model); } catch (e) { errors = [`YAML として読めない: ${e.message}`]; }
    if (!errors.length) break;
    console.log(`  形式エラー ${errors.length} 件 → 修正を依頼`);
    conv.push({ role: 'assistant', content: msg.content }, { role: 'user', content: `出力に次の問題があります。修正したモデル全体を 1 つの yaml ブロックで出し直してください。\n${errors.map(e => `- ${e}`).join('\n')}` });
    ({ msg, text } = await ask(writerSystem, conv, '書き手：修正'));
  }
  if (errors.length) throw new Error(`形式エラーが解消しませんでした:\n${errors.join('\n')}`);

  const dir = path.join(ROOT, 'models', id); fs.mkdirSync(dir, { recursive: true });
  const target = fs.existsSync(path.join(dir, 'model.yaml')) && !force ? 'model.draft.yaml' : 'model.yaml';
  const modelYaml = `# tools/extract.mjs（${MODEL}）で ${docs.join(', ')} から抽出。検証結果は verify.yaml\n` + yaml.dump(model, { lineWidth: 140, noRefs: true });
  fs.writeFileSync(path.join(dir, target), modelYaml);
  console.log(`✓ models/${id}/${target}`);

  /* 2. 検証役（書き手の会話とは切り離す） */
  const v = await ask([{ type: 'text', text: VERIFIER }], [{ role: 'user', content: `${sources}\n\n<model path="models/${id}/${target}">\n${modelYaml}\n</model>\n\n結果は指定の yaml 形式で 1 つのコードブロックにしてください。` }], '検証役：照合');
  fs.writeFileSync(path.join(dir, 'verify.yaml'), `# tools/extract.mjs の検証役（${MODEL}）の結果\n` + yamlBlock(v.text) + '\n');
  console.log(`✓ models/${id}/verify.yaml`);

  /* 3. 登録と点検 */
  if (target === 'model.yaml') {
    const regPath = path.join(ROOT, 'models/registry.json'), reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (actualPath && path.resolve(ROOT, actualPath) !== path.join(dir, 'actual.yaml')) fs.copyFileSync(path.resolve(ROOT, actualPath), path.join(dir, 'actual.yaml'));
    if (!reg.some(r => r.id === id)) reg.push({ id, actual: !!actualPath });
    fs.writeFileSync(regPath, JSON.stringify(reg, null, 2) + '\n');
    const A = loadAnalyze(), m = A.layout(yaml.load(modelYaml)), act = actualPath ? yaml.load(actualText) : null;
    const g = A.gates(m, act, loadDocs(A, m));
    console.log(`\n点検：${g.pass ? '合格' : '不合格'}`);
    g.results.forEach(r => console.log(`  ${r.pass ? 'OK' : 'NG'} ${r.label}（${r.detail}）`));
    console.log('\n※ モデルは必ず人が確認してください（verify.yaml の指摘も参照）');
    process.exit(g.pass ? 0 : 1);
  } else console.log(`既存の model.yaml は上書きしていません。差分は npm run compare -- models/${id}/model.yaml models/${id}/${target}`);
} catch (e) {
  if (e instanceof Anthropic.AuthenticationError || /authentication method/i.test(e.message)) console.error('認証情報がありません。`ant auth login` を実行するか、ANTHROPIC_API_KEY を設定してください。');
  else if (e instanceof Anthropic.RateLimitError) console.error('レート制限に達しました。しばらく待って再実行してください。');
  else if (e instanceof Anthropic.APIError) console.error(`API エラー ${e.status}: ${e.message}`);
  else console.error(e.message);
  process.exit(3);
}
