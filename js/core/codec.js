// ─────────────────────────────────────────────────────────────
//  codec.js — 인코딩 안전 계층
//  실리 카드의 한글 깨짐은 거의 전부 "UTF-8 문자열을 btoa()에 바로 넣는"
//  실수에서 시작합니다. 이 파일의 함수만 거치면 그 경로가 원천 차단됩니다.
// ─────────────────────────────────────────────────────────────

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8');

/** UTF-8 문자열 → 바이트 */
export const utf8Encode = (str) => enc.encode(str);
/** 바이트 → UTF-8 문자열 */
export const utf8Decode = (bytes) => dec.decode(bytes);

/** 바이트 배열 → base64 (큰 배열도 콜스택 터지지 않게 청크 처리) */
export function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** base64 → 바이트 */
export function base64ToBytes(b64) {
  const bin = atob(String(b64).replace(/[\s\r\n]+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** UTF-8 문자열 → base64 (카드 메타데이터 기록용) */
export const utf8ToBase64 = (str) => bytesToBase64(utf8Encode(str));

/** base64 → UTF-8 문자열 (카드 메타데이터 판독용) */
export const base64ToUtf8 = (b64) => utf8Decode(base64ToBytes(b64));

/** Latin-1 (PNG tEXt 규격) 인코딩/디코딩 — base64는 ASCII라 안전 */
export function latin1Encode(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}
export function latin1Decode(bytes) {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return s;
}

/** dataURL ↔ Blob */
export async function blobToDataURL(blob) {
  return await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}
export function dataURLToBlob(url) {
  const [head, body] = url.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  return new Blob([base64ToBytes(body)], { type: mime });
}

/** 파일명에 쓸 수 없는 문자 정리 (한글은 그대로 보존) */
export function safeFileName(name, fallback = 'card') {
  const s = String(name || '').normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return s || fallback;
}

/** 간단한 콘텐츠 해시 (이미지 중복 저장 방지) */
export async function hashBytes(bytes) {
  try {
    if (globalThis.crypto?.subtle) {
      const d = await crypto.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    }
  } catch { /* 보안 컨텍스트가 아니면 아래로 */ }
  // FNV-1a 64bit 근사 (fallback)
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i]; h1 = Math.imul(h1, 16777619) >>> 0;
    h2 ^= bytes[(bytes.length - 1 - i)]; h2 = Math.imul(h2, 16777619) >>> 0;
  }
  return 'f' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0') + bytes.length.toString(16);
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
