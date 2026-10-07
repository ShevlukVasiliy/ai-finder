import type { Lang, Paragraph, Sentence, TextContext } from '../types';

const CYR = /\p{Script=Cyrillic}/u;
const LAT = /\p{Script=Latin}/u;
export const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export function detectLang(text: string): { lang: Lang; mixedShare: number } {
  let cyr = 0;
  let lat = 0;
  for (const ch of text) {
    if (CYR.test(ch)) cyr++;
    else if (LAT.test(ch)) lat++;
  }
  const total = cyr + lat;
  if (total === 0) return { lang: 'en', mixedShare: 0 };
  const lang: Lang = cyr >= lat ? 'ru' : 'en';
  return { lang, mixedShare: Math.min(cyr, lat) / total };
}

const ABBREV = new Set([
  'т', 'е', 'г', 'гг', 'др', 'пр', 'им', 'см', 'стр', 'руб', 'тыс', 'млн', 'млрд', 'ул', 'д', 'с', 'п',
  'mr', 'mrs', 'ms', 'dr', 'prof', 'vs', 'etc', 'e', 'i', 'g', 'eg', 'ie', 'inc', 'ltd', 'st', 'no', 'fig',
]);

const HEADING_RE = /^(?:#{1,6}\s+.+|[^.!?…:;]{2,80})$/u;
const LIST_RE = /^\s*(?:[-*•–—]|\d+[.)]|\p{Extended_Pictographic})\s+/u;

/** Splits a block of text into sentence ranges (absolute offsets). */
export function splitSentences(text: string, offset = 0): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  const re = /[.!?…]+["»”’)]*(?=\s+|$)/gu;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    const before = text.slice(start, m.index);
    const lastWord = /([\p{L}]+)$/u.exec(before)?.[1]?.toLowerCase();
    const next = text.slice(end).trimStart();
    if (m[0] === '.' && lastWord && (ABBREV.has(lastWord) || lastWord.length === 1) && /^[\p{Ll}\d]/u.test(next))
      continue;
    if (m[0] === '.' && /\d$/.test(before) && /^\d/.test(next)) continue;
    pushTrimmed(text, start, end, offset, out);
    start = end;
  }
  pushTrimmed(text, start, text.length, offset, out);
  return out;
}

function pushTrimmed(
  text: string,
  s: number,
  e: number,
  offset: number,
  out: { start: number; end: number }[],
): void {
  while (s < e && /\s/.test(text[s]!)) s++;
  while (e > s && /\s/.test(text[e - 1]!)) e--;
  if (e > s && /[\p{L}\p{N}]/u.test(text.slice(s, e))) out.push({ start: s + offset, end: e + offset });
}

export function words(text: string): string[] {
  return (text.match(WORD_RE) ?? []).map((w) => w.toLowerCase());
}

function splitParagraphs(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  const hasBlank = /\n\s*\n/.test(text);
  const re = hasBlank ? /\n\s*\n/g : /\n/g;
  let start = 0;
  let m: RegExpExecArray | null;
  const push = (s: number, e: number) => {
    while (s < e && /\s/.test(text[s]!)) s++;
    while (e > s && /\s/.test(text[e - 1]!)) e--;
    if (e > s) {
      // Inside blank-line separated text, list items on their own lines are separate blocks.
      const chunk = text.slice(s, e);
      if (hasBlank && chunk.includes('\n') && chunk.split('\n').some((l) => LIST_RE.test(l) || /^#{1,6}\s/.test(l))) {
        let ls = s;
        for (const line of chunk.split('\n')) {
          const le = ls + line.length;
          if (line.trim()) push2(ls, le);
          ls = le + 1;
        }
      } else out.push({ start: s, end: e });
    }
  };
  const push2 = (s: number, e: number) => {
    while (s < e && /\s/.test(text[s]!)) s++;
    while (e > s && /\s/.test(text[e - 1]!)) e--;
    if (e > s) out.push({ start: s, end: e });
  };
  while ((m = re.exec(text))) {
    push(start, m.index);
    start = m.index + m[0].length;
  }
  push(start, text.length);
  return out;
}

export function buildContext(text: string, forced?: Lang, isMarkdown = false): TextContext {
  const detected = detectLang(text);
  const lang = forced ?? detected.lang;
  const paragraphs: Paragraph[] = [];
  const sentences: Sentence[] = [];
  for (const p of splitParagraphs(text)) {
    const ptext = text.slice(p.start, p.end);
    const isList = LIST_RE.test(ptext);
    const isHeading = !isList && !ptext.includes('\n') && HEADING_RE.test(ptext) && words(ptext).length <= 10;
    const para: Paragraph = {
      ...p,
      text: ptext,
      sentences: [],
      kind: isList ? 'list' : isHeading ? 'heading' : 'text',
    };
    const pi = paragraphs.length;
    for (const s of splitSentences(ptext, p.start)) {
      const stext = text.slice(s.start, s.end);
      para.sentences.push(sentences.length);
      sentences.push({ ...s, text: stext, words: words(stext), paragraph: pi });
    }
    paragraphs.push(para);
  }
  const ws: TextContext['words'] = [];
  for (const m of text.matchAll(WORD_RE)) ws.push({ start: m.index, end: m.index + m[0].length, lower: m[0].toLowerCase() });
  return { text, lang, mixedShare: detected.mixedShare, sentences, paragraphs, words: ws, isMarkdown };
}

/** Sentences that belong to ordinary prose paragraphs (no headings/list items). */
export function proseSentences(ctx: TextContext): Sentence[] {
  return ctx.sentences.filter((s) => ctx.paragraphs[s.paragraph]?.kind === 'text');
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

export function cv(xs: number[]): number {
  const m = mean(xs);
  return m ? std(xs) / m : 0;
}

export function per1000(count: number, totalWords: number): number {
  return totalWords ? (count * 1000) / totalWords : 0;
}

export function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}
