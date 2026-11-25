import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings, saveSettings } from '../js/settings.js';

test('描画モードは保存され、不正な値は標準に戻る', () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  try {
    assert.equal(loadSettings().renderMode, 'standard');
    for (const renderMode of ['standard', 'light', 'minimal']) {
      saveSettings({ renderMode });
      assert.equal(loadSettings().renderMode, renderMode);
    }
    saveSettings({ renderMode: 'invalid' });
    assert.equal(loadSettings().renderMode, 'standard');
  } finally { delete globalThis.localStorage; }
});
