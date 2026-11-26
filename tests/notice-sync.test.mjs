// トップページの注意事項は、サイト情報（about.html）の文面と同じにする。表現がずれないよう確かめる。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const about = read('about.html');
const home = read('home.html');
const paras = html => [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => m[1].replace(/\s+/g, ' ').trim());
const section = id => about.match(new RegExp(String.raw`<section id="${id}">[\s\S]*?</section>`))?.[0] ?? '';

test('トップページの注意事項の段落は、サイト情報の位置付け・免責事項・参考にしたサイトと一致する', () => {
  const notice = home.match(/<div id="notice-description"[\s\S]*?<\/div>/)?.[0] ?? '';
  const aboutParas = new Set(['purpose', 'disclaimer', 'inspiration'].flatMap(id => paras(section(id))));
  const noticeParas = paras(notice);
  assert.ok(noticeParas.length >= 3, '注意事項の段落が少ない');
  for (const p of noticeParas) assert.ok(aboutParas.has(p), `サイト情報にない文面：${p.slice(0, 40)}`);
});

test('トップページのフッターのリンク名は「サイト情報」', () => {
  assert.match(home, /<a href="about\.html">サイト情報<\/a><\/footer>/);
});
