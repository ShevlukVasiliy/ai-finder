import { strFromU8, unzlibSync } from 'fflate';
import type { ImageMeta } from '../types';

const ISSUERS = ['OpenAI', 'Adobe', 'Google', 'Microsoft', 'Truepic', 'Leica', 'Nikon', 'Sony', 'Canon', 'Midjourney', 'Stability', 'Meta', 'Samsung', 'Qualcomm'];

const latin1 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return s;
};

function emptyMeta(): ImageMeta {
  return {
    format: 'unknown',
    width: 0,
    height: 0,
    exif: {},
    xmp: '',
    pngText: {},
    c2pa: { present: false, issuers: [], aiClaim: false },
    jpegQuantTables: [],
    jpegDqtCount: 0,
  };
}

function scanC2pa(meta: ImageMeta, payload: Uint8Array): void {
  const s = latin1(payload);
  if (!/c2pa|jumb/i.test(s)) return;
  meta.c2pa.present = true;
  for (const i of ISSUERS) if (s.includes(i) && !meta.c2pa.issuers.includes(i)) meta.c2pa.issuers.push(i);
  if (/trainedAlgorithmicMedia|compositeSynthetic/.test(s)) meta.c2pa.aiClaim = true;
}

const TAGS: Record<number, string> = {
  0x010f: 'Make',
  0x0110: 'Model',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x013b: 'Artist',
  0x8298: 'Copyright',
  0x9003: 'DateTimeOriginal',
  0x829a: 'ExposureTime',
  0x8827: 'ISO',
  0x920a: 'FocalLength',
  0x010e: 'ImageDescription',
};

/** Minimal TIFF/EXIF reader: ASCII and short/long/rational values from IFD0 and the Exif sub-IFD. */
export function parseExif(tiff: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  if (tiff.length < 8) return out;
  const le = tiff[0] === 0x49;
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  const readIfd = (off: number, depth: number) => {
    if (off + 2 > tiff.length || depth > 2) return;
    const n = u16(off);
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      if (e + 12 > tiff.length) return;
      const tag = u16(e);
      const type = u16(e + 2);
      const count = u32(e + 4);
      if (tag === 0x8769) {
        readIfd(u32(e + 8), depth + 1);
        continue;
      }
      const name = TAGS[tag];
      if (!name) continue;
      if (type === 2) {
        const at = count > 4 ? u32(e + 8) : e + 8;
        if (at + count <= tiff.length) out[name] = strFromU8(tiff.subarray(at, at + count)).replace(/\0+$/, '').trim();
      } else if (type === 3) out[name] = String(u16(e + 8));
      else if (type === 4) out[name] = String(u32(e + 8));
      else if (type === 5) {
        const at = u32(e + 8);
        if (at + 8 <= tiff.length) out[name] = `${u32(at)}/${u32(at + 4)}`;
      }
    }
  };
  readIfd(u32(4), 0);
  return out;
}

function parseJpeg(b: Uint8Array, meta: ImageMeta): void {
  meta.format = 'jpeg';
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1]!;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    const seg = b.subarray(i + 4, i + 2 + len);
    if (marker === 0xe1) {
      const head = latin1(seg.subarray(0, 32));
      if (head.startsWith('Exif\0')) Object.assign(meta.exif, parseExif(seg.subarray(6)));
      else if (head.startsWith('http://ns.adobe.com/xap/')) meta.xmp += strFromU8(seg);
    } else if (marker === 0xeb) scanC2pa(meta, seg);
    else if (marker === 0xdb) {
      meta.jpegDqtCount++;
      let p = 0;
      while (p < seg.length) {
        const pq = seg[p]! >> 4;
        const size = pq ? 128 : 64;
        const table: number[] = [];
        for (let k = 0; k < 64; k++) table.push(pq ? (seg[p + 1 + k * 2]! << 8) | seg[p + 2 + k * 2]! : seg[p + 1 + k]!);
        meta.jpegQuantTables.push(table);
        p += 1 + size;
      }
    } else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      meta.height = (seg[1]! << 8) | seg[2]!;
      meta.width = (seg[3]! << 8) | seg[4]!;
    }
    i += 2 + len;
  }
}

function parsePng(b: Uint8Array, meta: ImageMeta): void {
  meta.format = 'png';
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 8;
  while (i + 8 <= b.length) {
    const len = dv.getUint32(i);
    const type = latin1(b.subarray(i + 4, i + 8));
    const data = b.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') {
      meta.width = dv.getUint32(i + 8);
      meta.height = dv.getUint32(i + 12);
    } else if (type === 'tEXt') {
      const z = data.indexOf(0);
      if (z > 0) meta.pngText[latin1(data.subarray(0, z))] = latin1(data.subarray(z + 1));
    } else if (type === 'zTXt') {
      const z = data.indexOf(0);
      try {
        meta.pngText[latin1(data.subarray(0, z))] = strFromU8(unzlibSync(data.subarray(z + 2)));
      } catch {
        /* corrupt chunk */
      }
    } else if (type === 'iTXt') {
      const z = data.indexOf(0);
      const key = latin1(data.subarray(0, z));
      const compressed = data[z + 1] === 1;
      let p = z + 3;
      p = data.indexOf(0, p) + 1; // language tag
      p = data.indexOf(0, p) + 1; // translated keyword
      const body = data.subarray(p);
      try {
        const val = compressed ? strFromU8(unzlibSync(body)) : strFromU8(body);
        if (key === 'XML:com.adobe.xmp') meta.xmp += val;
        else meta.pngText[key] = val;
      } catch {
        /* corrupt chunk */
      }
    } else if (type === 'eXIf') Object.assign(meta.exif, parseExif(data));
    else if (type === 'caBX') scanC2pa(meta, data);
    else if (type === 'IEND') break;
    i += 12 + len;
  }
}

function parseWebp(b: Uint8Array, meta: ImageMeta): void {
  meta.format = 'webp';
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 12;
  while (i + 8 <= b.length) {
    const type = latin1(b.subarray(i, i + 4));
    const len = dv.getUint32(i + 4, true);
    const data = b.subarray(i + 8, i + 8 + len);
    if (type === 'VP8X') {
      meta.width = 1 + (data[4]! | (data[5]! << 8) | (data[6]! << 16));
      meta.height = 1 + (data[7]! | (data[8]! << 8) | (data[9]! << 16));
    } else if (type === 'VP8 ' && !meta.width) {
      meta.width = (data[6]! | (data[7]! << 8)) & 0x3fff;
      meta.height = (data[8]! | (data[9]! << 8)) & 0x3fff;
    } else if (type === 'VP8L' && !meta.width) {
      const bits = data[1]! | (data[2]! << 8) | (data[3]! << 16) | (data[4]! << 24);
      meta.width = (bits & 0x3fff) + 1;
      meta.height = ((bits >> 14) & 0x3fff) + 1;
    } else if (type === 'EXIF') Object.assign(meta.exif, parseExif(latin1(data.subarray(0, 6)).startsWith('Exif') ? data.subarray(6) : data));
    else if (type === 'XMP ') meta.xmp += strFromU8(data);
    else if (type === 'C2PA') scanC2pa(meta, data);
    i += 8 + len + (len % 2);
  }
}

export function parseImageMeta(bytes: Uint8Array): ImageMeta {
  const meta = emptyMeta();
  if (bytes[0] === 0xff && bytes[1] === 0xd8) parseJpeg(bytes, meta);
  else if (bytes[0] === 0x89 && latin1(bytes.subarray(1, 4)) === 'PNG') parsePng(bytes, meta);
  else if (latin1(bytes.subarray(0, 4)) === 'RIFF' && latin1(bytes.subarray(8, 12)) === 'WEBP') parseWebp(bytes, meta);
  else throw new Error('Unsupported image format');
  return meta;
}
