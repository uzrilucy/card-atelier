// ─────────────────────────────────────────────────────────────
//  db.js — IndexedDB 저장소 (기기 안에만 저장, 서버 없음)
//   projects  : 프로젝트 본체
//   blobs     : 이미지 원본 (해시 키, 중복 저장 없음)
//   snapshots : 버전 스냅샷 (수동 + 자동)
//   settings  : 앱 설정
// ─────────────────────────────────────────────────────────────
const DB_NAME = 'cardAtelierDB';
const DB_VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('snapshots')) {
        const s = db.createObjectStore('snapshots', { keyPath: 'id' });
        s.createIndex('projectId', 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
    req.onblocked = () => rej(new Error('다른 창이 데이터베이스를 붙잡고 있어요. 다른 창을 닫고 다시 열어주세요.'));
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => { result = r; });
    t.oncomplete = () => res(result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('저장이 중단되었습니다 (저장 공간 부족일 수 있어요).'));
  }));
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export const db = {
  get: (store, key) => open().then((d) => wrap(d.transaction(store).objectStore(store).get(key))),
  all: (store) => open().then((d) => wrap(d.transaction(store).objectStore(store).getAll())),
  put: (store, value) => tx(store, 'readwrite', (s) => { s.put(value); }),
  del: (store, key) => tx(store, 'readwrite', (s) => { s.delete(key); }),
  byIndex: (store, index, key) => open().then((d) => wrap(d.transaction(store).objectStore(store).index(index).getAll(key))),
  async putMany(store, values) {
    return tx(store, 'readwrite', (s) => { for (const v of values) s.put(v); });
  },
  async delMany(store, keys) {
    return tx(store, 'readwrite', (s) => { for (const k of keys) s.delete(k); });
  },
};

export async function getSetting(key, fallback) {
  const r = await db.get('settings', key).catch(() => null);
  return r ? r.value : fallback;
}
export async function setSetting(key, value) {
  return db.put('settings', { key, value });
}
