import { per1000 } from '../text/segment';
import type { Detector, Span, TextContext } from '../types';
import { finding, notApplicable, result, spansOf } from './util';

/** Latin ↔ Cyrillic look-alikes (keys: foreign letter, values: native replacement). */
export const LAT_TO_CYR: Record<string, string> = {
  a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', h: 'н', t: 'т', b: 'в',
  A: 'А', E: 'Е', O: 'О', P: 'Р', C: 'С', X: 'Х', Y: 'У', K: 'К', M: 'М', H: 'Н', T: 'Т', B: 'В',
  i: 'і',
};
export const CYR_TO_LAT: Record<string, string> = Object.fromEntries(
  Object.entries(LAT_TO_CYR)
    .filter(([k]) => k !== 'i')
    .map(([k, v]) => [v, k]),
);
/** Greek and other homoglyphs mapped to Latin. */
export const GREEK_TO_LAT: Record<string, string> = {
  'α': 'a', 'ο': 'o', 'ρ': 'p', 'ε': 'e', 'ν': 'v', 'κ': 'k', 'τ': 't', 'Α': 'A', 'Β': 'B', 'Ε': 'E',
  'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Χ': 'X', 'Υ': 'Y', 'Ζ': 'Z',
};

const MIXED_WORD = /[\p{L}]+/gu;
const CYR = /\p{Script=Cyrillic}/u;
const LAT = /\p{Script=Latin}/u;
const GRK = /\p{Script=Greek}/u;

export function homoglyphWords(text: string): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(MIXED_WORD)) {
    const w = m[0];
    let c = 0;
    let l = 0;
    let g = 0;
    for (const ch of w) {
      if (CYR.test(ch)) c++;
      else if (LAT.test(ch)) l++;
      else if (GRK.test(ch)) g++;
    }
    const scripts = (c > 0 ? 1 : 0) + (l > 0 ? 1 : 0) + (g > 0 ? 1 : 0);
    if (scripts >= 2) out.push({ start: m.index, end: m.index + w.length, detector: 'T-01', label: w });
  }
  return out;
}

const T01: Detector<TextContext> = {
  id: 'T-01',
  analyze(ctx) {
    const spans = homoglyphWords(ctx.text);
    return result('T-01', ctx.lang, spans.length, {
      findings: [finding('T-01.homoglyphs', spans, { count: spans.length, phrase: spans[0]?.label ?? '' })],
    });
  },
};

export const INVISIBLE: Record<string, string> = {
  '​': 'ZWSP',
  '‌': 'ZWNJ',
  '‍': 'ZWJ',
  '⁠': 'WJ',
  '­': 'SHY',
  '﻿': 'BOM',
  '‎': 'LRM',
  '‏': 'RLM',
  '᠎': 'MVS',
};

export function invisibleSpans(text: string): Span[] {
  const out: Span[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const kind = INVISIBLE[ch];
    if (kind && !(kind === 'BOM' && i === 0)) out.push({ start: i, end: i + 1, detector: 'T-02', label: kind });
    else if (ch === ' ' || ch === ' ') {
      // NBSP is normal after short words, before units/dashes, between digits.
      const prev = /([\p{L}\p{N}]+)$/u.exec(text.slice(Math.max(0, i - 12), i))?.[1] ?? '';
      const next = text.slice(i + 1, i + 3);
      const typical = prev.length <= 3 || /^\d+$/.test(prev) || /^[—–\d%₽$€]/.test(next);
      if (!typical) out.push({ start: i, end: i + 1, detector: 'T-02', label: 'NBSP' });
    }
  }
  return out;
}

const T02: Detector<TextContext> = {
  id: 'T-02',
  analyze(ctx) {
    const spans = invisibleSpans(ctx.text);
    const kinds = [...new Set(spans.map((s) => s.label))].join(', ');
    return result('T-02', ctx.lang, spans.length, {
      findings: [finding('T-02.invisible', spans, { count: spans.length, kinds })],
    });
  },
};

const T03: Detector<TextContext> = {
  id: 'T-03',
  analyze(ctx) {
    const nWords = ctx.words.length;
    if (nWords < 30) return notApplicable('T-03', ctx.lang);
    const dashes = spansOf(/—/g, ctx.text, 'T-03');
    const density = per1000(dashes.length, nWords);
    const ellipsis = (ctx.text.match(/…/g) ?? []).length;
    const dots3 = (ctx.text.match(/\.\.\./g) ?? []).length;
    const extras: string[] = [];
    let bonus = 0;
    if (ellipsis > 0 && dots3 === 0) {
      extras.push(ctx.lang === 'ru' ? 'Многоточие везде одним символом «…».' : 'Ellipsis is always the single “…” character.');
      bonus += 0.1;
    }
    const hyphenAsDash = (ctx.text.match(/\s-\s/g) ?? []).length;
    if (dashes.length >= 3 && hyphenAsDash === 0) bonus += 0.1;
    const base = result('T-03', ctx.lang, density);
    const score = Math.min(1, base.score + (base.score > 0 ? bonus : 0));
    return result('T-03', ctx.lang, density, {
      score,
      findings: [
        finding('T-03.perfect_typography', dashes, {
          value: density,
          corridor_hi: ctx.lang === 'ru' ? 8 : 2,
          extra: extras.join(' '),
        }),
      ],
    });
  },
};

const T04: Detector<TextContext> = {
  id: 'T-04',
  analyze(ctx) {
    const t = ctx.text;
    const kinds: string[] = [];
    const straight = /"/.test(t);
    if (straight && /[«»]/.test(t)) kinds.push('" + «»');
    if (straight && /[“”]/.test(t)) kinds.push('" + “”');
    if (/[«»]/.test(t) && /[“”]/.test(t) && ctx.lang === 'en') kinds.push('«» + “”');
    if (/\s-\s/.test(t) && /—/.test(t)) kinds.push('- + —');
    const spans = kinds.length ? spansOf(/["«»“”]|\s-\s/g, t, 'T-04') : [];
    return result('T-04', ctx.lang, kinds.length, {
      findings: [finding('T-04.mixed_typography', spans.slice(0, 50), { kinds: kinds.join('; ') })],
    });
  },
};

const MD_RE = /\*\*[^*\n]+\*\*|__[^_\n]+__|^#{1,6}\s|^\s*[-*]\s|^\s*\d+\.\s|`[^`\n]+`|^\s*\p{Extended_Pictographic}\s|^>\s|\[[^\]]+\]\([^)]+\)/gmu;

const T05: Detector<TextContext> = {
  id: 'T-05',
  analyze(ctx) {
    if (ctx.isMarkdown) return notApplicable('T-05', ctx.lang);
    const spans = spansOf(MD_RE, ctx.text, 'T-05');
    return result('T-05', ctx.lang, spans.length, {
      findings: [finding('T-05.markdown', spans, { count: spans.length })],
    });
  },
};

/** Common words that may be spelled with «ё»; key is the «е» spelling. */
const YO_WORDS = [
  'её', 'ещё', 'всё', 'неё', 'нём', 'чём', 'причём', 'идёт', 'придёт', 'пойдёт', 'даёт', 'берёт', 'живёт',
  'ведёт', 'зовёт', 'несёт', 'растёт', 'жёлтый', 'чёрный', 'тёмный', 'лёгкий', 'зелёный', 'учёный', 'шёл',
  'пришёл', 'нашёл', 'вёл', 'ёлка', 'ёж', 'объём', 'подъём', 'приём', 'счёт', 'отчёт', 'расчёт', 'учёт',
  'полёт', 'самолёт', 'вперёд', 'твёрдый', 'тяжёлый', 'серьёзно', 'серьёзный', 'четырёх', 'трёх', 'надёжный',
];
const YO_RE = new RegExp(
  `(?<![\\p{L}])(?:${YO_WORDS.map((w) => `${w.replace(/ё/g, '[её]')}`).join('|')})(?![\\p{L}])`,
  'giu',
);

const T06: Detector<TextContext> = {
  id: 'T-06',
  analyze(ctx) {
    if (ctx.lang !== 'ru') return notApplicable('T-06', ctx.lang);
    const hits = spansOf(YO_RE, ctx.text, 'T-06');
    if (hits.length < 4) return notApplicable('T-06', ctx.lang);
    const withYo = hits.filter((h) => /ё/i.test(h.label ?? ''));
    const ratio = withYo.length / hits.length;
    return result('T-06', ctx.lang, ratio, {
      findings: [finding('T-06.yo', withYo, { count: hits.length, value: ratio })],
    });
  },
};

export const DETECTORS = [T01, T02, T03, T04, T05, T06];
