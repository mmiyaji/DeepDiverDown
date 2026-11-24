import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyPublicIcons } from '../tools/public-icons.mjs';

test('公開ビルドには対応表にある画像のみを含める', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-icons-test-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const root = path.join(tmp, 'root'), out = path.join(tmp, 'out');
  fs.mkdirSync(path.join(root, 'icons', 'aws'), { recursive: true });
  fs.writeFileSync(path.join(root, 'icons', 'aws', 's3.svg'), '<svg/>');
  fs.writeFileSync(path.join(root, 'icons', 'aws', 'private.zip'), 'private');
  fs.writeFileSync(path.join(root, 'icons', 'manifest.json'), JSON.stringify({ 'aws:s3': 'icons/aws/s3.svg' }));
  assert.equal(copyPublicIcons(root, out, { required: true }), 1);
  assert.equal(fs.readFileSync(path.join(out, 'icons', 'aws', 's3.svg'), 'utf8'), '<svg/>');
  assert.equal(fs.existsSync(path.join(out, 'icons', 'aws', 'private.zip')), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'icons', 'manifest.json'), 'utf8')), { 'aws:s3': 'icons/aws/s3.svg' });
  fs.writeFileSync(path.join(root, 'icons', 'manifest.json'), JSON.stringify({ 'aws:s3': 'icons/../secret.svg' }));
  assert.throws(() => copyPublicIcons(root, out, { required: true }), /Invalid icon entry/);
  fs.writeFileSync(path.join(root, 'icons', 'manifest.json'), '{}');
  assert.throws(() => copyPublicIcons(root, out, { required: true }), /empty/);
});
