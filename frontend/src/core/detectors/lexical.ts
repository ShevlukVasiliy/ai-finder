import { getRules } from '../rules';
import { cv, per1000 } from '../text/segment';
import type { Detector, Lang, Span, TextContext } from '../types';
import { finding, notApplicable, phraseRe, result, spansOf } from './util';

const MIN_WORDS = 40;

interface MarkerHit extends Span {
  weight: number;
  replace: string[];
}

const markerCache = new WeakMap<object, Record<Lang, { re: RegExp; weight: number; replace: string[] }[]>>();

function compiledMarkers(lang: Lang) {
  const rules = getRules();
  let c = markerCache.get(rules.markers);
  if (!c) {
    const build = (l: Lang) =>
      rules.markers[l].map((m) => ({
        re: new RegExp(`(?<![\\p{L}])(?:${m.pattern})(?![\\p{L}])`, 'giu'),
        weight: m.weight,
        replace: m.replace,
      }));
    c = { ru: build('ru'), en: build('en') };
    markerCache.set(rules.markers, c);
  }
  return c[lang];
}

export function findMarkers(text: string, lang: Lang): MarkerHit[] {
  const hits: MarkerHit[] = [];
  for (const m of compiledMarkers(lang))
    for (const s of spansOf(m.re, text, 'L-01')) hits.push({ ...s, weight: m.weight, replace: m.replace });
  return hits.sort((a, b) => a.start - b.start);
}

const L01: Detector<TextContext> = {
  id: 'L-01',
  analyze(ctx) {
    if (ctx.words.length < 20) return notApplicable('L-01', ctx.lang);
    // Mixed texts: search both dictionaries.
    const hits = ctx.mixedShare > 0.2 ? [...findMarkers(ctx.text, 'ru'), ...findMarkers(ctx.text, 'en')] : findMarkers(ctx.text, ctx.lang);
    const weighted = hits.reduce((a, h) => a + h.weight, 0);
    const value = per1000(weighted, ctx.words.length);
    const replacements = hits.slice(0, 3).map((h) => `«${h.label}» → ${h.replace.join(' / ')}`);
    return result('L-01', ctx.lang, value, {
      findings: [
        finding(
          'L-01.markers',
          hits.map(({ start, end, detector, label }) => ({ start, end, detector, label })),
          { value, phrase: hits[0]?.label ?? '', count: hits.length, replace: replacements.join('; ') },
        ),
      ],
    });
  },
};

/** Moving-average type/token ratio over windows of `w` words. */
export function mattrWindows(ws: string[], w = 50): number[] {
  if (ws.length < w) return [];
  const out: number[] = [];
  const counts = new Map<string, number>();
  for (let i = 0; i < ws.length; i++) {
    counts.set(ws[i]!, (counts.get(ws[i]!) ?? 0) + 1);
    if (i >= w) {
      const old = ws[i - w]!;
      const n = counts.get(old)! - 1;
      if (n) counts.set(old, n);
      else counts.delete(old);
    }
    if (i >= w - 1 && (i - w + 1) % 10 === 0) out.push(counts.size / w);
  }
  return out;
}

const L02: Detector<TextContext> = {
  id: 'L-02',
  analyze(ctx) {
    const ws = ctx.words.map((w) => w.lower);
    if (ws.length < 150) return notApplicable('L-02', ctx.lang);
    const windows = mattrWindows(ws, 50);
    const value = cv(windows);
    return result('L-02', ctx.lang, value, { findings: [finding('L-02.flat_diversity', [], { value })] });
  },
};

const L03: Detector<TextContext> = {
  id: 'L-03',
  analyze(ctx) {
    const ws = ctx.words.map((w) => w.lower).filter((w) => !/^\d+$/.test(w));
    if (ws.length < 100) return notApplicable('L-03', ctx.lang);
    // Use a fixed-size sample so the ratio does not depend on text length.
    const sample = ws.slice(0, 300);
    const counts = new Map<string, number>();
    for (const w of sample) counts.set(w, (counts.get(w) ?? 0) + 1);
    let hapax = 0;
    for (const n of counts.values()) if (n === 1) hapax++;
    const value = hapax / counts.size;
    return result('L-03', ctx.lang, value, { findings: [finding('L-03.thin_tail', [], { value })] });
  },
};

const hedgeCache = new Map<string, RegExp>();
function cached(key: string, build: () => RegExp): RegExp {
  let re = hedgeCache.get(key);
  if (!re) {
    re = build();
    hedgeCache.set(key, re);
  }
  re.lastIndex = 0;
  return re;
}

const L04: Detector<TextContext> = {
  id: 'L-04',
  analyze(ctx) {
    if (ctx.words.length < MIN_WORDS) return notApplicable('L-04', ctx.lang);
    const lex = getRules().lexicon;
    const hedgeRe = cached(`h:${ctx.lang}:${lex.hedges[ctx.lang].length}`, () => phraseRe(lex.hedges[ctx.lang], true));
    const hedges = spansOf(hedgeRe, ctx.text, 'L-04');
    const suffixes = lex.nominal_suffixes[ctx.lang];
    const nominal = ctx.words.filter((w) => w.lower.length > 6 && suffixes.some((s) => w.lower.endsWith(s)));
    const passiveRe =
      ctx.lang === 'en'
        ? /\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?\w+(?:ed|en)\b/giu
        : /(?<![\p{L}])[\p{L}]+(?:ется|ются|ится|ятся|ался|алась|ались|ено|ена|ены|ан[ао]?|ят[ао]?)(?![\p{L}])/giu;
    const passive = spansOf(passiveRe, ctx.text, 'L-04');
    // Nominalisations are frequent in any text; only their excess over a base rate counts.
    const base = ctx.lang === 'ru' ? 0.06 : 0.04;
    const nominalExcess = Math.max(0, nominal.length - ctx.words.length * base);
    const value = per1000(hedges.length * 2 + nominalExcess + passive.length * 0.5, ctx.words.length);
    const spans = [...hedges, ...nominal.slice(0, 30).map((w) => ({ start: w.start, end: w.end, detector: 'L-04', label: ctx.text.slice(w.start, w.end) }))];
    return result('L-04', ctx.lang, value, {
      findings: [finding('L-04.hedging', spans, { value, phrase: hedges[0]?.label ?? spans[0]?.label ?? '' })],
    });
  },
};

const L05: Detector<TextContext> = {
  id: 'L-05',
  analyze(ctx) {
    if (ctx.words.length < MIN_WORDS) return notApplicable('L-05', ctx.lang);
    const lex = getRules().lexicon;
    const set = new Set([...lex.noise[ctx.lang], ...(ctx.mixedShare > 0.2 ? lex.noise[ctx.lang === 'ru' ? 'en' : 'ru'] : [])]);
    let noise = ctx.words.filter((w) => set.has(w.lower)).length;
    const t = ctx.text;
    noise += (t.match(/[!?]/g) ?? []).length;
    noise += (t.match(/\([^)]{1,60}\)/g) ?? []).length;
    noise += (t.match(/\b(?:19|20)\d{2}\b|\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b/g) ?? []).length;
    noise += (t.match(/\.\.\.|:\)|\)\)|;\)|:D/g) ?? []).length;
    // Capitalised words mid-sentence ≈ names and places.
    for (const s of ctx.sentences) {
      const caps = s.text.slice(1).match(/(?<=[\s,(«"])\p{Lu}\p{Ll}{2,}/gu);
      noise += Math.min(3, caps?.length ?? 0) * 0.5;
    }
    const value = per1000(noise, ctx.words.length);
    return result('L-05', ctx.lang, value, {
      findings: [finding('L-05.no_noise', [], { value, corridor_lo: ctx.lang === 'ru' ? 25 : 30 })],
    });
  },
};

const STOP: Record<Lang, Set<string>> = {
  ru: new Set('и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между это'.split(' ')),
  en: new Set('the a an and or but of to in on at for with by from is are was were be been it this that these those as not no so if then than there their they we you he she i his her its our your my me us them which who what when where how all any can will would should could do does did have has had into about over also just more most such only own same too very'.split(' ')),
};

const L06: Detector<TextContext> = {
  id: 'L-06',
  analyze(ctx) {
    const ws = ctx.words;
    if (ws.length < 80) return notApplicable('L-06', ctx.lang);
    const stop = STOP[ctx.lang];
    const seen = new Map<string, number[]>();
    for (let i = 0; i + 3 <= ws.length; i++) {
      const gram = ws.slice(i, i + 3).map((w) => w.lower);
      if (gram.filter((g) => !stop.has(g)).length < 2) continue;
      const key = gram.join(' ');
      const arr = seen.get(key) ?? [];
      arr.push(i);
      seen.set(key, arr);
    }
    const spans: Span[] = [];
    let repeats = 0;
    let first = '';
    for (const [key, idx] of seen)
      if (idx.length > 1) {
        repeats += idx.length - 1;
        if (!first) first = key;
        for (const i of idx) spans.push({ start: ws[i]!.start, end: ws[i + 2]!.end, detector: 'L-06', label: key });
      }
    const value = per1000(repeats, ws.length);
    return result('L-06', ctx.lang, value, {
      findings: [finding('L-06.ngrams', spans, { value, count: repeats, phrase: first })],
    });
  },
};

export const DETECTORS = [L01, L02, L03, L04, L05, L06];
