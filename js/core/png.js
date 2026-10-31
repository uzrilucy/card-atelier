// ─────────────────────────────────────────────────────────────
//  png.js — PNG 청크 단위 읽기/쓰기
//  이미지 픽셀은 절대 다시 인코딩하지 않고, chara / ccv3 tEXt 청크만
//  교체합니다. 원본 화질이 그대로 보존됩니다.
// ─────────────────────────────────────────────────────────────
import { latin1Encode, latin1Decode, utf8Decode } from './codec.js';

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (PNG/ZIP 공용). 여러 조각을 이어서 계산할 수 있게 running 값 지원 */
export function crc32(bytes, running = 0) {
  let c = (running ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function isPng(bytes) {
  if (!bytes || bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIG[i]) return false;
  return true;
}

function readU32(b, o) {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}
function writeU32(b, o, v) {
  b[o] = (v >>> 24) & 0xff; b[o + 1] = (v >>> 16) & 0xff; b[o + 2] = (v >>> 8) & 0xff; b[o + 3] = v & 0xff;
}

/** 청크 목록 [{type, data, start, end}] */
export function readChunks(bytes) {
  if (!isPng(bytes)) throw new Error('PNG 파일이 아닙니다.');
  const chunks = [];
  let o = 8;
  while (o + 12 <= bytes.length) {
    const len = readU32(bytes, o);
    const type = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]);
    const dataStart = o + 8;
    const end = dataStart + len + 4;
    if (end > bytes.length) throw new Error('PNG 청크가 손상되었습니다.');
    chunks.push({ type, data: bytes.subarray(dataStart, dataStart + len), start: o, end });
    o = end;
    if (type === 'IEND') break;
  }
  return chunks;
}

/** 이미지 크기 (IHDR) */
export function pngSize(bytes) {
  const ch = readChunks(bytes).find((c) => c.type === 'IHDR');
  if (!ch) return null;
  return { width: readU32(ch.data, 0), height: readU32(ch.data, 4) };
}

/** tEXt / 비압축 iTXt 를 {keyword: text} 로 */
export function readTextChunks(bytes) {
  const out = {};
  for (const c of readChunks(bytes)) {
    if (c.type === 'tEXt') {
      const z = c.data.indexOf(0);
      if (z < 0) continue;
      const key = latin1Decode(c.data.subarray(0, z));
      out[key] = latin1Decode(c.data.subarray(z + 1));
    } else if (c.type === 'iTXt') {
      const d = c.data;
      const z = d.indexOf(0);
      if (z < 0) continue;
      const key = latin1Decode(d.subarray(0, z));
      const compressed = d[z + 1];
      if (compressed) continue; // 압축 iTXt는 카드에 쓰이지 않음
      let p = z + 3;
      const langEnd = d.indexOf(0, p); if (langEnd < 0) continue; p = langEnd + 1;
      const transEnd = d.indexOf(0, p); if (transEnd < 0) continue; p = transEnd + 1;
      if (!(key in out)) out[key] = utf8Decode(d.subarray(p));
    }
  }
  return out;
}

function makeChunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  writeU32(out, 0, data.length);
  const typeBytes = latin1Encode(type);
  out.set(typeBytes, 4);
  out.set(data, 8);
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  writeU32(out, 8 + data.length, crc32(crcInput));
  return out;
}

function makeTextChunk(keyword, text) {
  const k = latin1Encode(keyword);
  const t = latin1Encode(text);
  const data = new Uint8Array(k.length + 1 + t.length);
  data.set(k, 0);
  data[k.length] = 0;
  data.set(t, k.length + 1);
  return makeChunk('tEXt', data);
}

const CARD_KEYS = ['chara', 'ccv3'];

/**
 * 원본 PNG 바이트에서 기존 카드 메타(chara/ccv3)를 제거하고 새 텍스트 청크를
 * IEND 바로 앞에 삽입합니다. 픽셀 데이터(IDAT)는 손대지 않습니다.
 * @param {Uint8Array} bytes
 * @param {Record<string,string>} texts  keyword → base64 문자열
 */
export function writeCardChunks(bytes, texts) {
  const chunks = readChunks(bytes);
  const parts = [new Uint8Array(SIG)];
  for (const c of chunks) {
    if ((c.type === 'tEXt' || c.type === 'iTXt' || c.type === 'zTXt')) {
      const z = c.data.indexOf(0);
      const key = z >= 0 ? latin1Decode(c.data.subarray(0, z)).toLowerCase() : '';
      if (CARD_KEYS.includes(key)) continue; // 기존 카드 데이터 제거
    }
    if (c.type === 'IEND') {
      for (const [k, v] of Object.entries(texts)) parts.push(makeTextChunk(k, v));
    }
    parts.push(bytes.subarray(c.start, c.end));
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
