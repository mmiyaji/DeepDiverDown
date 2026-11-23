export const STORAGE_KEY = 'ddd-home-unlock-v1';
export const WEEK = 7 * 24 * 60 * 60 * 1000;

function read(storage) {
  try { return Number(storage.getItem(STORAGE_KEY)) || 0; } catch { return 0; }
}
export function isUnlocked(session, local, now = Date.now()) {
  return read(session) > now || read(local) > now;
}
export function rememberUnlock(session, local, remember, now = Date.now()) {
  try { local.removeItem(STORAGE_KEY); } catch { /* storage may be disabled */ }
  if (remember) { try { local.setItem(STORAGE_KEY, String(now + WEEK)); } catch { /* optional persistence */ } }
  try { session.setItem(STORAGE_KEY, String(now + WEEK)); } catch { /* current page remains open */ }
}
