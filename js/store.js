// ─────────────────────────────────────────────────────────────
//  store.js — 앱 상태 · 자동 저장 · 스냅샷 · 이미지 저장소
//
//  날아감 방지 3중 장치
//   1) 입력 즉시 0.4초 디바운스 자동 저장 (IndexedDB)
//   2) 10분 간격 자동 스냅샷 (최근 30개 보관) + 수동 버전 (영구 보관)
//   3) 같은 카드를 다른 창에서 열면 감지 → 덮어쓰기 차단
// ─────────────────────────────────────────────────────────────
import { db, getSetting, setSetting } from './core/db.js';
import { uuid, hashBytes, utf8Encode } from './core/codec.js';
import { isPng, pngSize, writeCardChunks } from './core/png.js';
import { newProject } from './core/spec.js';

export const S = {
  projects: [],
  P: null,
  tab: 'card',
  sel: { lore: null, regex: null, note: null },
  detail: { lore: false, regex: false, note: false },
  save: 'saved',
  saveErr: '',
  savedAt: 0,
  stale: false,
  settings: { theme: 'auto', previewUser: '당신', autoSnapMin: 10 },
  lastSnapAt: 0,
  lastSnapHash: '',
};

export const TAB_ID = uuid();
const channel = 'BroadcastChannel' in self ? new BroadcastChannel('card-atelier') : null;
const AUTO_KEEP = 30;

/* ── 이벤트 ── */
const subs = new Map();
export function on(evt, fn) { if (!subs.has(evt)) subs.set(evt, new Set()); subs.get(evt).add(fn); return () => subs.get(evt).delete(fn); }
function emit(evt, ...a) { subs.get(evt)?.forEach((fn) => { try { fn(...a); } catch (e) { console.error(e); } }); }

function setSave(state, err = '') {
  S.save = state; S.saveErr = err;
  if (state === 'saved') S.savedAt = Date.now();
  emit('save', state);
}

/* ── 다른 창 감지 ── */
channel?.addEventListener('message', (e) => {
  const m = e.data || {};
  if (m.tab === TAB_ID) return;
  if (m.type === 'saved' && S.P && m.id === S.P.id) {
    S.stale = true;
    clearTimeout(saveTimer);
    setSave('stale');
    emit('stale');
  }
  if (m.type === 'list-changed') emit('list-changed');
});
export function broadcast(type, extra = {}) { channel?.postMessage({ type, tab: TAB_ID, ...extra }); }

/* ── 설정 ── */
export async function loadSettings() {
  const s = await getSetting('app', null);
  if (s) Object.assign(S.settings, s);
  // 이전 기본 이름만 새 기본값으로 맞추고, 다른 사용자 지정 이름은 유지합니다.
  if (S.settings.previewUser === '룽') S.settings.previewUser = '당신';
  applyTheme();
}
export async function saveSettings() {
  await setSetting('app', { ...S.settings });
  applyTheme();
}
export function applyTheme() {
  const t = S.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#15131f';
}

/* ── 프로젝트 ── */
export async function loadProjects() {
  S.projects = (await db.all('projects')).sort((a, b) => b.updatedAt - a.updatedAt);
  return S.projects;
}

export async function createProject(over = {}) {
  const p = newProject(over);
  await db.put('projects', p);
  broadcast('list-changed');
  return p;
}

export async function openProject(id) {
  await flush();
  const p = await db.get('projects', id);
  if (!p) return null;
  migrate(p);
  S.P = p;
  S.stale = false;
  S.sel = { lore: null, regex: null, note: null };
  S.detail = { lore: false, regex: false, note: false };
  const snaps = await listSnapshots(id);
  const lastAuto = snaps.find((s) => s.kind === 'auto');
  S.lastSnapAt = lastAuto?.createdAt || 0;
  S.lastSnapHash = lastAuto?.hash || '';
  setSave('saved');
  return p;
}

/** 이전 버전 데이터 구조 보정 (앞으로 스키마가 바뀌어도 여기서 흡수) */
function migrate(p) {
  const d = newProject();
  for (const k of Object.keys(d)) if (p[k] === undefined) p[k] = d[k];
  p.exportOptions = { ...d.exportOptions, ...p.exportOptions };
  p.card = { ...d.card, ...p.card };
  p.lorebook = { ...d.lorebook, ...p.lorebook };
}

export function closeProject() {
  S.P = null;
}

let saveTimer = null;
/** 편집 발생 → 자동 저장 예약 */
export function touch() {
  if (!S.P || S.stale) return;
  S.P.updatedAt = Date.now();
  setSave('dirty');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
}

let flushing = null;
export async function flush() {
  clearTimeout(saveTimer);
  if (!S.P || S.stale || S.save !== 'dirty') return flushing;
  const p = S.P;
  setSave('saving');
  flushing = (async () => {
    try {
      await db.put('projects', p);
      broadcast('saved', { id: p.id, at: p.updatedAt });
      if (S.save === 'saving') setSave('saved');
      await maybeAutoSnapshot();
    } catch (err) {
      console.error(err);
      setSave('error', err?.message || String(err));
    }
  })();
  await flushing;
  flushing = null;
}

/** 다른 창에서 고친 최신본 다시 불러오기 */
export async function reloadFromDisk() {
  if (!S.P) return;
  const id = S.P.id;
  const keepTab = S.tab;
  await openProject(id);
  S.tab = keepTab;
  emit('reloaded');
}

export async function saveProjectDirect(p) {
  await db.put('projects', p);
  broadcast('list-changed');
}

export async function softDelete(p) {
  p.deletedAt = Date.now();
  await db.put('projects', p);
  broadcast('list-changed');
}
export async function restoreDeleted(p) {
  p.deletedAt = null;
  await db.put('projects', p);
  broadcast('list-changed');
}
export async function hardDelete(p) {
  const snaps = await listSnapshots(p.id);
  await db.delMany('snapshots', snaps.map((s) => s.id));
  await db.del('projects', p.id);
  broadcast('list-changed');
}

/* ── 스냅샷 ── */
export function snapshotData(p) {
  return structuredClone({
    title: p.title, version: p.version, imageId: p.imageId,
    card: p.card, lorebook: p.lorebook, regex: p.regex, notes: p.notes, exportOptions: p.exportOptions,
  });
}

function strHash(s) {
  let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822507) >>> 0;
  }
  return h1.toString(16) + h2.toString(16) + s.length.toString(36);
}

export async function createSnapshot(kind = 'manual', { version, note = '', label = '' } = {}) {
  const p = S.P;
  if (!p) return null;
  const data = snapshotData(p);
  const hash = strHash(JSON.stringify(data));
  const snap = {
    id: uuid(), projectId: p.id, kind, createdAt: Date.now(),
    version: version ?? p.version, note, label, hash, data,
  };
  await db.put('snapshots', snap);
  if (kind === 'auto') {
    S.lastSnapAt = snap.createdAt; S.lastSnapHash = hash;
    const all = (await listSnapshots(p.id)).filter((s) => s.kind === 'auto');
    if (all.length > AUTO_KEEP) await db.delMany('snapshots', all.slice(AUTO_KEEP).map((s) => s.id));
  }
  emit('snapshots');
  return snap;
}

async function maybeAutoSnapshot() {
  const gap = (S.settings.autoSnapMin || 10) * 60 * 1000;
  if (Date.now() - S.lastSnapAt < gap) return;
  const hash = strHash(JSON.stringify(snapshotData(S.P)));
  if (hash === S.lastSnapHash) return;
  await createSnapshot('auto', { label: '자동 저장 지점' });
}

export async function listSnapshots(projectId) {
  const list = await db.byIndex('snapshots', 'projectId', projectId);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteSnapshot(id) {
  await db.del('snapshots', id);
  emit('snapshots');
}

export async function restoreSnapshot(snap) {
  await flush();
  await createSnapshot('auto', { label: `되돌리기 전 백업 (→ v${snap.version})` });
  Object.assign(S.P, structuredClone(snap.data));
  touch();
  await flush();
  emit('reloaded');
}

/* ── 이미지 ── */
const urlCache = new Map();

export async function imageUrl(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const rec = await db.get('blobs', id);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(id, url);
  return url;
}

export async function imageRecord(id) {
  return id ? db.get('blobs', id) : null;
}

export async function imageBytes(id) {
  const rec = await imageRecord(id);
  return rec ? new Uint8Array(await rec.blob.arrayBuffer()) : null;
}

/** 이미지 → 래스터 PNG (필요시 2:3 중앙 자르기) */
async function rasterToPng(blob, crop) {
  const bmp = await createImageBitmap(blob);
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (crop) {
    const target = 2 / 3;
    if (sw / sh > target) { const nw = Math.round(sh * target); sx = Math.round((sw - nw) / 2); sw = nw; }
    else { const nh = Math.round(sw / target); sy = Math.round((sh - nh) / 2); sh = nh; }
  }
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
  bmp.close?.();
  const out = await new Promise((res) => c.toBlob(res, 'image/png'));
  return new Uint8Array(await out.arrayBuffer());
}

/**
 * 이미지 저장. PNG는 원본 바이트를 그대로 보존(기존 카드 메타만 제거),
 * 그 외 형식은 PNG로 변환합니다.
 */
export async function ingestImage(blob, { crop = false } = {}) {
  let bytes = new Uint8Array(await blob.arrayBuffer());
  if (!isPng(bytes) || crop) bytes = await rasterToPng(new Blob([bytes], { type: blob.type || 'image/png' }), crop);
  else bytes = writeCardChunks(bytes, {});
  const id = await hashBytes(bytes);
  const size = pngSize(bytes) || { width: 0, height: 0 };
  const existing = await db.get('blobs', id);
  if (!existing) await db.put('blobs', { id, blob: new Blob([bytes], { type: 'image/png' }), w: size.width, h: size.height, createdAt: Date.now() });
  return { id, ...size };
}

/** 이미지가 없을 때 쓰는 자동 표지 (400×600) */
export async function placeholderPng(name) {
  const c = document.createElement('canvas');
  c.width = 400; c.height = 600;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 400, 600);
  bg.addColorStop(0, '#2a2142'); bg.addColorStop(1, '#141020');
  g.fillStyle = bg; g.fillRect(0, 0, 400, 600);
  const glow = g.createRadialGradient(120, 140, 10, 120, 140, 320);
  glow.addColorStop(0, 'rgba(185,162,255,.45)'); glow.addColorStop(1, 'rgba(185,162,255,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 400, 600);
  try { await document.fonts.load('700 48px "Gowun Batang"', name || '카드'); } catch { /* 폰트 없이 진행 */ }
  g.fillStyle = '#ece8f6';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const text = (name || '이름 없는 카드').trim();
  let size = 52;
  g.font = `700 ${size}px "Gowun Batang", serif`;
  while (g.measureText(text).width > 330 && size > 22) { size -= 2; g.font = `700 ${size}px "Gowun Batang", serif`; }
  g.fillText(text, 200, 300);
  g.strokeStyle = 'rgba(236,232,246,.25)'; g.lineWidth = 1;
  g.strokeRect(18.5, 18.5, 363, 563);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

/* ── 저장 공간 ── */
export async function storageInfo() {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  return { usage: est?.usage ?? 0, quota: est?.quota ?? 0, persisted: !!persisted };
}
export async function requestPersist() {
  return (await navigator.storage?.persist?.().catch(() => false)) || false;
}

export { utf8Encode };
