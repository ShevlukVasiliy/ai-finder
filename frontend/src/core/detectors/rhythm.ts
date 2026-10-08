import { cv, mean, proseSentences } from '../text/segment';
import type { Detector, Span, TextContext } from '../types';
import { finding, notApplicable, result } from './util';

const MIN_SENTENCES = 5;

function sentenceSpan(s: { start: number; end: number }, id: string): Span {
  return { start: s.start, end: s.end, detector: id };
}

const R01: Detector<TextContext> = {
  id: 'R-01',
  analyze(ctx) {
    const ss = proseSentences(ctx);
    if (ss.length < MIN_SENTENCES) return notApplicable('R-01', ctx.lang);
    const lens = ss.map((s) => s.words.length);
    const value = cv(lens);
    // Point at the paragraph with the most uniform sentences.
    let bestPara = 0;
    let bestCv = Infinity;
    ctx.paragraphs.forEach((p, i) => {
      if (p.sentences.length < 3) return;
      const c = cv(p.sentences.map((k) => ctx.sentences[k]!.words.length));
      if (c < bestCv) {
        bestCv = c;
        bestPara = i;
      }
    });
    const m = mean(lens);
    // Point at the few most "average" sentences — the ones to split or merge first.
    const spans = [...ss]
      .sort((a, b) => Math.abs(a.words.length - m) - Math.abs(b.words.length - m))
      .slice(0, 3)
      .sort((a, b) => a.start - b.start)
      .map((s) => sentenceSpan(s, 'R-01'));
    return result('R-01', ctx.lang, value, {
      findings: [finding('R-01.low_burstiness', spans, { value, para: bestPara + 1 })],
    });
  },
};

const R02: Detector<TextContext> = {
  id: 'R-02',
  analyze(ctx) {
    const ss = proseSentences(ctx);
    if (ss.length < MIN_SENTENCES) return notApplicable('R-02', ctx.lang);
    const extreme = ss.filter((s) => s.words.length <= 5 || s.words.length >= 35).length;
    const value = extreme / ss.length;
    const spans = ss.filter((s) => s.words.length > 5 && s.words.length < 35).map((s) => sentenceSpan(s, 'R-02'));
    return result('R-02', ctx.lang, value, { findings: [finding('R-02.no_extremes', spans.slice(0, 30), { value })] });
  },
};

const R03: Detector<TextContext> = {
  id: 'R-03',
  analyze(ctx) {
    const paras = ctx.paragraphs.filter((p) => p.kind === 'text' && p.sentences.length > 0);
    if (paras.length < 3) return notApplicable('R-03', ctx.lang);
    const lens = paras.map((p) => p.sentences.reduce((a, k) => a + ctx.sentences[k]!.words.length, 0));
    const pcv = cv(lens);
    const threeFour = paras.filter((p) => p.sentences.length >= 3 && p.sentences.length <= 4).length;
    const share = threeFour / paras.length;
    // Uniformity in sentence counts makes the paragraph CV look even lower.
    const value = pcv * (1 - 0.4 * Math.max(0, share - 0.5));
    return result('R-03', ctx.lang, value, {
      findings: [
        finding(
          'R-03.uniform_paragraphs',
          paras.map((p) => ({ start: p.start, end: p.end, detector: 'R-03' })),
          { value: pcv, extra: `${threeFour}/${paras.length}` },
        ),
      ],
    });
  },
};

export function autocorr(xs: number[], lag: number): number {
  const n = xs.length;
  if (n <= lag + 2) return 0;
  const m = mean(xs);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    den += (xs[i]! - m) ** 2;
    if (i + lag < n) num += (xs[i]! - m) * (xs[i + lag]! - m);
  }
  return den ? num / den : 0;
}

const R04: Detector<TextContext> = {
  id: 'R-04',
  analyze(ctx) {
    const ss = proseSentences(ctx);
    if (ss.length < 9) return notApplicable('R-04', ctx.lang);
    const lens = ss.map((s) => s.words.length);
    let best = -1;
    let lag = 2;
    for (const l of [2, 3, 4]) {
      const a = autocorr(lens, l);
      if (a > best) {
        best = a;
        lag = l;
      }
    }
    return result('R-04', ctx.lang, best, {
      findings: [finding('R-04.rhythm', ss.map((s) => sentenceSpan(s, 'R-04')).slice(0, 20), { value: best, lag })],
    });
  },
};

const R05: Detector<TextContext> = {
  id: 'R-05',
  analyze(ctx) {
    const ss = proseSentences(ctx);
    if (ss.length < 6) return notApplicable('R-05', ctx.lang);
    const firsts = ss.map((s) => s.words[0] ?? '');
    const counts = new Map<string, number>();
    for (const f of firsts) counts.set(f, (counts.get(f) ?? 0) + 1);
    let top = '';
    let topN = 0;
    for (const [w, n] of counts)
      if (n > topN) {
        top = w;
        topN = n;
      }
    let consecutive = 0;
    for (let i = 1; i < firsts.length; i++) if (firsts[i] === firsts[i - 1]) consecutive++;
    const value = Math.min(1, topN / ss.length + (consecutive / ss.length) * 0.5);
    const spans = ss
      .filter((s) => s.words[0] === top)
      .map((s) => ({ start: s.start, end: s.start + (ctx.text.slice(s.start).match(/^\S+/)?.[0].length ?? 1), detector: 'R-05' }));
    return result('R-05', ctx.lang, value, {
      findings: [finding('R-05.openings', spans, { value: topN / ss.length, phrase: top })],
    });
  },
};

export const DETECTORS = [R01, R02, R03, R04, R05];
