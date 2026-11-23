import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAppearance, DEFAULTS, loadSettings, saveSettings } from '../js/settings.js';

test('図の色は保存・復元され、不正な値は既定色になる', () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const root = { dataset: {}, style: { setProperty() {} } };
  globalThis.document = { documentElement: root };
  assert.equal(loadSettings().viewAccent, 'blue');
  saveSettings({ ...DEFAULTS, viewAccent: 'blue' });
  const settings = loadSettings();
  applyAppearance(settings);
  assert.equal(root.dataset.viewAccent, 'blue');
  applyAppearance({ ...settings, viewAccent: 'invalid' });
  assert.equal(root.dataset.viewAccent, 'blue');
  saveSettings({ ...DEFAULTS, viewAccent: 'orange' });
  applyAppearance(loadSettings());
  assert.equal(root.dataset.viewAccent, 'orange');
  delete globalThis.localStorage;
  delete globalThis.document;
});
