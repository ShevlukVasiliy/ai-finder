import { strFromU8, unzipSync } from 'fflate';
import type { DocumentMeta, ParsedDocument } from '../types';

function emptyMeta(format: DocumentMeta['format']): DocumentMeta {
  return { format, styles: [], rsids: 0, fonts: [], colors: [], htmlFragments: 0, positions: [] };
}

function xml(src: string): Document {
  return new DOMParser().parseFromString(src, 'application/xml');
}

function byLocal(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter((e) => e.localName === name);
}

function firstText(root: Document, name: string): string | undefined {
  const v = byLocal(root, name)[0]?.textContent?.trim();
  return v || undefined;
}

function attr(e: Element, local: string): string | null {
  for (const a of Array.from(e.attributes)) if (a.localName === local) return a.value;
  return null;
}

/** Joins paragraphs with blank lines and records offsets → (page, paragraph). */
function assemble(paras: { text: string; page: number }[], meta: DocumentMeta): string {
  let text = '';
  let pi = 0;
  for (const p of paras) {
    if (!p.text.trim()) continue;
    if (text) text += '\n\n';
    const start = text.length;
    text += p.text;
    meta.positions.push({ start, end: text.length, page: p.page, paragraph: ++pi });
  }
  return text;
}

export function parseDocx(bytes: Uint8Array): ParsedDocument {
  const files = unzipSync(bytes);
  const docXml = files['word/document.xml'];
  if (!docXml) throw new Error('Not a DOCX: word/document.xml missing');
  const meta = emptyMeta('docx');
  const doc = xml(strFromU8(docXml));
  const rsids = new Set<string>();
  const styles = new Set<string>();
  const fonts = new Set<string>();
  const colors = new Set<string>();
  const paras: { text: string; page: number }[] = [];
  let page = 1;
  for (const p of byLocal(doc, 'p')) {
    const r = attr(p, 'rsidR');
    if (r) rsids.add(r);
    const st = byLocal(p, 'pStyle')[0];
    styles.add(st ? (attr(st, 'val') ?? 'Normal') : 'Normal');
    let t = '';
    for (const node of byLocal(p, '*')) {
      if (node.localName === 't') t += node.textContent ?? '';
      else if (node.localName === 'tab') t += '\t';
      else if (node.localName === 'br' && attr(node, 'type') === 'page') page++;
      else if (node.localName === 'lastRenderedPageBreak') page++;
      else if (node.localName === 'rFonts') {
        const f = attr(node, 'ascii') ?? attr(node, 'hAnsi');
        if (f) fonts.add(f);
      } else if (node.localName === 'color') {
        const c = attr(node, 'val');
        if (c) colors.add(c);
      } else if (node.localName === 'rsidR' || node.localName === 'r') {
        const rr = attr(node, 'rsidR');
        if (rr) rsids.add(rr);
      }
    }
    paras.push({ text: t, page });
  }
  meta.htmlFragments = byLocal(doc, 'altChunk').length;
  meta.rsids = rsids.size;
  meta.styles = [...styles];
  meta.fonts = [...fonts];
  meta.colors = [...colors];
  const stylesXml = files['word/styles.xml'];
  if (stylesXml) {
    const sd = xml(strFromU8(stylesXml));
    const names = new Map<string, string>();
    for (const s of byLocal(sd, 'style')) {
      const id = attr(s, 'styleId');
      const name = byLocal(s, 'name')[0];
      if (id && name) names.set(id, attr(name, 'val') ?? id);
    }
    meta.styles = meta.styles.map((s) => names.get(s) ?? s);
  }
  const core = files['docProps/core.xml'];
  if (core) {
    const c = xml(strFromU8(core));
    meta.author = firstText(c, 'creator');
    meta.created = firstText(c, 'created');
    meta.modified = firstText(c, 'modified');
    const rev = firstText(c, 'revision');
    if (rev) meta.revisions = Number(rev);
    const lastBy = firstText(c, 'lastModifiedBy');
    if (lastBy && !meta.author) meta.author = lastBy;
  }
  const app = files['docProps/app.xml'];
  if (app) {
    const a = xml(strFromU8(app));
    meta.application = firstText(a, 'Application');
    const tt = firstText(a, 'TotalTime');
    if (tt !== undefined) meta.totalTimeMin = Number(tt);
  }
  return { text: assemble(paras, meta), meta };
}

export function parseOdt(bytes: Uint8Array): ParsedDocument {
  const files = unzipSync(bytes);
  const content = files['content.xml'];
  if (!content) throw new Error('Not an ODT: content.xml missing');
  const meta = emptyMeta('odt');
  const doc = xml(strFromU8(content));
  const styles = new Set<string>();
  const paras: { text: string; page: number }[] = [];
  for (const p of byLocal(doc, 'p').concat(byLocal(doc, 'h'))) {
    styles.add(attr(p, 'style-name') ?? 'Standard');
    paras.push({ text: p.textContent ?? '', page: 1 });
  }
  meta.styles = [...styles];
  const fontDecls = byLocal(doc, 'font-face').map((f) => attr(f, 'name')).filter((x): x is string => Boolean(x));
  meta.fonts = [...new Set(fontDecls)];
  const m = files['meta.xml'];
  if (m) {
    const md = xml(strFromU8(m));
    meta.author = firstText(md, 'initial-creator') ?? firstText(md, 'creator');
    meta.creator = firstText(md, 'generator');
    meta.application = meta.creator;
    meta.created = firstText(md, 'creation-date');
    meta.modified = firstText(md, 'date');
    const cycles = firstText(md, 'editing-cycles');
    if (cycles) meta.revisions = Number(cycles);
    const dur = firstText(md, 'editing-duration');
    const dm = dur && /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(dur);
    if (dm) meta.totalTimeMin = Number(dm[1] ?? 0) * 60 + Number(dm[2] ?? 0) + Math.round(Number(dm[3] ?? 0) / 60);
  }
  return { text: assemble(paras, meta), meta };
}

export function parseRtf(src: string): ParsedDocument {
  const meta = emptyMeta('rtf');
  const info = (key: string) => new RegExp(`\\{\\\\${key}\\s+([^}]*)\\}`).exec(src)?.[1]?.trim();
  meta.author = info('author');
  meta.creator = info('operator');
  const gen = /\{\\\*\\generator\s+([^};]*)/.exec(src)?.[1]?.trim();
  if (gen) meta.application = gen;
  meta.fonts = [...src.matchAll(/\\f\d+\\f\w+[^;{}]*?\s([^;{}\\]+);/g)].map((m) => m[1]!.trim());
  // Strip RTF: groups we do not need, control words, hex escapes, unicode escapes.
  let body = src.replace(/\{\\\*[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');
  body = body.replace(/\{\\(?:fonttbl|colortbl|stylesheet|info)(?:[^{}]|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*\}/g, '');
  body = body
    .replace(/\\u(-?\d+)\??/g, (_, n: string) => String.fromCharCode((Number(n) + 65536) % 65536))
    .replace(/\\'([0-9a-f]{2})/gi, (_, h: string) => decodeCp1251(parseInt(h, 16)))
    .replace(/\\par[d]?\b ?/g, '\n\n')
    .replace(/\\line\b ?/g, '\n')
    .replace(/\\tab\b ?/g, '\t')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/\\([{}\\])/g, '$1')
    .replace(/[{}]/g, '');
  const paras = body.split(/\n{2,}/).map((t) => ({ text: t.replace(/\s+/g, ' ').trim(), page: 1 }));
  return { text: assemble(paras, meta), meta };
}

function decodeCp1251(b: number): string {
  if (b < 0x80) return String.fromCharCode(b);
  if (b >= 0xc0) return String.fromCharCode(0x410 + (b - 0xc0));
  if (b === 0xa8) return 'Ё';
  if (b === 0xb8) return 'ё';
  return new TextDecoder('windows-1252').decode(new Uint8Array([b]));
}

export function parsePlain(src: string, format: 'txt' | 'md'): ParsedDocument {
  const meta = emptyMeta(format);
  const text = src.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const paras = text.split(/\n\s*\n/);
  let off = 0;
  let i = 0;
  for (const p of paras) {
    const start = text.indexOf(p, off);
    off = start + p.length;
    if (p.trim()) meta.positions.push({ start, end: off, page: 1, paragraph: ++i });
  }
  return { text, meta };
}

type PdfJs = typeof import('pdfjs-dist');

/** PDF text layer via pdf.js. The library is injected so tests can use the Node build. */
export async function parsePdf(bytes: Uint8Array, pdfjs: PdfJs): Promise<ParsedDocument> {
  const meta = emptyMeta('pdf');
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  const doc = await task.promise;
  const info = (await doc.getMetadata()).info as Record<string, unknown>;
  const str = (k: string) => (typeof info[k] === 'string' && info[k] ? (info[k] as string) : undefined);
  meta.author = str('Author');
  meta.creator = str('Creator');
  meta.producer = str('Producer');
  meta.created = str('CreationDate');
  meta.modified = str('ModDate');
  const paras: { text: string; page: number }[] = [];
  const fonts = new Set<string>();
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let line = '';
    let lastY: number | null = null;
    const lines: string[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      fonts.add(item.fontName);
      const y = item.transform[5] as number;
      if (lastY !== null && Math.abs(y - lastY) > 1) {
        lines.push(line);
        line = '';
      }
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = '';
      }
      lastY = y;
    }
    if (line) lines.push(line);
    // Group lines into paragraphs: a blank line or a line ending with sentence punctuation followed by a short line.
    let cur = '';
    for (const l of lines) {
      if (!l.trim()) {
        if (cur) paras.push({ text: cur.trim(), page: p });
        cur = '';
      } else cur += (cur && !cur.endsWith('-') ? ' ' : '') + l.trim();
    }
    if (cur) paras.push({ text: cur.trim(), page: p });
  }
  meta.fonts = [...fonts];
  await task.destroy();
  return { text: assemble(paras, meta), meta };
}
