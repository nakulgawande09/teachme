/**
 * Parent-recorded word clips, in IndexedDB.
 *
 * localStorage is for the small structured blob; audio does not fit there.
 * Records are `{key, blob, type, at}` keyed by the wordClipKey. A sync
 * in-memory Set mirrors the stored keys, because the scheduler and the
 * render path ask "is this word audible?" dozens of times per paint and
 * must never await a database for it.
 *
 * Everything here degrades to "no clips": private browsing that refuses
 * IndexedDB, an eviction under storage pressure, a quota error mid-save —
 * the words mode then simply schedules fewer languages, exactly as if the
 * clips had never been made. The recorder card tells the parent the truth
 * about how many clips exist; this module never throws at a child.
 */

const DB_NAME = 'akshar-clips';
const DB_VERSION = 1;
const STORE = 'clips';

let db = null;
let broken = false;
const index = new Set();

function open() {
  return new Promise((resolve) => {
    if (db) { resolve(db); return; }
    if (broken || !('indexedDB' in window)) { resolve(null); return; }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      console.warn('clips: indexedDB unavailable', err);
      broken = true;
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      db = req.result;
      db.onclose = () => { db = null; };
      resolve(db);
    };
    req.onerror = () => {
      console.warn('clips: open failed', req.error);
      broken = true;
      resolve(null);
    };
  });
}

/** Fill the sync key index at boot. Safe to call again after a save. */
export async function loadIndex() {
  const conn = await open();
  if (!conn) return index;
  return new Promise((resolve) => {
    try {
      const req = conn.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
      req.onsuccess = () => {
        index.clear();
        for (const k of req.result || []) index.add(String(k));
        resolve(index);
      };
      req.onerror = () => resolve(index);
    } catch (err) {
      console.warn('clips: index read failed', err);
      resolve(index);
    }
  });
}

/** Sync — the audibility oracle's first rung. */
export const hasClip = (key) => index.has(key);

/** How many clips exist under a prefix (e.g. `w/mr/`) — the honesty count. */
export function clipCount(prefix) {
  let n = 0;
  for (const k of index) if (k.startsWith(prefix)) n++;
  return n;
}

export async function getClip(key) {
  const conn = await open();
  if (!conn) return null;
  return new Promise((resolve) => {
    try {
      const req = conn.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (err) {
      console.warn('clips: read failed', key, err);
      resolve(null);
    }
  });
}

const isQuota = (e) =>
  !!e && (e.name === 'QuotaExceededError' || e.code === 22);

/** @returns {Promise<{ok:boolean, reason?:'quota'|'unavailable'|'failed'}>} */
export async function putClip(key, blob, type = '') {
  const conn = await open();
  if (!conn) return { ok: false, reason: 'unavailable' };
  return new Promise((resolve) => {
    try {
      const tx = conn.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ key, blob, type: type || blob.type || '', at: Date.now() });
      tx.oncomplete = () => {
        index.add(key);
        resolve({ ok: true });
      };
      tx.onerror = () => {
        const quota = isQuota(tx.error);
        console.warn('clips: save failed', key, tx.error);
        resolve({ ok: false, reason: quota ? 'quota' : 'failed' });
      };
    } catch (err) {
      resolve({ ok: false, reason: isQuota(err) ? 'quota' : 'failed' });
    }
  });
}

export async function deleteClip(key) {
  const conn = await open();
  if (!conn) return false;
  return new Promise((resolve) => {
    try {
      const tx = conn.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => {
        index.delete(key);
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
