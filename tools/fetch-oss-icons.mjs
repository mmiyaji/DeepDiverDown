#!/usr/bin/env node
// OSS 製品のロゴを Simple Icons から icons/oss/ に取得する（icons/ は .gitignore 済み）。
// データは CC0。製品名・ロゴの商標は各プロジェクトに帰属する。タグを固定して取得する。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './load.mjs';

const tag = '16.38.1';
const base = `https://raw.githubusercontent.com/simple-icons/simple-icons/${tag}/icons/`;
const names = ['apachespark', 'apachekafka', 'apacheflink', 'apacheairflow', 'trino', 'clickhouse', 'duckdb', 'qdrant', 'milvus',
  'prometheus', 'influxdb', 'timescale', 'victoriametrics', 'redis', 'neo4j', 'tidb', 'cockroachlabs', 'temporal', 'airbyte',
  'apacheparquet', 'apachearrow', 'apacheavro'];
const dir = path.join(ROOT, 'icons', 'oss');
fs.mkdirSync(dir, { recursive: true });
for (const name of names) {
  const response = await fetch(base + name + '.svg');
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const svg = await response.text();
  if (!svg.includes('<svg')) throw new Error('SVG を確認できません: ' + name);
  fs.writeFileSync(path.join(dir, name + '.svg'), svg);
}
fs.writeFileSync(path.join(dir, 'SOURCE.txt'), `Simple Icons ${tag}（CC0）: https://github.com/simple-icons/simple-icons\n${base}\n`);
console.log(`OSS 製品のロゴ ${names.length} 件を icons/oss/ に配置しました。`);
