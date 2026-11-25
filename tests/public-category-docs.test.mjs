import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CATEGORY_DOCS } from '../js/categories.js';

test('公開ビルドに分類ページの比較表が含まれる', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-public-test-'));
  const output = path.join(parent, 'site');
  try {
    execFileSync(process.execPath, ['tools/build-public.mjs', output], { stdio: 'pipe' });
    for (const slug of Object.values(CATEGORY_DOCS)) assert.ok(fs.existsSync(path.join(output, 'docs', `category-${slug}.md`)));
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});
