#!/usr/bin/env node
// 依存ライブラリ・フォントを node_modules から vendor/ にコピーする（ライセンス文も同梱）
//   npm install && npm run vendor
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './load.mjs';

const NM = path.join(ROOT, 'node_modules'), OUT = path.join(ROOT, 'vendor');
const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(OUT, to)), { recursive: true }); fs.copyFileSync(path.join(NM, from), path.join(OUT, to)); console.log(`  ${to}`); };
const ver = p => JSON.parse(fs.readFileSync(path.join(NM, p, 'package.json'), 'utf8')).version;

fs.rmSync(OUT, { recursive: true, force: true });

// three.js（MIT）
copy('three/build/three.module.js', 'three/three.module.js');
copy('three/examples/jsm/controls/OrbitControls.js', 'three/addons/controls/OrbitControls.js');
copy('three/examples/jsm/renderers/CSS2DRenderer.js', 'three/addons/renderers/CSS2DRenderer.js');
copy('three/LICENSE', 'three/LICENSE');

// js-yaml（MIT）
copy('js-yaml/dist/js-yaml.min.js', 'js-yaml/js-yaml.min.js');
copy('js-yaml/LICENSE', 'js-yaml/LICENSE');

// フォント（SIL OFL 1.1）：欧文のみ。日本語は OS 標準フォントを使う
const fonts = [['inter', 'Inter', [400, 500, 600, 700]], ['ibm-plex-mono', 'IBM Plex Mono', [400, 600]]];
let css = '/* 自動生成（tools/vendor.mjs）。フォントは SIL Open Font License 1.1 */\n';
for (const [pkg, family, weights] of fonts) {
  for (const w of weights) {
    const f = `${pkg}-latin-${w}-normal.woff2`;
    copy(`@fontsource/${pkg}/files/${f}`, `fonts/${f}`);
    css += `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(${f}) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n`;
  }
  copy(`@fontsource/${pkg}/LICENSE`, `fonts/LICENSE-${pkg}.txt`);
}
fs.writeFileSync(path.join(OUT, 'fonts/fonts.css'), css);

const list = [['three', 'MIT'], ['js-yaml', 'MIT'], ['@fontsource/inter', 'OFL-1.1'], ['@fontsource/ibm-plex-mono', 'OFL-1.1']];
fs.writeFileSync(path.join(OUT, 'README.md'), '# vendor\n\n`npm ci`（postinstall）または `npm run vendor` で node_modules から生成。git 管理外・手で編集しない。\n\n| パッケージ | バージョン | ライセンス |\n|---|---|---|\n' +
  list.map(([p, l]) => `| ${p} | ${ver(p)} | ${l} |`).join('\n') + '\n');
console.log('done');
