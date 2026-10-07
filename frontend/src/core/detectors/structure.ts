import { getRules } from '../rules';
import { per1000, words } from '../text/segment';
import type { Detector, Span, TextContext } from '../types';
import { finding, notApplicable, phraseRe, result, spansOf } from './util';

const S01: Detector<TextContext> = {
  id: 'S-01',
  analyze(ctx) {
    const paras = ctx.paragraphs;
    if (paras.length < 3 || ctx.words.length < 60) return notApplicable('S-01', ctx.lang);
    const lex = getRules().lexicon;
    const concl = phraseRe(lex.conclusion[ctx.lang], true);
    const parts: string[] = [];
    let score = 0;
    const headings = paras.filter((p) => p.kind === 'heading').length;
    const listItems = paras.filter((p) => p.kind === 'list').length;
    if (headings >= 2) {
      score += 0.3;
      parts.push(ctx.lang === 'ru' ? `заголовков: ${headings}` : `headings: ${headings}`);
    }
    // Count "point" blocks: list items or headed sections.
    const points = listItems || Math.max(0, headings - 1);
    if (points >= 3 && points <= 7) {
      score += 0.3;
      parts.push(ctx.lang === 'ru' ? `пунктов: ${points}` : `points: ${points}`);
    }
    const tail = paras.slice(-2).map((p) => p.text).join('\n');
    concl.lastIndex = 0;
    if (concl.test(tail)) {
      score += 0.4;
      parts.push(ctx.lang === 'ru' ? 'итоговый абзац' : 'summary paragraph');
    }
    const first = paras[0]!;
    if (first.kind === 'text' && first.sentences.length <= 3 && (headings || listItems)) score += 0.1;
    score = Math.min(1, score);
    const spans: Span[] = [paras[0]!, paras[paras.length - 1]!].map((p) => ({ start: p.start, end: p.end, detector: 'S-01' }));
    return result('S-01', ctx.lang, score, { findings: [finding('S-01.template', spans, { value: score, extra: parts.join(', ') })] });
  },
};

const TRIAD = {
  ru: /(?<![\p{L}])[\p{L}-]+(?:\s[\p{L}-]+)?,\s[\p{L}-]+(?:\s[\p{L}-]+)?,?\s(?:и|или|а также)\s[\p{L}-]+(?:\s[\p{L}-]+)?/giu,
  en: /\b[\w-]+(?:\s[\w-]+)?,\s[\w-]+(?:\s[\w-]+)?,?\s(?:and|or)\s[\w-]+(?:\s[\w-]+)?/giu,
};

const S02: Detector<TextContext> = {
  id: 'S-02',
  analyze(ctx) {
    if (ctx.words.length < 60) return notApplicable('S-02', ctx.lang);
    // Ignore triads that are part of longer enumerations (A, B, C and D).
    const spans = spansOf(TRIAD[ctx.lang], ctx.text, 'S-02').filter((s) => {
      const before = ctx.text.slice(Math.max(0, s.start - 3), s.start);
      return !/,\s*$/.test(before);
    });
    const value = per1000(spans.length, ctx.words.length);
    return result('S-02', ctx.lang, value, {
      findings: [finding('S-02.triads', spans, { value, count: spans.length, phrase: spans[0]?.label ?? '' })],
    });
  },
};

function isTitleCase(s: string): boolean {
  const ws = s.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && w.length > 3);
  return ws.length >= 2 && ws.every((w) => /^[A-Z]/.test(w));
}

const S03: Detector<TextContext> = {
  id: 'S-03',
  analyze(ctx) {
    const lex = getRules().lexicon;
    const tpl = lex.template_headings[ctx.lang];
    const spans: Span[] = [];
    for (const p of ctx.paragraphs) {
      const isHeadingLike = p.kind === 'heading' || /^#{1,6}\s/.test(p.text) || /^\*\*[^*]+\*\*$/.test(p.text);
      if (!isHeadingLike) continue;
      const h = p.text.replace(/^#+\s*|\*\*/g, '').trim();
      const lower = h.toLowerCase();
      const template = tpl.some((t) => lower.startsWith(t));
      const titleColon = ctx.lang === 'en' && h.includes(':') && isTitleCase(h);
      if (template || titleColon) spans.push({ start: p.start, end: p.end, detector: 'S-03', label: h });
    }
    return result('S-03', ctx.lang, spans.length, {
      findings: [finding('S-03.headings', spans, { count: spans.length, phrase: spans[0]?.label ?? '' })],
    });
  },
};

const ITEM_TERM = /^\s*(?:[-*•–]|\d+[.)])\s*(?:\*\*[^*]+\*\*|[\p{Lu}][\p{L}\s-]{1,40}):\s+\S/u;

const S04: Detector<TextContext> = {
  id: 'S-04',
  analyze(ctx) {
    const items = ctx.paragraphs.filter((p) => p.kind === 'list');
    if (items.length < 3) return notApplicable('S-04', ctx.lang);
    const uniform = items.filter((p) => ITEM_TERM.test(p.text));
    const value = uniform.length / items.length;
    return result('S-04', ctx.lang, value, {
      findings: [finding('S-04.uniform_lists', uniform.map((p) => ({ start: p.start, end: p.end, detector: 'S-04' })), { value })],
    });
  },
};

function contentWords(s: string, stopLen = 3): Set<string> {
  return new Set(words(s).filter((w) => w.length > stopLen));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const S05: Detector<TextContext> = {
  id: 'S-05',
  analyze(ctx) {
    const paras = ctx.paragraphs.filter((p) => p.kind === 'text' && p.sentences.length >= 3);
    if (paras.length < 2) return notApplicable('S-05', ctx.lang);
    const openers = phraseRe(getRules().lexicon.summary_openers[ctx.lang], true);
    const spans: Span[] = [];
    let firstPara = 0;
    for (const p of paras) {
      const first = ctx.sentences[p.sentences[0]!]!;
      const last = ctx.sentences[p.sentences[p.sentences.length - 1]!]!;
      openers.lastIndex = 0;
      const summarising = openers.test(last.text.slice(0, 40)) || jaccard(contentWords(first.text), contentWords(last.text)) >= 0.25;
      if (summarising) {
        if (!spans.length) firstPara = ctx.paragraphs.indexOf(p) + 1;
        spans.push({ start: last.start, end: last.end, detector: 'S-05' });
      }
    }
    const value = spans.length / paras.length;
    return result('S-05', ctx.lang, value, {
      findings: [finding('S-05.summary_endings', spans, { value, para: firstPara })],
    });
  },
};

const CONTRAST = {
  ru: /(?<![\p{L}])(?:не\s[\p{L}\s-]{1,40},\s(?:а|но)\s[\p{L}-]+|не только\s[^.!?]{1,80}?,?\s(?:но и|а и)\s[\p{L}-]+|не просто\s[^.!?]{1,60}?\s?[—–-]\s?[\p{L}-]+|это не\s[\p{L}\s-]{1,40}[—–,]\s(?:а\s|это\s)[\p{L}-]+)/giu,
  en: /\b(?:(?:it'?s|this is|that'?s|is|are)\s+not\s+(?:just|only|merely|simply|about)\s[^.!?]{1,60}?[,;—–-]\s*(?:it'?s|but|this is|they'?re|it is)\s[\w-]+|not only\s[^.!?]{1,80}?\sbut also\s[\w-]+|isn'?t (?:just|only)\s[^.!?]{1,60}?[—–-]\s*it'?s\s[\w-]+)/giu,
};

const S06: Detector<TextContext> = {
  id: 'S-06',
  analyze(ctx) {
    if (ctx.words.length < 40) return notApplicable('S-06', ctx.lang);
    const spans = spansOf(CONTRAST[ctx.lang], ctx.text, 'S-06');
    const value = per1000(spans.length, ctx.words.length);
    return result('S-06', ctx.lang, value, {
      findings: [finding('S-06.contrast', spans, { value, count: spans.length, phrase: spans[0]?.label ?? '' })],
    });
  },
};

export const DETECTORS = [S01, S02, S03, S04, S05, S06];
