// ─────────────────────────────────────────────────────────────
//  zip.js — 무압축(Store) ZIP 작성기
//  한글 파일명이 윈도우 탐색기에서 깨지지 않도록 UTF-8 플래그(bit 11)를 켭니다.
// ─────────────────────────────────────────────────────────────
import { crc32 } from './png.js';
import { utf8Encode } from './codec.js';

function dosDateTime(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/**
 * @param {{name:string, data:Uint8Array|string}[]} files
 * @returns {Blob}
 */
export function makeZip(files) {
  const { time, date } = dosDateTime();
  const locals = [];
  const centrals = [];
  let offset = 0;
  const used = new Set();

  for (const f of files) {
    let name = f.name.normalize('NFC');
    // 중복 파일명 방지
    if (used.has(name)) {
      const dot = name.lastIndexOf('.');
      let i = 2;
      while (used.has(`${dot > 0 ? name.slice(0, dot) : name} (${i})${dot > 0 ? name.slice(dot) : ''}`)) i++;
      name = `${dot > 0 ? name.slice(0, dot) : name} (${i})${dot > 0 ? name.slice(dot) : ''}`;
    }
    used.add(name);
    const nameBytes = utf8Encode(name);
    const data = typeof f.data === 'string' ? utf8Encode(f.data) : f.data;
    const crc = crc32(data);

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true); // UTF-8 파일명
    lh.setUint16(8, 0, true);      // store
    lh.setUint16(10, time, true);
    lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0, true);
    locals.push(new Uint8Array(lh.buffer), nameBytes, data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true);
    ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, nameBytes.length, true);
    ch.setUint16(30, 0, true);
    ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true);
    ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true);
    ch.setUint32(42, offset, true);
    centrals.push(new Uint8Array(ch.buffer), nameBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  const centralSize = centrals.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...locals, ...centrals, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
