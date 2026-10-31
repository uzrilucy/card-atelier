// ─────────────────────────────────────────────────────────────
//  porter.js — 내보내기 · 가져오기
// ─────────────────────────────────────────────────────────────
import {
  buildCard, worldToJson, worldFromJson, regexFromJson, parseCard, detectJsonKind,
  newProject, APP_FORMAT, APP_FORMAT_VERSION, nextUid, newLorebook,
} from './core/spec.js';
import { utf8ToBase64, base64ToUtf8, safeFileName, blobToDataURL, dataURLToBlob, uuid, latin1Encode, utf8Decode } from './core/codec.js';
import { isPng, readTextChunks, writeCardChunks } from './core/png.js';
import { makeZip } from './core/zip.js';
import { db } from './core/db.js';
import { S, imageBytes, placeholderPng, ingestImage, listSnapshots, createProject, broadcast } from './store.js';

/* ── 파일명 ── */
export function baseName(p, pattern) {
  const pat = pattern || p.exportOptions?.fileNamePattern || '{name}_v{version}';
  const name = p.card.name || p.title || 'card';
  const out = pat
    .replaceAll('{name}', name)
    .replaceAll('{version}', p.version || p.card.character_version || '1.0.0')
    .replaceAll('{date}', new Date().toISOString().slice(0, 10));
  return safeFileName(out, 'card');
}

/* ── 카드 PNG ── */
/**
 * 카드 PNG 생성 + 왕복 검증.
 * 만든 PNG를 다시 읽어 JSON을 복원한 뒤, 원본과 문자 단위로 비교합니다.
 */
export async function buildCardPng(p, opts = p.exportOptions) {
  let bytes = await imageBytes(p.imageId);
  let usedPlaceholder = false;
  if (!bytes) { bytes = await placeholderPng(p.card.name || p.title); usedPlaceholder = true; }
  const { v2, v3 } = buildCard(p, opts);
  const j2 = JSON.stringify(v2);
  const j3 = JSON.stringify(v3);
  const out = writeCardChunks(bytes, { chara: utf8ToBase64(j2), ccv3: utf8ToBase64(j3) });

  // 검증
  let verified = false, verifyError = '';
  try {
    const t = readTextChunks(out);
    const b2 = base64ToUtf8(t.chara);
    const b3 = base64ToUtf8(t.ccv3);
    verified = b2 === j2 && b3 === j3 && JSON.parse(b3).data.name === p.card.name;
    if (!verified) verifyError = '다시 읽은 데이터가 원본과 다릅니다.';
  } catch (err) {
    verifyError = err.message;
  }
  return { bytes: out, verified, verifyError, usedPlaceholder, v2, v3 };
}

export function cardJsonBlob(p, which = 'v2') {
  const { v2, v3 } = buildCard(p, p.exportOptions);
  return new Blob([JSON.stringify(which === 'v3' ? v3 : v2, null, 2)], { type: 'application/json;charset=utf-8' });
}

export function worldBlob(p) {
  return new Blob([JSON.stringify(worldToJson(p.lorebook), null, 4)], { type: 'application/json;charset=utf-8' });
}

export function regexFiles(p) {
  return p.regex.map((r) => ({
    name: `${safeFileName(r.scriptName, 'regex')}.json`,
    data: JSON.stringify(r, null, 4),
  }));
}

export function changelogMarkdown(snaps, title = '업데이트 기록') {
  const manual = snaps.filter((s) => s.kind === 'manual');
  if (!manual.length) return '';
  const lines = [`## ${title}`, ''];
  for (const s of manual) {
    const d = new Date(s.createdAt);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    lines.push(`### v${s.version} (${date})`);
    const note = (s.note || '').trim();
    if (note) {
      for (const l of note.split('\n')) lines.push(/^\s*[-*•]/.test(l) ? l.replace(/^\s*[•*]/, '-') : `- ${l}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

/** 전체 묶음 ZIP */
export async function bundleZip(p) {
  const base = baseName(p);
  const files = [];
  const png = await buildCardPng(p);
  files.push({ name: `${base}.png`, data: png.bytes });
  if (p.lorebook.entries.length) {
    files.push({ name: `월드인포/${safeFileName(p.lorebook.name || p.card.name, 'lorebook')}.json`, data: JSON.stringify(worldToJson(p.lorebook), null, 4) });
  }
  for (const f of regexFiles(p)) files.push({ name: `정규식/${f.name}`, data: f.data });
  const snaps = await listSnapshots(p.id);
  const log = changelogMarkdown(snaps);
  if (log) files.push({ name: '업데이트 기록.md', data: log });
  const notes = p.notes.filter((n) => n.body || n.title);
  if (notes.length) {
    files.push({ name: '제작 메모.md', data: notes.map((n) => `# ${n.title || '제목 없음'}\n\n${n.body}\n`).join('\n---\n\n') });
  }
  return { blob: makeZip(files), name: `${base}_묶음.zip`, verified: png.verified };
}

/* ── 프로젝트 백업 (.catl) — 기기 간 이동용 ── */
export async function backupBlob(p, { includeSnapshots = true } = {}) {
  const snaps = includeSnapshots ? await listSnapshots(p.id) : [];
  const ids = new Set([p.imageId, ...snaps.map((s) => s.data?.imageId)].filter(Boolean));
  const images = {};
  for (const id of ids) {
    const rec = await db.get('blobs', id);
    if (rec) images[id] = { dataUrl: await blobToDataURL(rec.blob), w: rec.w, h: rec.h };
  }
  const payload = {
    format: APP_FORMAT,
    version: APP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    project: p,
    snapshots: snaps,
    images,
  };
  return new Blob([JSON.stringify(payload)], { type: 'application/json;charset=utf-8' });
}

export async function allBackupsZip(projects) {
  const files = [];
  for (const p of projects) {
    const b = await backupBlob(p);
    files.push({ name: `${baseName(p, '{name}')}.catl`, data: new Uint8Array(await b.arrayBuffer()) });
  }
  return makeZip(files);
}

/* ── 가져오기 ── */
async function readFileText(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  // BOM 제거 + UTF-8 디코드
  const start = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0;
  return utf8Decode(buf.subarray(start));
}

function decodeCardText(b64) {
  const txt = base64ToUtf8(b64);
  try { return JSON.parse(txt); } catch { /* 아래 fallback */ }
  // 아주 오래된 카드: latin-1로 저장된 경우
  const bin = atob(b64.replace(/\s+/g, ''));
  return JSON.parse(utf8Decode(latin1Encode(bin)));
}

/**
 * 파일 하나를 분석 → { kind, ... }
 *  kind: 'card' | 'image' | 'world' | 'regex' | 'backup' | 'unknown'
 */
export async function analyzeFile(file) {
  const name = file.name || '';
  const lower = name.toLowerCase();
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (isPng(head)) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const t = readTextChunks(bytes);
    const raw = t.ccv3 || t.chara;
    if (raw) {
      const json = decodeCardText(raw);
      return { kind: 'card', file, json, parsed: parseCard(json), imageBlob: new Blob([bytes], { type: 'image/png' }) };
    }
    return { kind: 'image', file, imageBlob: file };
  }
  if (/^image\//.test(file.type) || /\.(jpe?g|webp|gif|avif)$/i.test(lower)) {
    return { kind: 'image', file, imageBlob: file };
  }
  let json;
  try { json = JSON.parse(await readFileText(file)); } catch { return { kind: 'unknown', file, error: 'JSON으로 읽을 수 없는 파일이에요.' }; }
  const kind = detectJsonKind(json);
  if (kind === 'card') return { kind, file, json, parsed: parseCard(json) };
  if (kind === 'world') return { kind, file, json, lorebook: worldFromJson(json, name.replace(/\.json$/i, '')) };
  if (kind === 'regex') return { kind, file, json, regex: regexFromJson(json) };
  if (kind === 'backup') return { kind, file, json };
  return { kind: 'unknown', file, error: '실리 카드·월드인포·정규식·백업 형식이 아니에요.' };
}

/** 분석 결과 → 새 프로젝트 */
export async function projectFromAnalysis(a) {
  const base = (a.file?.name || '').replace(/\.(png|json|catl|jpe?g|webp)$/i, '');
  if (a.kind === 'card') {
    const { card, lorebook, regex } = a.parsed;
    let imageId = null;
    if (a.imageBlob) imageId = (await ingestImage(a.imageBlob)).id;
    if (!lorebook.name) lorebook.name = card.name;
    const p = await createProject({
      title: card.name || base,
      version: card.character_version || '1.0.0',
      imageId, card, lorebook, regex,
    });
    return p;
  }
  if (a.kind === 'image') {
    const { id } = await ingestImage(a.imageBlob);
    return createProject({ title: base, imageId: id, card: { ...newProject().card, name: base } });
  }
  if (a.kind === 'world') {
    return createProject({ title: a.lorebook.name || base, lorebook: a.lorebook, card: { ...newProject().card, name: a.lorebook.name || base } });
  }
  if (a.kind === 'regex') {
    return createProject({ title: base || '정규식 묶음', regex: a.regex, card: { ...newProject().card, name: base } });
  }
  if (a.kind === 'backup') return restoreBackup(a.json);
  throw new Error(a.error || '가져올 수 없는 파일이에요.');
}

/** 백업 복원 — 같은 id가 이미 있으면 사본으로 들여옴 */
export async function restoreBackup(json, { asCopy } = {}) {
  const p = structuredClone(json.project);
  const existing = await db.get('projects', p.id);
  const copy = asCopy ?? !!existing;
  const oldId = p.id;
  if (copy) { p.id = uuid(); p.title = `${p.title || p.card?.name || ''} (가져옴)`.trim(); }
  p.deletedAt = null;
  for (const [id, img] of Object.entries(json.images || {})) {
    if (!(await db.get('blobs', id))) {
      await db.put('blobs', { id, blob: dataURLToBlob(img.dataUrl), w: img.w, h: img.h, createdAt: Date.now() });
    }
  }
  await db.put('projects', p);
  const snaps = (json.snapshots || []).map((s) => ({ ...s, id: copy ? uuid() : s.id, projectId: p.id }));
  if (snaps.length) await db.putMany('snapshots', snaps);
  broadcast('list-changed');
  return { project: p, copied: copy, oldId };
}

/* ── 프로젝트 안으로 합치기 ── */
export function mergeLorebook(target, incoming, mode = 'append') {
  if (mode === 'replace') {
    const keepIndex = null;
    Object.assign(target, { ...incoming, indexUid: keepIndex });
    return incoming.entries.length;
  }
  let uid = nextUid(target.entries);
  for (const e of incoming.entries) target.entries.push({ ...structuredClone(e), uid: uid++ });
  if (!target.name && incoming.name) target.name = incoming.name;
  return incoming.entries.length;
}

export function mergeRegex(target, incoming) {
  const ids = new Set(target.map((r) => r.id));
  for (const r of incoming) {
    const copy = structuredClone(r);
    if (ids.has(copy.id)) copy.id = uuid();
    target.push(copy);
  }
  return incoming.length;
}

export { newLorebook };
