import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../tools/load.mjs';

test('公式アイコン ZIP は対象の SVG だけを安全に展開する', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-icon-test-'));
  const python = process.platform === 'win32' ? 'python' : 'python3';
  try {
    const archive = path.join(tmp, 'icons.zip'), output = path.join(tmp, 'out');
    const makeZip = [
      'import sys, zipfile',
      'with zipfile.ZipFile(sys.argv[1], "w") as z:',
      ' z.writestr("Architecture-Service-Icons_test/Arch_Test/64/valid.svg", "<svg/>")',
      ' z.writestr("Architecture-Service-Icons_test/Arch_Test/32/skip.svg", "<svg/>")',
      ' z.writestr("Resource-Icons_test/Res_Test/resource.svg", "<svg/>")',
      ' z.writestr("../escape.svg", "<svg/>")',
      ' z.writestr("__MACOSX/metadata.svg", "<svg/>")',
      ' z.writestr("readme.txt", "not an icon")',
    ].join('\n');
    const made = spawnSync(python, ['-c', makeZip, archive], { encoding: 'utf8' });
    assert.equal(made.status, 0, made.stderr);
    const run = spawnSync(python, [path.join(ROOT, 'tools/extract-official-icon-zip.py'), archive, output, 'aws'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.ok(fs.existsSync(path.join(output, 'Architecture-Service-Icons_test/Arch_Test/64/valid.svg')));
    assert.ok(fs.existsSync(path.join(output, 'Resource-Icons_test/Res_Test/resource.svg')));
    assert.ok(!fs.existsSync(path.join(output, 'Architecture-Service-Icons_test/Arch_Test/32/skip.svg')));
    assert.ok(!fs.existsSync(path.join(tmp, 'escape.svg')));
    assert.ok(!fs.existsSync(path.join(output, '__MACOSX/metadata.svg')));
  } finally {
    const resolved = path.resolve(tmp), tempRoot = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(resolved.startsWith(tempRoot));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
