import { normalize, spec } from '../rules';
import type { DetectorResult, Finding, Lang, Params, Span } from '../types';

export function result(
  id: string,
  lang: Lang,
  value: number,
  opts: { applicable?: boolean; findings?: Omit<Finding, 'detector' | 'score'>[]; score?: number } = {},
): DetectorResult {
  const s = spec(id);
  const applicable = opts.applicable ?? true;
  const score = applicable ? (opts.score ?? normalize(id, value, lang)) : 0;
  const findings: Finding[] =
    applicable && score >= 0.35
      ? (opts.findings ?? []).map((f) => ({ ...f, detector: id, score }))
      : [];
  return { id, category: s.category, score, applicable, value: Number.isFinite(value) ? value : 0, findings };
}

export function finding(rule: string, spans: Span[], params: Params): Omit<Finding, 'detector' | 'score'> {
  return { rule, spans, params };
}

export function notApplicable(id: string, lang: Lang): DetectorResult {
  return result(id, lang, 0, { applicable: false });
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds a Unicode-aware whole-word regex from a list of phrases. */
export function phraseRe(list: string[], prefix = false): RegExp {
  const alts = [...list].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts})${prefix ? '' : '(?![\\p{L}\\p{N}])'}`, 'giu');
}

export function spansOf(re: RegExp, text: string, detector: string, label?: string): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(re)) {
    if (m[0].length === 0) continue;
    out.push({ start: m.index, end: m.index + m[0].length, detector, label: label ?? m[0] });
  }
  return out;
}
