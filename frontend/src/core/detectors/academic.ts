import { getRules } from '../rules';
import { cv, per1000, words } from '../text/segment';
import type { Detector, Lang, Span, TextContext } from '../types';
import { finding, notApplicable, phraseRe, result, spansOf } from './util';

const t = (lang: Lang, ru: string, en: string) => (lang === 'ru' ? ru : en);

// ---------- citations ----------

export interface Citation {
  source: number;
  pages: number[];
  range: boolean;
  start: number;
  end: number;
}

export interface BibEntry {
  n: number;
  totalPages?: number;
}

const REF_BLOCK = /\[(\d{1,3}(?:\s*,\s*(?:с|c|С|p|pp|P|стр)\.?\s*[\d–—-]+)?(?:\s*;\s*\d{1,3}(?:\s*,\s*(?:с|c|С|p|pp|P|стр)\.?\s*[\d–—-]+)?)*)\]/gu;

/** In-text references like "[4, с. 41–42]" or "[8, с. 35–48; 15, p. 19–27]". */
export function parseCitations(text: string): Citation[] {
  const out: Citation[] = [];
  for (const m of text.matchAll(REF_BLOCK)) {
    for (const part of m[1]!.split(';')) {
      const pm = /^\s*(\d{1,3})(?:\s*,\s*\S+?\.?\s*([\d–—-]+))?\s*$/u.exec(part);
      if (!pm) continue;
      const pages = (pm[2] ?? '')
        .split(/[–—-]/)
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0);
      out.push({ source: Number(pm[1]), pages, range: pages.length > 1, start: m.index, end: m.index + m[0].length });
    }
  }
  return out;
}

const BIB_HEADING = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:библиографи|список литературы|литература|список источников|references|bibliography|works cited)/imu;

/** Numbered bibliography entries after a "References"-like heading, with total page counts if given ("494 с.", "280 p."). */
export function parseBibliography(text: string): BibEntry[] {
  const h = BIB_HEADING.exec(text);
  if (!h) return [];
  const tail = text.slice(h.index);
  const out: BibEntry[] = [];
  for (const m of tail.matchAll(/^\s*(\d{1,3})[.)]\s+(.+)$/gmu)) {
    const line = m[2]!;
    // Total length is "NNN с." / "NNN p." not preceded by "С." / "P." (which marks a page range).
    const tm = /(?<![СсCcPp]\.\s?)(?<!\d[–—-])\b(\d{2,4})\s?(?:с|p|pp|стр)\.(?!\s?\d)/u.exec(line);
    out.push({ n: Number(m[1]), totalPages: tm ? Number(tm[1]) : undefined });
  }
  return out;
}

const B01: Detector<TextContext> = {
  id: 'B-01',
  analyze(ctx) {
    const cites = parseCitations(ctx.text);
    if (cites.length < 5) return notApplicable('B-01', ctx.lang);
    const U = ctx.uiLang ?? ctx.lang;
    const bib = parseBibliography(ctx.text);
    const notes: string[] = [];
    const spans: Span[] = [];
    let flags = 0;

    // 1. Page beyond the length of the book stated in the bibliography.
    const over = cites.filter((c) => {
      const total = bib.find((b) => b.n === c.source)?.totalPages;
      return total !== undefined && c.pages.some((p) => p > total);
    });
    if (over.length) {
      flags += Math.min(2, over.length);
      for (const c of over) spans.push({ start: c.start, end: c.end, detector: 'B-01' });
      const c = over[0]!;
      notes.push(
        t(
          U,
          `Ссылка на страницы ${c.pages.join('–')} источника [${c.source}], хотя в списке литературы у него ${bib.find((b) => b.n === c.source)!.totalPages} с.`,
          `Reference to pages ${c.pages.join('–')} of [${c.source}], but the bibliography lists ${bib.find((b) => b.n === c.source)!.totalPages} pages.`,
        ),
      );
    }
    // 2. Reference to a source number missing from the bibliography.
    if (bib.length) {
      const missing = [...new Set(cites.map((c) => c.source))].filter((n) => !bib.some((b) => b.n === n));
      if (missing.length) {
        flags += 1.5;
        notes.push(t(U, `Ссылки на отсутствующие в списке источники: ${missing.join(', ')}.`, `References to sources missing from the bibliography: ${missing.join(', ')}.`));
      }
    }
    // 3. Mechanically even citation density: almost every prose paragraph carries a reference.
    const prose = ctx.paragraphs.filter((p) => p.kind === 'text' && words(p.text).length >= 25);
    const bibStart = BIB_HEADING.exec(ctx.text)?.index ?? Infinity;
    const body = prose.filter((p) => p.start < bibStart);
    if (body.length >= 6) {
      const withRef = body.filter((p) => cites.some((c) => c.start >= p.start && c.end <= p.end)).length;
      const share = withRef / body.length;
      if (share >= 0.6) {
        flags += 0.8;
        notes.push(t(U, `Ссылка есть в ${Math.round(share * 100)} % абзацев.`, `${Math.round(share * 100)}% of paragraphs carry a reference.`));
      }
    }
    // 4. Every source cited, and cited about equally often.
    const counts = new Map<number, number>();
    for (const c of cites) counts.set(c.source, (counts.get(c.source) ?? 0) + 1);
    if (bib.length >= 8 && counts.size >= bib.length * 0.9 && cv([...counts.values()]) < 0.5) {
      flags += 0.7;
      notes.push(t(U, `Все ${bib.length} источников процитированы почти поровну.`, `All ${bib.length} sources are cited almost equally.`));
    }
    // 5. Page ranges instead of single pages.
    const paged = cites.filter((c) => c.pages.length);
    const rangeShare = paged.length ? paged.filter((c) => c.range).length / paged.length : 0;
    if (paged.length >= 6 && rangeShare >= 0.6) {
      flags += 0.5;
      notes.push(t(U, `${Math.round(rangeShare * 100)} % ссылок — диапазоны страниц.`, `${Math.round(rangeShare * 100)}% of references are page ranges.`));
    }
    return result('B-01', ctx.lang, flags, { findings: [finding('B-01.citations', spans, { value: flags, extra: notes.join(' ') })] });
  },
};

// ---------- section isomorphism ----------

interface Section {
  start: number;
  end: number;
  text: string;
}

export function splitSections(text: string): Section[] {
  const heads = [...text.matchAll(/^#{1,4}\s+.+$/gmu)].map((m) => m.index);
  if (heads.length < 2) return [];
  return heads.map((s, i) => {
    const e = heads[i + 1] ?? text.length;
    return { start: s, end: e, text: text.slice(s, e) };
  });
}

const PLACEHOLDER = /^\s*(?:\*\*)?(?:автор|author)(?:\*\*)?\s*:?\s*(?:\*\*)?\s*(?:студенческое|student|\[|<|имя|name|фио)/imu;

const S08: Detector<TextContext> = {
  id: 'S-08',
  analyze(ctx) {
    const bibStart = BIB_HEADING.exec(ctx.text)?.index ?? Infinity;
    const sections = splitSections(ctx.text).filter((s) => s.start < bibStart && words(s.text).length >= 80);
    const U = ctx.uiLang ?? ctx.lang;
    const notes: string[] = [];
    let flags = 0;
    const spans: Span[] = [];
    const ph = PLACEHOLDER.exec(ctx.text);
    if (ph) {
      flags += 1;
      spans.push({ start: ph.index, end: ph.index + ph[0].length, detector: 'S-08', label: ph[0].trim() });
      notes.push(t(U, 'Поле автора заполнено шаблоном.', 'Author field is a template placeholder.'));
    }
    const latex = spansOf(/\$\$[^$]+\$\$|\\(?:text|rightarrow|frac|cdot)\{?/g, ctx.text, 'S-08');
    if (latex.length && ctx.words.length > 300) {
      flags += 0.7;
      spans.push(...latex.slice(0, 5));
      notes.push(t(U, `LaTeX-формулы в гуманитарном тексте: ${latex.length}.`, `LaTeX formulas in a humanities text: ${latex.length}.`));
    }
    if (sections.length < 3) {
      if (!flags) return notApplicable('S-08', ctx.lang);
      return result('S-08', ctx.lang, flags, { findings: [finding('S-08.uniform_sections', spans, { value: flags, extra: notes.join(' ') })] });
    }
    const feat = sections.map((s) => {
      const w = words(s.text).length || 1;
      return {
        bold: (s.text.match(/\*\*[^*\n]+\*\*/g) ?? []).length,
        cites: parseCitations(s.text).length,
        quotes: (s.text.match(/^>\s/gm) ?? []).length,
        bullets: (s.text.match(/^\s*(?:[-*•]|\d+\.)\s/gm) ?? []).length,
        boldPer1000: per1000((s.text.match(/\*\*[^*\n]+\*\*/g) ?? []).length, w),
        citesPer1000: per1000(parseCitations(s.text).length, w),
      };
    });
    const withBold = feat.filter((f) => f.bold > 0).length / feat.length;
    const withCites = feat.filter((f) => f.cites > 0).length / feat.length;
    const densityCv = (cv(feat.map((f) => f.boldPer1000)) + cv(feat.map((f) => f.citesPer1000))) / 2;
    if (withBold >= 0.8 && withCites >= 0.8) {
      flags += 1;
      notes.push(
        t(
          U,
          `Все ${sections.length} разделов устроены одинаково: жирные термины и ссылки в каждом.`,
          `All ${sections.length} sections share one skeleton: bold terms and references in each.`,
        ),
      );
    }
    if (densityCv < 0.45) {
      flags += 0.7;
      notes.push(t(U, 'Плотность выделений и ссылок почти одинакова по разделам.', 'Density of bold terms and references is nearly identical across sections.'));
    }
    const boldTotal = feat.reduce((a, f) => a + f.bold, 0);
    if (per1000(boldTotal, ctx.words.length) > 12) {
      flags += 0.5;
      notes.push(t(U, `Жирных выделений: ${boldTotal}.`, `Bold highlights: ${boldTotal}.`));
    }
    return result('S-08', ctx.lang, flags, { findings: [finding('S-08.uniform_sections', spans, { value: flags, extra: notes.join(' ') })] });
  },
};

// ---------- authority + proof verb ----------

const ATTRIBUTION: Record<Lang, RegExp> = {
  ru: /(?<![\p{L}])(?:как\s+(?:показал|показала|отмечает|отмечал|писал|доказал)\w*\s+)?(?:[\p{Lu}][\p{Ll}]+(?:[\s-][\p{Lu}][\p{Ll}]+)?(?:\s[\p{Lu}]\.){0,2}[\s,]+(?:в\s[^.]{0,60}?\s)?)(?:показал|показала|показали|доказал|доказала|доказали|описал|описала|раскрыл|раскрыла|отмечает|утверждает|ввёл|ввел|сформулировал|предостерегал|развивает|определил|формализовал|охарактеризовал|выделил|подчеркивает|подчёркивает)(?![\p{L}])/gu,
  en: /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?(?:\s\(\d{4}\))?,?\s(?:showed|demonstrated|argued|argues|described|noted|notes|observed|proved|introduced|formulated|emphasized|emphasizes|highlighted|warned|contended)\b/g,
};

const L07: Detector<TextContext> = {
  id: 'L-07',
  analyze(ctx) {
    if (ctx.words.length < 300) return notApplicable('L-07', ctx.lang);
    const cites = parseCitations(ctx.text);
    const U = ctx.uiLang ?? ctx.lang;
    const attr = spansOf(ATTRIBUTION[ctx.lang], ctx.text, 'L-07');
    const acad = spansOf(phraseRe(getRules().lexicon.academic_markers[ctx.lang], true), ctx.text, 'L-07');
    // Attribution chains matter mostly in referenced academic prose.
    if (cites.length < 3 && attr.length < 4) return notApplicable('L-07', ctx.lang);
    const value = per1000(attr.length * 1.5 + acad.length, ctx.words.length);
    const extra = t(
      U,
      `Связок «автор + показал/доказал/описал»: ${attr.length}; академических штампов: ${acad.length}.`,
      `“Author + showed/proved/described” links: ${attr.length}; academic clichés: ${acad.length}.`,
    );
    return result('L-07', ctx.lang, value, {
      findings: [finding('L-07.attribution', [...attr, ...acad].sort((a, b) => a.start - b.start), { value, extra, phrase: attr[0]?.label ?? acad[0]?.label ?? '' })],
    });
  },
};

export const DETECTORS = [B01, S08, L07];
