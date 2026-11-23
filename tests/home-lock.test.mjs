import test from 'node:test';
import assert from 'node:assert/strict';
import { isUnlocked, rememberUnlock, STORAGE_KEY, WEEK } from '../js/home-lock.js';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
test('remembered unlock works in a new session until exactly seven days', () => {
  const session = storage(), local = storage(), start = 1000000000;
  rememberUnlock(session, local, true, start);
  assert.equal(local.getItem(STORAGE_KEY), String(start + WEEK));
  assert.equal(isUnlocked(storage(), local, start + WEEK - 1), true);
  assert.equal(isUnlocked(storage(), local, start + WEEK), false);
  assert.equal(isUnlocked(session, local, start + WEEK), false);
});
test('without remembering the unlock is limited to the current session', () => {
  const session = storage(), local = storage(), start = 1000000000;
  rememberUnlock(session, local, true, start);
  rememberUnlock(session, local, false, start + 1);
  assert.equal(isUnlocked(session, local, start + 2), true);
  assert.equal(isUnlocked(storage(), local, start + 2), false);
});
