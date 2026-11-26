// OSS 製品の GitHub リポジトリ情報を取得し、models/oss-stats.json に保存する。
// 閲覧者のブラウザから GitHub へ通信しないよう、公開前にこのスクリプトで取得した値を載せる。
// 使い方：node tools/fetch-oss-stats.mjs   （gh CLI にログイン済みであること）
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const repos = JSON.parse(fs.readFileSync(new URL('models/oss-repos.json', root), 'utf8'));
const gh = args => JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const rel = r => (r ? { tag: r.tag_name, date: (r.published_at || r.created_at || '').slice(0, 10) } : null);

const out = { fetchedAt: new Date().toISOString().slice(0, 10), products: {} };
const cache = new Map();
for (const [product, repo] of Object.entries(repos)) {
  if (!cache.has(repo)) {
    const info = gh([`repos/${repo}`]);
    let latest = null, first = null;
    try { latest = rel(gh([`repos/${repo}/releases/latest`])); } catch { /* リリースなし */ }
    try {
      const all = gh(['--paginate', `repos/${repo}/releases?per_page=100`]).flat();
      const dated = all.filter(r => !r.draft && (r.published_at || r.created_at)).sort((a, b) => (a.published_at || a.created_at).localeCompare(b.published_at || b.created_at));
      first = rel(dated[0]);
    } catch { /* 取得できない */ }
    cache.set(repo, {
      repo: info.full_name, stars: info.stargazers_count, forks: info.forks_count,
      license: info.license?.spdx_id && info.license.spdx_id !== 'NOASSERTION' ? info.license.spdx_id : null,
      pushedAt: (info.pushed_at || '').slice(0, 10), latest, first,
    });
  }
  out.products[product] = cache.get(repo);
  console.log(product, out.products[product].repo, out.products[product].stars);
}
fs.writeFileSync(new URL('models/oss-stats.json', root), JSON.stringify(out, null, 2) + '\n');
